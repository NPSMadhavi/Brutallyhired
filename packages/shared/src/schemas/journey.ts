import { z } from "zod";
import { PROCTORING_EVENT_TYPES } from "../enums.js";
import { idSchema, isoDateTime } from "./common.js";

export const assessmentAnswersSchema = z.object({
  answers: z.record(idSchema, z.union([z.array(z.number().int().min(0)).max(20), z.string().max(8000)])),
});
export type AssessmentAnswersInput = z.infer<typeof assessmentAnswersSchema>;

export const proctoringEventsSchema = z.object({
  events: z
    .array(
      z.object({
        type: z.enum(PROCTORING_EVENT_TYPES),
        at: isoDateTime,
        detail: z.record(z.string(), z.union([z.string().max(200), z.number(), z.boolean()])).optional(),
      }),
    )
    .min(1)
    .max(200),
});
export type ProctoringEventsInput = z.infer<typeof proctoringEventsSchema>;

export const bookSlotSchema = z.object({ slotId: idSchema });
export const rescheduleRequestSchema = z.object({ message: z.string().trim().min(5).max(1000) });

export const acceptOfferSchema = z.object({
  signatureName: z.string().trim().min(2).max(120),
  agree: z.literal(true),
});
export type AcceptOfferInput = z.infer<typeof acceptOfferSchema>;

export const declineOfferSchema = z.object({ reason: z.string().trim().max(500).optional() });
export type DeclineOfferInput = z.infer<typeof declineOfferSchema>;
