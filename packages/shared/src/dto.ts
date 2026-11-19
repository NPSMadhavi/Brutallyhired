import type {
  ApplicationStageKey, AssessmentQuestionTypeKey, AuthProviderKey, ExperienceBandKey, InterviewStatusKey, InviteStatusKey,
  MilestoneKey, NoticePeriodKey, OfferStatusKey, OnboardingStatusKey, PublicEventType, QuestionTypeKey, StaffRoleKey,
} from "./enums.js";
import type { MilestoneState } from "./journey.js";
import type { ResumeSummary } from "./schemas/candidate.js";

export interface ApiErrorBody {
  error: { code: string; message?: string; fields?: Record<string, string[]> };
}

export interface TenantPublic {
  slug: string;
  name: string;
  logoUrl: string | null;
  brandColor: string;
  careersUrl: string | null;
  privacyNoticeUrl: string | null;
  termsUrl: string | null;
  supportEmail: string | null;
  timezone: string;
  talentPoolMonths: number;
}

export interface SessionUser {
  id: string;
  email: string;
  emailVerified: boolean;
  displayName: string | null;
  identities: { provider: AuthProviderKey; email: string | null; createdAt: string }[];
  staffOf: { tenantSlug: string; role: StaffRoleKey }[];
}

export interface LinkIntentDto {
  id: string;
  provider: AuthProviderKey;
  email: string;
  existingProviders: AuthProviderKey[];
}

export interface FileMeta {
  id: string;
  name: string;
  sizeBytes: number;
  mimeType: string;
  createdAt: string;
}

export interface JobPublic {
  id: string;
  externalRef: string;
  title: string;
  department: string | null;
  location: string;
  employmentType: string;
  workplaceType: string | null;
  experienceText: string | null;
  summary: string;
  hasAssessment: boolean;
  questions: { id: string; prompt: string; helpText: string | null; type: QuestionTypeKey; options: string[]; required: boolean }[];
}

export interface ProfileDto {
  firstName: string;
  lastName: string;
  phone: string | null;
  city: string | null;
  experience: ExperienceBandKey | null;
  noticePeriod: NoticePeriodKey | null;
}

export type ResumeReadStatus = "NONE" | "READING" | "READ" | "UNAVAILABLE";

export interface ApplicationDraftDto {
  id: string;
  reference: string;
  stage: ApplicationStageKey;
  job: JobPublic;
  profile: ProfileDto | null;
  resume: FileMeta | null;
  resumeSummary: ResumeSummary | null;
  resumeReadStatus: ResumeReadStatus;
  coverLetterText: string | null;
  coverLetterFile: FileMeta | null;
  answers: Record<string, string | number>;
}

export interface ApplicationListItem {
  id: string;
  reference: string;
  stage: ApplicationStageKey;
  jobTitle: string;
  jobLocation: string;
  submittedAt: string | null;
  updatedAt: string;
}

export interface PublicEvent {
  id: string;
  type: PublicEventType;
  data: Record<string, unknown> | null;
  createdAt: string;
}

export type NextAction =
  | { type: "COMPLETE_APPLICATION" }
  | { type: "AWAIT_REVIEW" }
  | { type: "TAKE_ASSESSMENT"; inviteId: string; dueAt: string; title: string; durationMinutes: number }
  | { type: "AWAIT_ASSESSMENT_REVIEW" }
  | { type: "BOOK_INTERVIEW"; roundId: string; title: string; durationMinutes: number; bookByAt: string | null }
  | { type: "ATTEND_INTERVIEW"; roundId: string; title: string; startsAt: string; endsAt: string }
  | { type: "AWAIT_DECISION" }
  | { type: "RESPOND_TO_OFFER"; respondBy: string }
  | { type: "COMPLETE_ONBOARDING"; pending: number; startDate: string | null }
  | { type: "READY_TO_START"; startDate: string | null }
  | { type: "CLOSED"; reason: "WITHDRAWN" | "NOT_SELECTED" | "OFFER_DECLINED" };

export type SectionAvailability = "locked" | "available" | "done";

export interface ApplicationOverview {
  id: string;
  reference: string;
  stage: ApplicationStageKey;
  closed: boolean;
  job: { id: string; title: string; location: string; employmentType: string; department: string | null };
  submittedAt: string | null;
  track: { key: MilestoneKey; state: MilestoneState; at: string | null }[];
  nextAction: NextAction;
  events: PublicEvent[];
  recruiter: { name: string | null; title: string | null; email: string } | null;
  sections: {
    assessment: SectionAvailability | "none";
    interviews: SectionAvailability;
    offer: SectionAvailability;
    onboarding: SectionAvailability;
  };
  badges: { assessment: number; interviews: number; offer: number; onboarding: number };
}

export interface AssessmentInviteDto {
  id: string;
  title: string;
  description: string | null;
  durationMinutes: number;
  proctored: boolean;
  topics: string[];
  questionCount: number;
  dueAt: string;
  status: InviteStatusKey;
  attempt: { id: string; deadlineAt: string; submittedAt: string | null } | null;
}

export interface AttemptDto {
  id: string;
  deadlineAt: string;
  serverNow: string;
  questions: { id: string; order: number; type: AssessmentQuestionTypeKey; prompt: string; options: string[] }[];
  answers: Record<string, number[] | string>;
}

export interface InterviewRoundDto {
  id: string;
  sequence: number;
  totalRounds: number;
  title: string;
  description: string | null;
  preparation: string | null;
  durationMinutes: number;
  status: InterviewStatusKey;
  bookByAt: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  panelists: { name: string; title: string | null }[];
  slots: { id: string; startsAt: string; endsAt: string }[];
  joinOpensAt: string | null;
  joinClosesAt: string | null;
}

export interface JoinTokenDto {
  url: string;
  token: string;
  roomName: string;
}

export interface JoiningDetailsDto {
  startDate: string;
  arrivalTime: string | null;
  location: string;
  contactName: string | null;
  contactTitle: string | null;
  whatToBring: string | null;
  notes: string | null;
}

export interface OfferDto {
  id: string;
  status: OfferStatusKey;
  terms: { label: string; value: string }[];
  message: string | null;
  letter: FileMeta | null;
  respondBy: string;
  sentAt: string | null;
  respondedAt: string | null;
  signatureName: string | null;
  recruiter: { name: string | null; title: string | null; email: string } | null;
}

export interface OnboardingDto {
  tasks: {
    id: string;
    title: string;
    description: string | null;
    required: boolean;
    status: OnboardingStatusKey;
    reviewerNote: string | null;
    file: FileMeta | null;
    submittedAt: string | null;
  }[];
  joining: JoiningDetailsDto | null;
}

export interface NotificationDto {
  id: string;
  type: PublicEventType;
  applicationId: string | null;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

export interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
}
