import { z } from "zod";
import { emailSchema } from "./common.js";

export const emailCodeRequestSchema = z.object({ email: emailSchema });
export type EmailCodeRequest = z.infer<typeof emailCodeRequestSchema>;

export const emailCodeVerifySchema = z.object({
  email: emailSchema,
  code: z.string().trim().regex(/^\d{6}$/),
});
export type EmailCodeVerify = z.infer<typeof emailCodeVerifySchema>;

/** Relative in-app paths only — prevents open redirects. */
export const returnToSchema = z
  .string()
  .max(512)
  .regex(/^\/(?!\/)[\w\-./?=&%:]*$/)
  .default("/");
