import { prisma, type ApplicationStage } from "@verity/db";
import {
  buildTrack,
  CLOSED_STAGES,
  type ApplicationOverview,
  type MilestoneKey,
  type NextAction,
  type PublicEvent,
  type PublicEventType,
  type SectionAvailability,
} from "@verity/shared";
import { recruiterDto } from "../serializers/candidate.serializer.js";

const MILESTONE_EVENT: Partial<Record<PublicEventType, MilestoneKey>> = {
  application_submitted: "APPLIED",
  review_started: "IN_REVIEW",
  assessment_invited: "ASSESSMENT",
  interview_invited: "INTERVIEWS",
  offer_sent: "OFFER",
  onboarding_started: "ONBOARDING",
  hired: "FIRST_DAY",
};

export async function buildOverview(applicationId: string, now = new Date()): Promise<ApplicationOverview> {
  const app = await prisma.application.findUniqueOrThrow({
    where: { id: applicationId },
    include: {
      job: true,
      recruiter: { include: { staff: true } },
      events: { orderBy: { createdAt: "desc" } },
      assessmentInvites: { include: { template: true, attempt: true }, orderBy: { createdAt: "asc" } },
      interviewRounds: { orderBy: { sequence: "asc" } },
      offer: true,
      onboardingTasks: true,
      joiningDetails: true,
    },
  });

  // Lazily expire overdue items so the candidate never sees stale actions.
  for (const inv of app.assessmentInvites) {
    if (inv.status === "INVITED" && inv.dueAt < now) {
      await prisma.assessmentInvite.update({ where: { id: inv.id }, data: { status: "EXPIRED" } });
      inv.status = "EXPIRED";
    }
  }
  if (app.offer?.status === "SENT" && app.offer.respondBy < now) {
    await prisma.offer.update({ where: { id: app.offer.id }, data: { status: "EXPIRED" } });
    app.offer.status = "EXPIRED";
  }

  const publicEvents = app.events.filter((e) => e.visibility === "PUBLIC");
  const internalStageChanges = app.events.filter((e) => e.visibility === "INTERNAL" && e.type === "stage_changed");
  const closed = (CLOSED_STAGES as readonly string[]).includes(app.stage) || app.offer?.status === "DECLINED";

  let reachedStage: ApplicationStage = app.stage;
  if ((CLOSED_STAGES as readonly string[]).includes(app.stage)) {
    const last = internalStageChanges.find((e) => (e.data as { to?: string } | null)?.to === app.stage);
    reachedStage = ((last?.data as { from?: ApplicationStage } | null)?.from ?? "SUBMITTED") as ApplicationStage;
  }

  const reachedAt: Partial<Record<MilestoneKey, string>> = {};
  for (const e of [...publicEvents].reverse()) {
    const m = MILESTONE_EVENT[e.type as PublicEventType];
    if (m && !reachedAt[m]) reachedAt[m] = e.createdAt.toISOString();
  }
  const hasAssessment = Boolean(app.job.assessmentTemplateId) || app.assessmentInvites.length > 0;
  const track = buildTrack(reachedStage, hasAssessment, reachedAt, app.stage === "HIRED");

  const pendingInvite = app.assessmentInvites.find(
    (i) => (i.status === "INVITED" || i.status === "IN_PROGRESS") && i.dueAt > now && (!i.scheduledSlotStart || i.emailSentAt !== null),
  );
  const toBook = app.interviewRounds.find((r) => r.status === "AWAITING_BOOKING");
  const upcoming = app.interviewRounds.find((r) => r.status === "SCHEDULED" && r.scheduledEnd && r.scheduledEnd > now);
  const requiredOpenTasks = app.onboardingTasks.filter((t) => t.required && (t.status === "PENDING" || t.status === "REJECTED"));
  const startDate = app.joiningDetails?.startDate.toISOString() ?? null;

  let nextAction: NextAction;
  if (app.stage === "DRAFT") nextAction = { type: "COMPLETE_APPLICATION" };
  else if (app.stage === "WITHDRAWN") nextAction = { type: "CLOSED", reason: "WITHDRAWN" };
  else if (app.stage === "NOT_SELECTED") nextAction = { type: "CLOSED", reason: "NOT_SELECTED" };
  else if (app.offer?.status === "DECLINED") nextAction = { type: "CLOSED", reason: "OFFER_DECLINED" };
  else if (app.stage === "HIRED") nextAction = { type: "READY_TO_START", startDate };
  else if (app.stage === "ONBOARDING")
    nextAction = requiredOpenTasks.length
      ? { type: "COMPLETE_ONBOARDING", pending: requiredOpenTasks.length, startDate }
      : { type: "READY_TO_START", startDate };
  else if (app.offer?.status === "SENT") nextAction = { type: "RESPOND_TO_OFFER", respondBy: app.offer.respondBy.toISOString() };
  else if (pendingInvite)
    nextAction = {
      type: "TAKE_ASSESSMENT",
      inviteId: pendingInvite.id,
      dueAt: pendingInvite.dueAt.toISOString(),
      title: pendingInvite.template.title,
      durationMinutes: pendingInvite.template.durationMinutes,
    };
  else if (toBook)
    nextAction = {
      type: "BOOK_INTERVIEW",
      roundId: toBook.id,
      title: toBook.title,
      durationMinutes: toBook.durationMinutes,
      bookByAt: toBook.bookByAt?.toISOString() ?? null,
    };
  else if (upcoming)
    nextAction = {
      type: "ATTEND_INTERVIEW",
      roundId: upcoming.id,
      title: upcoming.title,
      startsAt: upcoming.scheduledStart!.toISOString(),
      endsAt: upcoming.scheduledEnd!.toISOString(),
    };
  else if (app.stage === "ASSESSMENT" && app.assessmentInvites.some((i) => i.status === "SUBMITTED"))
    nextAction = { type: "AWAIT_ASSESSMENT_REVIEW" };
  else if (app.stage === "SUBMITTED" || app.stage === "IN_REVIEW") nextAction = { type: "AWAIT_REVIEW" };
  else nextAction = { type: "AWAIT_DECISION" };

  const visibleOffer = app.offer && app.offer.status !== "DRAFT" && app.offer.status !== "WITHDRAWN" ? app.offer : null;
  const assessment: SectionAvailability | "none" = !hasAssessment
    ? "none"
    : app.assessmentInvites.length === 0
      ? "locked"
      : app.assessmentInvites.every((i) => i.status !== "INVITED" && i.status !== "IN_PROGRESS")
        ? "done"
        : "available";
  const interviews: SectionAvailability =
    app.interviewRounds.length === 0
      ? "locked"
      : app.interviewRounds.every((r) => r.status === "COMPLETED" || r.status === "CANCELLED")
        ? "done"
        : "available";
  const offer: SectionAvailability = !visibleOffer ? "locked" : visibleOffer.status === "SENT" ? "available" : "done";
  const onboardingOpen = app.stage === "ONBOARDING" || app.stage === "HIRED";
  const onboarding: SectionAvailability = !onboardingOpen ? "locked" : requiredOpenTasks.length === 0 ? "done" : "available";

  const events: PublicEvent[] = publicEvents.map((e) => ({
    id: e.id,
    type: e.type as PublicEventType,
    data: (e.data as Record<string, unknown>) ?? null,
    createdAt: e.createdAt.toISOString(),
  }));

  return {
    id: app.id,
    reference: app.reference,
    stage: app.stage,
    closed,
    job: {
      id: app.job.id,
      title: app.job.title,
      location: app.job.location,
      employmentType: app.job.employmentType,
      department: app.job.department,
    },
    submittedAt: app.submittedAt?.toISOString() ?? null,
    track,
    nextAction,
    events,
    recruiter: recruiterDto(app.recruiter, app.tenantId),
    sections: { assessment, interviews, offer, onboarding },
    badges: {
      assessment: pendingInvite ? 1 : 0,
      interviews: app.interviewRounds.filter((r) => r.status === "AWAITING_BOOKING").length,
      offer: app.offer?.status === "SENT" ? 1 : 0,
      onboarding: onboardingOpen ? requiredOpenTasks.length : 0,
    },
  };
}
