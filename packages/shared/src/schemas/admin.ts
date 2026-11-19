import { z } from "zod";
import {
  APPLICATION_STAGES, ASSESSMENT_QUESTION_TYPES, OVERRIDE_DECISIONS, QUESTION_TYPES, REQUIREMENT_KINDS, STAFF_ROLES,
} from "../enums.js";
import { emailSchema, hexColor, isoDateTime, optionalText, shortText } from "./common.js";

export const tenantSettingsSchema = z.object({
  name: shortText(120),
  logoUrl: z.string().url().max(500).nullable().optional(),
  brandColor: hexColor,
  careersUrl: z.string().url().max(500).nullable().optional(),
  privacyNoticeUrl: z.string().url().max(500).nullable().optional(),
  termsUrl: z.string().url().max(500).nullable().optional(),
  supportEmail: emailSchema.nullable().optional(),
  timezone: shortText(64),
  eligibilityThreshold: z.number().int().min(0).max(100),
  talentPoolMonths: z.number().int().min(0).max(36),
});

export const staffInviteSchema = z.object({
  email: emailSchema,
  role: z.enum(STAFF_ROLES),
  title: optionalText(120),
});

export const jobUpsertSchema = z.object({
  externalRef: shortText(80),
  title: shortText(200),
  department: optionalText(120),
  location: shortText(200),
  employmentType: shortText(80),
  workplaceType: optionalText(80),
  experienceText: optionalText(80),
  summary: shortText(8000),
  status: z.enum(["DRAFT", "OPEN", "CLOSED"]),
  assessmentTemplateId: z.string().nullable().optional(),
  requirements: z
    .array(
      z.object({
        label: shortText(200),
        kind: z.enum(REQUIREMENT_KINDS),
        keywords: z.array(shortText(60)).min(1).max(20),
        weight: z.number().int().min(1).max(10).default(1),
      }),
    )
    .max(40),
  questions: z
    .array(
      z.object({
        prompt: shortText(300),
        helpText: optionalText(300),
        type: z.enum(QUESTION_TYPES),
        options: z.array(shortText(120)).max(20).default([]),
        required: z.boolean().default(true),
      }),
    )
    .max(20),
});
export type JobUpsertInput = z.infer<typeof jobUpsertSchema>;

export const stageChangeSchema = z.object({
  stage: z.enum(APPLICATION_STAGES).exclude(["DRAFT", "SUBMITTED"]),
  note: optionalText(2000),
});

export const eligibilityOverrideSchema = z.object({
  decision: z.enum(OVERRIDE_DECISIONS),
  reason: z.string().trim().min(10).max(2000),
});

export const assessmentTemplateSchema = z.object({
  title: shortText(200),
  description: optionalText(2000),
  durationMinutes: z.number().int().min(5).max(240),
  proctored: z.boolean().default(true),
  topics: z.array(shortText(80)).max(20).default([]),
  questions: z
    .array(
      z.object({
        type: z.enum(ASSESSMENT_QUESTION_TYPES),
        prompt: shortText(4000),
        options: z.array(shortText(500)).max(10).default([]),
        correct: z.array(z.number().int().min(0)).max(10).default([]),
        points: z.number().int().min(0).max(100).default(1),
      }),
    )
    .min(1)
    .max(200),
});

export const assessmentInviteSchema = z.object({ templateId: z.string().min(1), dueAt: isoDateTime });

export const interviewRoundSchema = z.object({
  title: shortText(200),
  description: optionalText(2000),
  preparation: optionalText(2000),
  durationMinutes: z.number().int().min(10).max(480),
  bookByAt: isoDateTime.optional(),
  panelists: z.array(z.object({ name: shortText(120), title: optionalText(120), staffUserId: z.string().optional() })).max(10),
  slots: z.array(z.object({ startsAt: isoDateTime })).min(1).max(100),
});

export const offerCreateSchema = z.object({
  terms: z.array(z.object({ label: shortText(80), value: shortText(200) })).min(1).max(30),
  message: optionalText(4000),
  respondBy: isoDateTime,
  send: z.boolean().default(false),
});

export const joiningDetailsSchema = z.object({
  startDate: isoDateTime,
  arrivalTime: optionalText(40),
  location: shortText(300),
  contactName: optionalText(120),
  contactTitle: optionalText(120),
  whatToBring: optionalText(1000),
  notes: optionalText(2000),
});

export const onboardingTemplateSchema = z.object({
  items: z.array(z.object({ title: shortText(200), description: optionalText(1000), required: z.boolean().default(true) })).max(50),
});

export const onboardingReviewSchema = z.object({
  status: z.enum(["VERIFIED", "REJECTED"]),
  note: optionalText(1000),
});
