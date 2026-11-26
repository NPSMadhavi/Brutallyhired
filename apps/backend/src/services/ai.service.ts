import { resumeSummarySchema, type ResumeSummary } from "@verity/shared";
import { aiEnabled, env } from "../config/env.js";
import { logger } from "../utils/logger.js";

const DEFAULT_TIMEOUT_MS = 120_000;

function cleanJsonText(raw: string): string {
  let s = raw.trim();
  const fenceMatch = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch && fenceMatch[1]) return fenceMatch[1].trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "");
    s = s.replace(/\s*```$/, "");
  }
  return s.trim();
}

export interface AiChatOptions {
  message: string;
  systemPrompt?: string;
  temperature?: number;
  timeoutMs?: number;
}

/**
 * Universal caller for AI gateway / OpenAI-compatible / Qwen LLM server.
 * Supports Central AI Platform Gateway (/api/v1/chat) and OpenAI (/chat/completions).
 */
export async function callAiChat({
  message,
  systemPrompt,
  temperature = 0,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: AiChatOptions): Promise<string | null> {
  if (!aiEnabled || !env.AI_BASE_URL) return null;

  const baseUrl = env.AI_BASE_URL.replace(/\/$/, "");
  const apiKey = env.AI_API_KEY || "";
  const model = env.AI_MODEL || "qwen3.5:9b";

  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(apiKey ? { "x-api-key": apiKey, authorization: `Bearer ${apiKey}` } : {}),
  };

  const combinedMessage = systemPrompt
    ? `${systemPrompt}\n\nTask / Input:\n${message}`
    : message;

  // 1. Try Central AI Platform Gateway /api/v1/chat
  try {
    const res = await fetch(`${baseUrl}/api/v1/chat`, {
      method: "POST",
      headers,
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        message: combinedMessage,
        prompt: combinedMessage,
        model,
        stream: false,
        ...(systemPrompt ? { system_prompt: systemPrompt } : {}),
      }),
    });

    if (res.ok) {
      const data = (await res.json()) as { response?: string; message?: string; content?: string };
      const reply = data.response ?? data.message ?? data.content;
      if (typeof reply === "string" && reply.trim().length > 0) {
        return reply.trim();
      }
    }
  } catch (err) {
    logger.debug({ err }, "Gateway /api/v1/chat call failed, checking fallback endpoints");
  }

  // 2. Fallback: OpenAI-compatible /v1/chat/completions or /chat/completions
  for (const path of ["/v1/chat/completions", "/chat/completions"]) {
    try {
      const messages = [
        ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
        { role: "user", content: message },
      ];

      const res = await fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers,
        signal: AbortSignal.timeout(timeoutMs),
        body: JSON.stringify({
          model,
          temperature,
          messages,
        }),
      });

      if (res.ok) {
        const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const content = body.choices?.[0]?.message?.content;
        if (content && content.trim().length > 0) {
          return content.trim();
        }
      }
    } catch (err) {
      logger.debug({ err, path }, "OpenAI format chat completion fallback failed");
    }
  }

  return null;
}

/**
 * Call AI and safely parse JSON response.
 */
export async function callAiJson<T>(options: AiChatOptions): Promise<T | null> {
  const raw = await callAiChat(options);
  if (!raw) return null;

  try {
    const cleaned = cleanJsonText(raw);
    return JSON.parse(cleaned) as T;
  } catch (err) {
    logger.warn({ err, raw }, "Failed to parse AI JSON response");
    // Attempt relaxed regex extraction of first { ... } or [ ... ]
    try {
      const match = raw.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
      if (match) {
        return JSON.parse(match[0]) as T;
      }
    } catch {}
    return null;
  }
}

const RESUME_EXTRACTION_SYSTEM_PROMPT = `You are an expert HR AI resume parser for Brutallyhired.
Your mission is to read the candidate's CV and accurately extract job-related facts into structured JSON.

Return ONLY valid JSON matching this schema:
{
  "currentRole": "string (most recent job title or specialization)",
  "totalExperience": "string (e.g. '1.8 years', '3 years')",
  "education": ["array of degree titles with universities or colleges"],
  "skills": ["array of individual technical and professional skills, e.g. React, TypeScript, Node.js, PostgreSQL"],
  "certifications": ["array of professional certifications"]
}

Strict Rules:
- Only include facts written in the CV. Do not invent or embellish.
- Never include or infer age, date of birth, gender, marital status, religion, caste, ethnicity, nationality, health, disability, or photos.
- Output ONLY pure JSON.`;

/**
 * Extracts and structures facts from a candidate's CV using Qwen AI,
 * with intelligent fallback heuristics to guarantee continuous extraction.
 */
export async function extractAndSummariseResume(text: string): Promise<ResumeSummary | null> {
  const cleanText = text.trim();
  if (!cleanText) return null;

  const normalizeList = (items: any, maxCount: number, maxLen = 120): string[] => {
    if (!items) return [];
    const arr = Array.isArray(items) ? items : [items];
    return arr
      .map((item: any) => {
        if (typeof item === "string") return item.trim();
        if (item && typeof item === "object") {
          const vals = Object.values(item).filter((v) => typeof v === "string" || typeof v === "number");
          return vals.join(" - ").trim();
        }
        return "";
      })
      .filter((s: string) => s.length > 0)
      .map((s: string) => s.slice(0, maxLen))
      .slice(0, maxCount);
  };

  if (aiEnabled) {
    try {
      const parsed = await callAiJson<any>({
        message: cleanText.slice(0, 3000),
        systemPrompt: RESUME_EXTRACTION_SYSTEM_PROMPT,
        temperature: 0,
        timeoutMs: 20_000,
      });

      if (parsed && typeof parsed === "object") {
        const candidateSummary = {
          currentRole: typeof parsed.currentRole === "string" ? parsed.currentRole.trim().slice(0, 200) : undefined,
          totalExperience: typeof parsed.totalExperience === "string" ? parsed.totalExperience.trim().slice(0, 100) : undefined,
          education: normalizeList(parsed.education, 10, 200),
          skills: normalizeList(parsed.skills, 60, 60),
          certifications: normalizeList(parsed.certifications, 20, 120),
        };

        const valid = resumeSummarySchema.safeParse(candidateSummary);
        if (valid.success && (valid.data.skills.length > 0 || valid.data.currentRole || valid.data.totalExperience)) {
          return valid.data;
        }
      }
    } catch (err) {
      logger.warn({ err }, "Resume summarisation with AI failed, applying heuristic fallback");
    }
  }

  // Heuristic rule-based fallback from extracted text
  return extractHeuristicResume(cleanText);
}

/**
 * Fast regex/pattern extractor for CV text when LLM is unavailable or times out.
 */
export function extractHeuristicResume(text: string): ResumeSummary {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  // 1. Current role
  let currentRole: string | undefined;
  const roleKeywords = ["developer", "engineer", "designer", "manager", "intern", "lead", "architect", "analyst", "consultant"];
  for (const line of lines.slice(0, 15)) {
    const lower = line.toLowerCase();
    if (roleKeywords.some((k) => lower.includes(k)) && line.length < 80 && !lower.includes("experience") && !lower.includes("summary")) {
      currentRole = line;
      break;
    }
  }

  // 2. Total experience
  let totalExperience: string | undefined;
  const expMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:\+)?\s*(?:years?|yrs?|months?)\s*(?:of)?\s*(?:experience|exp)/i)
    || text.match(/(?:experience|exp)[\s:]+(\d+(?:\.\d+)?)\s*(?:\+)?\s*(?:years?|yrs?)/i);
  if (expMatch) {
    totalExperience = `${expMatch[1]} years`;
  }

  // 3. Skills extraction
  const commonTech = [
    "JavaScript", "TypeScript", "React", "Node.js", "Express", "Python", "Java", "C++", "C#", "C",
    "PostgreSQL", "MySQL", "MongoDB", "Redis", "Docker", "Kubernetes", "AWS", "Azure", "GCP",
    "Git", "GitHub", "HTML", "CSS", "Tailwind", "REST", "GraphQL", "Next.js", "Vue", "Angular",
    "Linux", "Power BI", "Excel", "NLP", "Machine Learning", "FastAPI", "Django", "Flask", "SQL"
  ];
  const skillsFound = new Set<string>();
  for (const tech of commonTech) {
    const escaped = tech.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "i");
    if (regex.test(text)) {
      skillsFound.add(tech);
    }
  }

  // 4. Education
  const eduFound: string[] = [];
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (
      (lower.includes("bachelor") || lower.includes("b.tech") || lower.includes("b.e") || lower.includes("master") || lower.includes("m.tech") || lower.includes("degree") || lower.includes("diploma") || lower.includes("intermediate") || lower.includes("cbse") || lower.includes("university") || lower.includes("college"))
      && line.length < 150
    ) {
      if (!eduFound.includes(line)) eduFound.push(line);
      if (eduFound.length >= 5) break;
    }
  }

  return {
    currentRole: currentRole || "Software Engineer",
    totalExperience: totalExperience || "1-2 years",
    education: eduFound.slice(0, 5),
    skills: Array.from(skillsFound).slice(0, 30),
    certifications: [],
  };
}

export interface AiRequirementEval {
  requirementId: string;
  matched: boolean;
  evidence: string | null;
  reasoning: string | null;
}

export interface AiEvaluationResult {
  totalScore: number;
  hardScore: number;
  preferredScore: number;
  executiveSummary: string;
  strengths: string[];
  missingOrWeakSkills: string[];
  requirementsEvaluation: AiRequirementEval[];
}

const EVALUATION_SYSTEM_PROMPT = `You are the Brutallyhired AI Evaluation Engine.
Your task is to objectively evaluate a candidate's CV against the job description and specific requirements.

Rules:
1. Rely ONLY on factual evidence present in the CV text and candidate answers.
2. Ignore all protected personal attributes (age, gender, ethnicity, location, etc.).
3. Return ONLY a valid JSON object with this exact structure:
{
  "totalScore": 85,
  "hardScore": 80,
  "preferredScore": 90,
  "executiveSummary": "2-3 sentences concise professional evaluation summary.",
  "strengths": ["Key technical strength 1", "Key technical strength 2"],
  "missingOrWeakSkills": ["Any missing hard requirement or gap"],
  "requirementsEvaluation": [
    {
      "requirementId": "string (matching requirement id)",
      "matched": true,
      "evidence": "Exact quote or summarized evidence from CV",
      "reasoning": "Brief justification"
    }
  ]
}`;

/**
 * Deep AI evaluation of candidate against job requirements.
 */
export async function evaluateCandidateWithAi(input: {
  jobTitle: string;
  jobDescription?: string;
  requirements: Array<{ id: string; label: string; kind: string; weight: number }>;
  questions?: Array<{ id: string; prompt: string; required: boolean }>;
  answers?: Array<{ questionId: string; value: any }>;
  resumeText: string;
  resumeSummary?: ResumeSummary | null;
}): Promise<AiEvaluationResult | null> {
  if (!aiEnabled) return null;

  try {
    const formattedReqs = input.requirements.map((r) => ({
      id: r.id,
      label: r.label,
      kind: r.kind,
      weight: r.weight,
    }));

    const formattedAnswers = (input.answers || []).map((a) => {
      const q = input.questions?.find((q) => q.id === a.questionId);
      return {
        question: q?.prompt || a.questionId,
        answer: a.value,
      };
    });

    const userMessage = [
      `Target Role: ${input.jobTitle}`,
      input.jobDescription ? `Job Description: ${input.jobDescription}` : "",
      `\nJob Requirements to Evaluate:`,
      JSON.stringify(formattedReqs, null, 2),
      formattedAnswers.length > 0 ? `\nCandidate Questionnaire Answers:\n${JSON.stringify(formattedAnswers, null, 2)}` : "",
      input.resumeSummary ? `\nStructured CV Read:\n${JSON.stringify(input.resumeSummary, null, 2)}` : "",
      `\nCandidate Full CV Text:\n${input.resumeText.slice(0, 20_000)}`,
    ]
      .filter(Boolean)
      .join("\n");

    const result = await callAiJson<AiEvaluationResult>({
      message: userMessage,
      systemPrompt: EVALUATION_SYSTEM_PROMPT,
      temperature: 0,
      timeoutMs: 60_000,
    });

    if (!result || typeof result !== "object") return null;

    // Sanitize and bound scores between 0 and 100
    const totalScore = Math.max(0, Math.min(100, Math.round(Number(result.totalScore) || 75)));
    const hardScore = Math.max(0, Math.min(100, Math.round(Number(result.hardScore) || 70)));
    const preferredScore = Math.max(0, Math.min(100, Math.round(Number(result.preferredScore) || 70)));

    return {
      totalScore,
      hardScore,
      preferredScore,
      executiveSummary: String(result.executiveSummary || "").trim(),
      strengths: Array.isArray(result.strengths) ? result.strengths.map(String).slice(0, 10) : [],
      missingOrWeakSkills: Array.isArray(result.missingOrWeakSkills)
        ? result.missingOrWeakSkills.map(String).slice(0, 10)
        : [],
      requirementsEvaluation: Array.isArray(result.requirementsEvaluation)
        ? result.requirementsEvaluation.map((re) => ({
            requirementId: String(re.requirementId),
            matched: Boolean(re.matched),
            evidence: re.evidence ? String(re.evidence).trim() : null,
            reasoning: re.reasoning ? String(re.reasoning).trim() : null,
          }))
        : [],
    };
  } catch (err) {
    logger.warn({ err }, "AI candidate evaluation failed");
    return null;
  }
}

export interface GeneratedMcqQuestion {
  prompt: string;
  options: string[];
  correctOptionIndex: number;
  points: number;
  category: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
}

export interface GeneratedAssessment {
  title: string;
  topics: string[];
  durationMinutes: number;
  questions: GeneratedMcqQuestion[];
}

const ASSESSMENT_GENERATION_PROMPT = `You are an elite Technical Assessment Architect for Brutallyhired HRMS.
Your task is to analyze the Job Title, Job Description, and Candidate's verified Skills and Experience to generate a tailored technical MCQ examination.

Requirements:
1. Target the intersection of the role requirements and the candidate's reported skillset.
2. Calibrate difficulty to the candidate's stated years of experience.
3. Generate practical, real-world questions with 4 distinct options and one clear correct answer.
4. Output ONLY valid JSON matching this exact structure:
{
  "title": "Title of the Assessment",
  "topics": ["Topic 1", "Topic 2", "Topic 3"],
  "durationMinutes": 45,
  "questions": [
    {
      "prompt": "Clear, practical technical question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctOptionIndex": 0,
      "points": 20,
      "category": "Core Competency",
      "difficulty": "MEDIUM"
    }
  ]
}`;

/**
 * Automatically generates customized technical assessment MCQs for a specific candidate.
 */
export async function generateCandidateAssessmentQuestions(input: {
  jobTitle: string;
  jobDescription?: string;
  candidateName?: string;
  candidateSkills?: string[];
  candidateExperience?: string;
  candidateRole?: string;
  count?: number;
}): Promise<GeneratedAssessment | null> {
  const count = Math.max(1, Math.min(20, input.count || 5));
  const skills = (input.candidateSkills || []).slice(0, 15);
  const experience = input.candidateExperience || "1-3 years";
  const role = input.jobTitle || "Software Engineer";

  const message = [
    `Target Role: ${role}`,
    input.jobDescription ? `Job Description: ${input.jobDescription.slice(0, 2000)}` : "",
    input.candidateName ? `Candidate Name: ${input.candidateName}` : "",
    input.candidateRole ? `Candidate Recent Role: ${input.candidateRole}` : "",
    `Candidate Experience Level: ${experience}`,
    `Candidate Verified Skills: ${skills.join(", ") || "General Software Engineering"}`,
    `Please generate exactly ${count} multiple choice questions (MCQs) tailored specifically to test this candidate for this role.`,
  ]
    .filter(Boolean)
    .join("\n");

  if (aiEnabled) {
    try {
      const parsed = await callAiJson<GeneratedAssessment>({
        message,
        systemPrompt: ASSESSMENT_GENERATION_PROMPT,
        temperature: 0.2,
        timeoutMs: 60_000,
      });

      if (parsed && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
        const sanitizedQuestions: GeneratedMcqQuestion[] = parsed.questions
          .filter((q) => q && q.prompt && Array.isArray(q.options) && q.options.length >= 2)
          .map((q, idx) => ({
            prompt: String(q.prompt).trim(),
            options: q.options.map(String).slice(0, 4),
            correctOptionIndex: typeof q.correctOptionIndex === "number" ? Math.max(0, Math.min(3, q.correctOptionIndex)) : 0,
            points: Number(q.points) || Math.round(100 / count) || 20,
            category: String(q.category || skills[idx % skills.length] || "Technical Competency").trim(),
            difficulty: (["EASY", "MEDIUM", "HARD"].includes(String(q.difficulty).toUpperCase())
              ? String(q.difficulty).toUpperCase()
              : "MEDIUM") as "EASY" | "MEDIUM" | "HARD",
          }));

        if (sanitizedQuestions.length > 0) {
          return {
            title: String(parsed.title || `${role} Technical Assessment - ${input.candidateName || "Candidate"}`).trim(),
            topics: Array.isArray(parsed.topics) && parsed.topics.length > 0 ? parsed.topics.map(String) : skills.slice(0, 5),
            durationMinutes: Number(parsed.durationMinutes) || 45,
            questions: sanitizedQuestions.slice(0, count),
          };
        }
      }
    } catch (err) {
      logger.warn({ err }, "AI candidate assessment generation failed, using structured fallback");
    }
  }

  // Fallback high-quality template based on role and candidate skills
  const fallbackTopics = skills.length > 0 ? skills.slice(0, 4) : ["Architecture", "Databases", "APIs", "Performance"];
  const fallbackQuestions: GeneratedMcqQuestion[] = [
    {
      prompt: `In designing a production ${role} service with high concurrency, what strategy best prevents database connection exhaustion?`,
      options: [
        "Create a new database connection for each incoming HTTP request",
        "Use a managed connection pool with bounded max connections and queue timeouts",
        "Disable transaction isolation levels globally",
        "Store connections in local component memory",
      ],
      correctOptionIndex: 1,
      points: 20,
      category: "Architecture & Scalability",
      difficulty: "MEDIUM",
    },
    {
      prompt: `When building secure APIs with ${skills[0] || "modern web frameworks"}, how should user input be handled to eliminate injection attacks?`,
      options: [
        "Directly interpolate variables into raw queries for speed",
        "Use parameterized queries, prepared statements, and input schema validation",
        "Rely strictly on client-side form validation attributes",
        "Encode characters only during HTML rendering",
      ],
      correctOptionIndex: 1,
      points: 20,
      category: "Security & Clean Code",
      difficulty: "MEDIUM",
    },
    {
      prompt: `What HTTP response status code must a REST endpoint return when an authenticated client attempts an action they do not have RBAC permissions to execute?`,
      options: ["401 Unauthorized", "403 Forbidden", "404 Not Found", "422 Unprocessable Entity"],
      correctOptionIndex: 1,
      points: 20,
      category: "API Design Standards",
      difficulty: "EASY",
    },
    {
      prompt: `Which approach is most effective for optimizing read-heavy operations on a relational database like PostgreSQL?`,
      options: [
        "Add redundant columns to every table",
        "Implement read replicas and strategic composite indexing based on query patterns",
        "Run VACUUM FULL every 5 minutes",
        "Avoid using foreign keys altogether",
      ],
      correctOptionIndex: 1,
      points: 20,
      category: "Database Engineering",
      difficulty: "MEDIUM",
    },
    {
      prompt: `In modern asynchronous JavaScript/TypeScript backend services, what occurs if an unhandled promise rejection is triggered?`,
      options: [
        "The runtime silently ignores the error and continues",
        "The Node.js process terminates with a non-zero exit code unless an unhandledRejection listener is registered",
        "The server hardware restarts",
        "The request automatically retries indefinitely",
      ],
      correctOptionIndex: 1,
      points: 20,
      category: "Runtime & Error Handling",
      difficulty: "MEDIUM",
    },
  ];

  return {
    title: `${role} Technical Assessment - ${input.candidateName || "Candidate"}`,
    topics: fallbackTopics,
    durationMinutes: 45,
    questions: fallbackQuestions.slice(0, count),
  };
}
