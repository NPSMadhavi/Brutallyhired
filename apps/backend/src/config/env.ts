import { z } from "zod";

const bool = z.enum(["true", "false"]).transform((v) => v === "true");
const optional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined));

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().default(4000),
  WEB_ORIGIN: z.string().url(),
  ADMIN_ORIGIN: z.string().url().default("http://localhost:5174"),
  API_ORIGIN: z.string().url(),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(14),
  DATABASE_URL: z.string().min(1),

  GOOGLE_CLIENT_ID: optional,
  GOOGLE_CLIENT_SECRET: optional,
  MICROSOFT_CLIENT_ID: optional,
  MICROSOFT_CLIENT_SECRET: optional,
  MICROSOFT_TENANT: z.string().default("common"),
  LINKEDIN_CLIENT_ID: optional,
  LINKEDIN_CLIENT_SECRET: optional,

  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int(),
  SMTP_SECURE: bool.default("false"),
  SMTP_USER: optional,
  SMTP_PASSWORD: optional,
  EMAIL_FROM: z.string().min(3),
  EMAIL_CODE_TTL_MINUTES: z.coerce.number().int().min(3).max(60).default(10),

  STORAGE_DIR: z.string().default("./storage"),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(5),
  MAX_ONBOARDING_UPLOAD_MB: z.coerce.number().positive().default(10),
  MAX_RECORDING_CHUNK_MB: z.coerce.number().positive().default(25),

  LIVEKIT_URL: z.string().min(1),
  LIVEKIT_API_KEY: z.string().min(1),
  LIVEKIT_API_SECRET: z.string().min(1),
  INTERVIEW_JOIN_EARLY_MINUTES: z.coerce.number().int().min(0).default(10),
  INTERVIEW_JOIN_LATE_MINUTES: z.coerce.number().int().min(0).default(15),

  AI_BASE_URL: optional,
  AI_API_KEY: optional,
  AI_MODEL: optional,
  SCORING_RUBRIC_VERSION: z.string().default("rubric-v1"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
export const aiEnabled = Boolean(env.AI_BASE_URL && env.AI_API_KEY && env.AI_MODEL);
