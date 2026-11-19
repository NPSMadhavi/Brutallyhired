import { prisma, type Prisma } from "@verity/db";
import { resumeSummarySchema, type ResumeSummary } from "@verity/shared";
import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import { aiEnabled, env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { storage } from "./storage.service.js";

const MAX_CHARS = 30_000;

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const c of stream) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c as string));
  return Buffer.concat(chunks);
}

function stripRtf(rtf: string) {
  return rtf
    .replace(/\\par[d]?/g, "\n")
    .replace(/\{\\\*[^{}]*\}/g, "")
    .replace(/\\'[0-9a-f]{2}/gi, "")
    .replace(/\\[a-z]+-?\d* ?/gi, "")
    .replace(/[{}]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function extractResumeText(storageKey: string, mime: string): Promise<string | null> {
  const buf = await streamToBuffer(storage.read(storageKey));
  try {
    if (mime === "application/pdf") {
      const pdf = await getDocumentProxy(new Uint8Array(buf));
      const { text } = await extractText(pdf, { mergePages: true });
      return (Array.isArray(text) ? text.join("\n") : text).slice(0, MAX_CHARS);
    }
    if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      const { value } = await mammoth.extractRawText({ buffer: buf });
      return value.slice(0, MAX_CHARS);
    }
    if (mime === "application/rtf") return stripRtf(buf.toString("latin1")).slice(0, MAX_CHARS);
  } catch (err) {
    logger.warn({ err }, "resume text extraction failed");
  }
  return null;
}

const SYSTEM_PROMPT = [
  "You extract job-related facts from a CV for a hiring team.",
  "Return JSON with keys: currentRole, totalExperience, education (array), skills (array), certifications (array).",
  "Only include facts written in the CV. Do not guess or embellish.",
  "Never include or infer age, date of birth, gender, marital status, religion, caste, ethnicity, nationality,",
  "health, disability, photographs, family details or any other personal trait.",
].join(" ");

/** Structured, job-related read of the CV via an OpenAI-compatible endpoint. */
export async function summariseResume(text: string): Promise<ResumeSummary | null> {
  if (!aiEnabled) return null;
  try {
    const res = await fetch(`${env.AI_BASE_URL!.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${env.AI_API_KEY}` },
      signal: AbortSignal.timeout(45_000),
      body: JSON.stringify({
        model: env.AI_MODEL,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: text },
        ],
      }),
    });
    if (!res.ok) throw new Error(`AI HTTP ${res.status}`);
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = body.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = resumeSummarySchema.safeParse(JSON.parse(content));
    return parsed.success ? parsed.data : null;
  } catch (err) {
    logger.warn({ err }, "resume summary failed");
    return null;
  }
}

/** Background job: read the uploaded CV and store text + summary on the application. */
export async function readResumeForApplication(applicationId: string, fileId: string, onDone: () => void) {
  try {
    const file = await prisma.fileObject.findUniqueOrThrow({ where: { id: fileId } });
    const text = await extractResumeText(file.storageKey, file.mimeType);
    const summary = text ? await summariseResume(text) : null;
    const current = await prisma.application.findUnique({ where: { id: applicationId }, select: { resumeFileId: true } });
    if (current?.resumeFileId !== fileId) return; // a newer upload replaced this one
    await prisma.application.update({
      where: { id: applicationId },
      data: {
        resumeText: text,
        resumeSummary: (summary ?? undefined) as Prisma.InputJsonValue | undefined,
        resumeReadStatus: summary ? "READ" : "UNAVAILABLE",
      },
    });
  } catch (err) {
    logger.error({ err, applicationId }, "resume read failed");
    await prisma.application.update({ where: { id: applicationId }, data: { resumeReadStatus: "UNAVAILABLE" } }).catch(() => undefined);
  } finally {
    onDone();
  }
}
