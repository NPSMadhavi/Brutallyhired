/** Mirrors of the Prisma enums, usable in the browser. Keep in sync with packages/db/prisma/schema.prisma. */
export const AUTH_PROVIDERS = ["GOOGLE", "MICROSOFT", "LINKEDIN", "EMAIL"] as const;
export type AuthProviderKey = (typeof AUTH_PROVIDERS)[number];
export const OIDC_PROVIDERS = ["GOOGLE", "MICROSOFT", "LINKEDIN"] as const;
export type OidcProviderKey = (typeof OIDC_PROVIDERS)[number];

export const EXPERIENCE_BANDS = ["LT_2", "Y2_5", "Y6_10", "GT_10"] as const;
export type ExperienceBandKey = (typeof EXPERIENCE_BANDS)[number];

export const NOTICE_PERIODS = ["IMMEDIATE", "D15", "D30", "D60", "D90", "OVER_90"] as const;
export type NoticePeriodKey = (typeof NOTICE_PERIODS)[number];

export const APPLICATION_STAGES = [
  "DRAFT", "SUBMITTED", "IN_REVIEW", "ASSESSMENT", "INTERVIEW", "OFFER", "ONBOARDING", "HIRED", "NOT_SELECTED", "WITHDRAWN",
] as const;
export type ApplicationStageKey = (typeof APPLICATION_STAGES)[number];
export const CLOSED_STAGES: readonly ApplicationStageKey[] = ["NOT_SELECTED", "WITHDRAWN"];

export const QUESTION_TYPES = ["TEXT", "SINGLE_CHOICE", "NUMBER"] as const;
export type QuestionTypeKey = (typeof QUESTION_TYPES)[number];

export const ASSESSMENT_QUESTION_TYPES = ["SINGLE_CHOICE", "MULTI_CHOICE", "TEXT"] as const;
export type AssessmentQuestionTypeKey = (typeof ASSESSMENT_QUESTION_TYPES)[number];

export const INVITE_STATUSES = ["INVITED", "IN_PROGRESS", "SUBMITTED", "EXPIRED", "CANCELLED"] as const;
export type InviteStatusKey = (typeof INVITE_STATUSES)[number];

export const INTERVIEW_STATUSES = ["AWAITING_BOOKING", "SCHEDULED", "COMPLETED", "CANCELLED"] as const;
export type InterviewStatusKey = (typeof INTERVIEW_STATUSES)[number];

export const OFFER_STATUSES = ["DRAFT", "SENT", "ACCEPTED", "DECLINED", "WITHDRAWN", "EXPIRED"] as const;
export type OfferStatusKey = (typeof OFFER_STATUSES)[number];

export const ONBOARDING_STATUSES = ["PENDING", "SUBMITTED", "VERIFIED", "REJECTED"] as const;
export type OnboardingStatusKey = (typeof ONBOARDING_STATUSES)[number];

export const STAFF_ROLES = ["ADMIN", "RECRUITER", "INTERVIEWER"] as const;
export type StaffRoleKey = (typeof STAFF_ROLES)[number];

export const REQUIREMENT_KINDS = ["HARD", "PREFERRED"] as const;
export const OVERRIDE_DECISIONS = ["ADVANCE", "HOLD", "NOT_SELECTED"] as const;
export const CAPTURE_KINDS = ["CAMERA", "SCREEN"] as const;
export type CaptureKindKey = (typeof CAPTURE_KINDS)[number];

/** Proctoring signals the browser can report. Reviewed by people; never shown to the candidate. */
export const PROCTORING_EVENT_TYPES = [
  "session_started", "camera_denied", "camera_ended", "screen_denied", "screen_ended", "screen_not_monitor",
  "tab_hidden", "tab_visible", "window_blur", "window_focus", "fullscreen_exit", "fullscreen_enter",
  "copy", "paste", "multiple_displays", "network_offline", "network_online", "session_submitted",
] as const;
export type ProctoringEventType = (typeof PROCTORING_EVENT_TYPES)[number];

/** Candidate-visible milestones. */
export const MILESTONES = ["APPLIED", "IN_REVIEW", "ASSESSMENT", "INTERVIEWS", "OFFER", "ONBOARDING", "FIRST_DAY"] as const;
export type MilestoneKey = (typeof MILESTONES)[number];

/** Public event types; the client renders them through i18n. */
export const PUBLIC_EVENT_TYPES = [
  "application_submitted", "review_started", "assessment_invited", "assessment_submitted",
  "interview_invited", "interview_booked", "interview_rescheduled", "interview_completed",
  "offer_sent", "offer_accepted", "offer_declined", "onboarding_started", "onboarding_document_verified",
  "onboarding_document_rejected", "joining_details_shared", "application_withdrawn", "application_closed", "hired",
] as const;
export type PublicEventType = (typeof PUBLIC_EVENT_TYPES)[number];

export const NOTIFICATION_TYPES = PUBLIC_EVENT_TYPES;
export type NotificationType = PublicEventType;

export const ACCEPTED_RESUME_MIME = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/rtf",
  "text/rtf",
] as const;
export const ACCEPTED_DOCUMENT_MIME = ["application/pdf", "image/jpeg", "image/png"] as const;
