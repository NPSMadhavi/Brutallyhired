import type {
  FileObject,
  InterviewPanelist,
  InterviewRound,
  InterviewSlot,
  Job,
  JobQuestion,
  JoiningDetails,
  Offer,
  OnboardingTask,
  StaffMembership,
  User,
} from "@verity/db";
import type { FileMeta, InterviewRoundDto, JobPublic, JoiningDetailsDto, OfferDto, OnboardingDto } from "@verity/shared";
import { env } from "../config/env.js";
import { addMs, iso, minutes } from "../utils/time.js";

export const fileMeta = (f: FileObject | null | undefined): FileMeta | null =>
  f ? { id: f.id, name: f.originalName, sizeBytes: f.sizeBytes, mimeType: f.mimeType, createdAt: f.createdAt.toISOString() } : null;

export const jobPublic = (job: Job & { questions: JobQuestion[] }): JobPublic => ({
  id: job.id,
  externalRef: job.externalRef,
  title: job.title,
  department: job.department,
  location: job.location,
  employmentType: job.employmentType,
  workplaceType: job.workplaceType,
  experienceText: job.experienceText,
  summary: job.summary,
  hasAssessment: Boolean(job.assessmentTemplateId),
  questions: [...job.questions]
    .sort((a, b) => a.order - b.order)
    .map((q) => ({ id: q.id, prompt: q.prompt, helpText: q.helpText, type: q.type, options: q.options, required: q.required })),
});

export function interviewDto(
  round: InterviewRound & { panelists: InterviewPanelist[]; slots: InterviewSlot[] },
  totalRounds: number,
  now = new Date(),
): InterviewRoundDto {
  const bookable = round.status === "AWAITING_BOOKING" || round.status === "SCHEDULED";
  return {
    id: round.id,
    sequence: round.sequence,
    totalRounds,
    title: round.title,
    description: round.description,
    preparation: round.preparation,
    durationMinutes: round.durationMinutes,
    status: round.status,
    bookByAt: iso(round.bookByAt),
    scheduledStart: iso(round.scheduledStart),
    scheduledEnd: iso(round.scheduledEnd),
    panelists: round.panelists.map((p) => ({ name: p.name, title: p.title })),
    slots: bookable
      ? round.slots
          .filter((s) => !s.bookedAt && s.startsAt > addMs(now, minutes(60)))
          .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
          .map((s) => ({ id: s.id, startsAt: s.startsAt.toISOString(), endsAt: s.endsAt.toISOString() }))
      : [],
    joinOpensAt: round.scheduledStart ? addMs(round.scheduledStart, -minutes(env.INTERVIEW_JOIN_EARLY_MINUTES)).toISOString() : null,
    joinClosesAt: round.scheduledEnd ? addMs(round.scheduledEnd, minutes(env.INTERVIEW_JOIN_LATE_MINUTES)).toISOString() : null,
  };
}

export const joiningDto = (j: JoiningDetails | null | undefined): JoiningDetailsDto | null =>
  j
    ? {
        startDate: j.startDate.toISOString(),
        arrivalTime: j.arrivalTime,
        location: j.location,
        contactName: j.contactName,
        contactTitle: j.contactTitle,
        whatToBring: j.whatToBring,
        notes: j.notes,
      }
    : null;

export const recruiterDto = (u: (User & { staff: StaffMembership[] }) | null, tenantId: string) =>
  u ? { name: u.displayName, title: u.staff.find((s) => s.tenantId === tenantId)?.title ?? null, email: u.email } : null;

export const offerDto = (o: Offer, letter: FileObject | null, recruiter: OfferDto["recruiter"]): OfferDto => ({
  id: o.id,
  status: o.status,
  terms: Array.isArray(o.terms) ? (o.terms as { label: string; value: string }[]) : [],
  message: o.message,
  letter: fileMeta(letter),
  respondBy: o.respondBy.toISOString(),
  sentAt: iso(o.sentAt),
  respondedAt: iso(o.respondedAt),
  signatureName: o.signatureName,
  recruiter,
});

export const onboardingDto = (tasks: (OnboardingTask & { file: FileObject | null })[], joining: JoiningDetails | null): OnboardingDto => ({
  tasks: [...tasks]
    .sort((a, b) => a.order - b.order)
    .map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      required: t.required,
      status: t.status,
      reviewerNote: t.status === "REJECTED" ? t.reviewerNote : null,
      file: fileMeta(t.file),
      submittedAt: iso(t.submittedAt),
    })),
  joining: joiningDto(joining),
});
