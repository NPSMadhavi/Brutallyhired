import { prisma } from "@verity/db";
import { bookSlotSchema, rescheduleRequestSchema, type JoinTokenDto } from "@verity/shared";
import { type Request } from "express";
import { env } from "../config/env.js";
import { interviewDto } from "../serializers/candidate.serializer.js";
import { interviewToken } from "../services/livekit.service.js";
import { emailRecruiters, internalEvent, publishMilestone } from "../services/notification.service.js";
import { ah, conflict, HttpError, notFound, parse } from "../utils/errors.js";
import { buildIcs } from "../utils/ics.js";
import { tenantOf, userOf } from "../utils/request.js";
import { addMs, hours, minutes } from "../utils/time.js";

/** Candidates may change a booked time until this long before it starts. */
const CHANGE_CUTOFF = hours(12);

async function ownedRound(req: Request, id: string) {
  const round = await prisma.interviewRound.findFirst({
    where: { id, application: { userId: userOf(req).id, tenantId: tenantOf(req).id } },
    include: { panelists: true, slots: true, application: { include: { job: true } } },
  });
  if (!round) throw notFound("interview");
  return round;
}

const total = (applicationId: string) => prisma.interviewRound.count({ where: { applicationId, status: { not: "CANCELLED" } } });

function icsFor(round: Awaited<ReturnType<typeof ownedRound>>, tenantName: string, tenantSlug: string) {
  return buildIcs({
    uid: `${round.id}@brutallyhired`,
    start: round.scheduledStart!,
    end: round.scheduledEnd!,
    title: `${round.title} — ${round.application.job.title}`,
    description: round.preparation ?? round.description ?? "",
    url: new URL(`/${tenantSlug}/applications/${round.applicationId}/interviews/${round.id}`, env.WEB_ORIGIN).toString(),
    organizer: tenantName,
  });
}

export const listInterviews = ah(async (req, res) => {
  const rounds = await prisma.interviewRound.findMany({
    where: {
      applicationId: req.params.appId,
      status: { not: "CANCELLED" },
      application: { userId: userOf(req).id, tenantId: tenantOf(req).id },
    },
    include: { panelists: true, slots: true },
    orderBy: { sequence: "asc" },
  });
  res.json({ items: rounds.map((r) => interviewDto(r, rounds.length)) });
});

export const getInterview = ah(async (req, res) => {
  const round = await ownedRound(req, req.params.id!);
  res.json(interviewDto(round, await total(round.applicationId)));
});

export const bookSlot = ah(async (req, res) => {
  const round = await ownedRound(req, req.params.id!);
  const { slotId } = parse(bookSlotSchema, req.body);
  const now = new Date();
  const rescheduling = round.status === "SCHEDULED";
  if (round.status !== "AWAITING_BOOKING" && !rescheduling) throw conflict("interview_not_bookable");
  if (rescheduling && round.scheduledStart && round.scheduledStart.getTime() - now.getTime() < CHANGE_CUTOFF) {
    throw conflict("too_late_to_change");
  }
  const slot = round.slots.find((s) => s.id === slotId);
  if (!slot || slot.bookedAt || slot.startsAt < addMs(now, minutes(60))) throw conflict("slot_unavailable");

  await prisma.$transaction(async (tx) => {
    const taken = await tx.interviewSlot.updateMany({ where: { id: slot.id, bookedAt: null }, data: { bookedAt: now } });
    if (taken.count !== 1) throw conflict("slot_unavailable");
    if (rescheduling && round.scheduledStart) {
      await tx.interviewSlot.updateMany({ where: { roundId: round.id, startsAt: round.scheduledStart }, data: { bookedAt: null } });
    }
    await tx.interviewRound.update({
      where: { id: round.id },
      data: { status: "SCHEDULED", scheduledStart: slot.startsAt, scheduledEnd: addMs(slot.startsAt, minutes(round.durationMinutes)) },
    });
  });

  const updated = await ownedRound(req, round.id);
  const tenant = tenantOf(req);
  await publishMilestone({
    applicationId: round.applicationId,
    type: rescheduling ? "interview_rescheduled" : "interview_booked",
    data: { roundId: round.id, title: round.title, startsAt: updated.scheduledStart!.toISOString() },
    email: {
      vars: { roundTitle: round.title, startsAt: updated.scheduledStart!.toUTCString() },
      attachments: [{ filename: "interview.ics", content: icsFor(updated, tenant.name, tenant.slug), contentType: "text/calendar" }],
    },
    path: `/${tenant.slug}/applications/${round.applicationId}/interviews/${round.id}`,
  });
  res.json(interviewDto(updated, await total(round.applicationId)));
});

export const requestReschedule = ah(async (req, res) => {
  const round = await ownedRound(req, req.params.id!);
  const { message } = parse(rescheduleRequestSchema, req.body);
  if (round.status === "COMPLETED" || round.status === "CANCELLED") throw conflict("interview_closed");
  await prisma.rescheduleRequest.create({ data: { roundId: round.id, message } });
  await internalEvent(round.applicationId, "reschedule_requested", { roundId: round.id }, userOf(req).id);
  const profile = await prisma.candidateProfile.findUnique({
    where: { userId_tenantId: { userId: userOf(req).id, tenantId: tenantOf(req).id } },
  });
  await emailRecruiters(round.applicationId, "staff_reschedule_request", {
    candidateName: profile ? `${profile.firstName} ${profile.lastName}` : userOf(req).email,
    roundTitle: round.title,
    message,
  });
  res.status(202).json({ ok: true });
});

export const downloadCalendar = ah(async (req, res) => {
  const round = await ownedRound(req, req.params.id!);
  if (!round.scheduledStart) throw notFound("interview");
  const tenant = tenantOf(req);
  res.setHeader("content-type", "text/calendar; charset=utf-8");
  res.setHeader("content-disposition", 'attachment; filename="interview.ics"');
  res.send(icsFor(round, tenant.name, tenant.slug));
});

export const createJoinToken = ah(async (req, res) => {
  const round = await ownedRound(req, req.params.id!);
  if (round.status !== "SCHEDULED" || !round.scheduledStart || !round.scheduledEnd) throw conflict("interview_not_scheduled");
  const now = Date.now();
  const opens = round.scheduledStart.getTime() - minutes(env.INTERVIEW_JOIN_EARLY_MINUTES);
  const closes = round.scheduledEnd.getTime() + minutes(env.INTERVIEW_JOIN_LATE_MINUTES);
  if (now < opens) throw new HttpError(425, "join_not_open_yet");
  if (now > closes) throw conflict("join_window_closed");
  const user = userOf(req);
  const profile = await prisma.candidateProfile.findUnique({
    where: { userId_tenantId: { userId: user.id, tenantId: tenantOf(req).id } },
  });
  const token: JoinTokenDto = await interviewToken({
    roomName: round.roomName,
    identity: `candidate:${user.id}`,
    name: profile ? `${profile.firstName} ${profile.lastName}` : (user.displayName ?? user.email),
    ttlSeconds: (closes - now) / 1000,
  });
  await internalEvent(round.applicationId, "interview_joined", { roundId: round.id }, user.id);
  res.json(token);
});
