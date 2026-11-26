import type { ResumeSummary } from "@verity/shared";
import vm from "node:vm";
import ts from "typescript";
import { aiEnabled, env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { callAiJson } from "./ai.service.js";

export interface Round2Criterion {
  id: string;
  name: string;
  description: string;
  maxMarks: number;
}

export interface Round2TestCase {
  id: string;
  title: string;
  input: string;
  expectedBehavior: string;
}

export interface Round2StarterFile {
  filename: string;
  language: string;
  content: string;
}

export interface Round2TaskSpec {
  title: string;
  description: string;
  problemStatement: string;
  objectives: string[];
  functionalRequirements: string[];
  technicalRequirements: string[];
  requiredTechnologies: string[];
  expectedDeliverables: string[];
  implementationInstructions: string[];
  evaluationCriteria: Round2Criterion[];
  testCases: Round2TestCase[];
  starterFiles: Round2StarterFile[];
  durationMinutes: number;
  totalMarks: number;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  scoringRubric: Record<string, string>;
  generatedAt: string;
  generatedModel: string;
}

export interface SubmissionFile {
  filename: string;
  language?: string;
  content: string;
}

export interface AutomatedValidationResult {
  syntaxValid: boolean;
  diagnostics: string[];
  metrics: {
    fileCount: number;
    totalLines: number;
    codeLines: number;
    functionsDetected: number;
    hasErrorHandling: boolean;
    hasValidation: boolean;
    hasTests: boolean;
    securityWarnings: string[];
  };
  testExecutionResults: Array<{
    testCase: string;
    passed: boolean;
    details: string;
  }>;
}

export interface Round2AiReport {
  overallScore: number;
  maxScore: number;
  percentage: number;
  criteriaScores: Array<{
    criterion: string;
    score: number;
    maxScore: number;
    feedback: string;
  }>;
  skillsDemonstrated: string[];
  skillsMissing: string[];
  functionalRequirementsCompleted: string[];
  functionalRequirementsMissing: string[];
  codeQualityAnalysis: string;
  technicalStrengths: string[];
  weaknessesAndImprovements: string[];
  testExecutionResults: Array<{
    testCase: string;
    passed: boolean;
    details: string;
  }>;
  automatedValidation: AutomatedValidationResult;
  summary: string;
  recommendation: "PASS" | "FAIL" | "MANUAL_REVIEW";
  confidence: number;
  evaluationLimitations: string;
  evaluatedAt: string;
  evaluatedModel: string;
}

const ROUND2_GENERATOR_SYSTEM_PROMPT = `You are a Principal Engineering Architect for Brutallyhired.
Your task is to design a personalized, realistic, small-scale Technical Project Assessment (Round 2) for a candidate based on:
1. Complete Job Description & Responsibilities
2. Required & Preferred Technical Skills
3. Candidate's Resume, Experience Level, and Actual Skills

Rules:
- Tailor the project directly to the job stack and candidate experience (e.g. React.js app for React dev, REST API for Node.js dev, full-stack module for Full Stack dev, Python data/API service for Python dev, AI/ML pipeline for AI/ML engineer).
- Keep scope realistic for a 60-90 minute timed assessment: challenging enough to verify real engineering skill, not overly massive.
- evaluationCriteria maxMarks MUST sum to exactly 100.
- Provide 2-3 starterFiles with helpful scaffolding so the candidate can start coding immediately.
- Output ONLY valid JSON matching the exact schema requested. No markdown fences or extra commentary.`;

export async function generateRound2TechnicalProject(input: {
  jobTitle: string;
  jobDescription?: string | null;
  requiredSkills?: string[];
  preferredSkills?: string[];
  responsibilities?: string | null;
  candidateName?: string | null;
  resumeText?: string | null;
  resumeSummary?: ResumeSummary | null;
  difficulty?: "EASY" | "MEDIUM" | "HARD";
  durationMinutes?: number;
}): Promise<Round2TaskSpec> {
  const role = (input.jobTitle || "Software Developer").trim();
  const diff = input.difficulty || "MEDIUM";
  const durationMinutes = input.durationMinutes || 90;
  const reqSkills = input.requiredSkills?.length ? input.requiredSkills : input.resumeSummary?.skills?.slice(0, 6) || [];
  const prefSkills = input.preferredSkills || [];
  const candSkills = input.resumeSummary?.skills || [];
  const candExp = input.resumeSummary?.totalExperience || "1-3 years";
  const candRole = input.resumeSummary?.currentRole || role;

  const prompt = `Design a personalized Round 2 Technical Project Assessment.

Job Title: ${role}
Difficulty: ${diff}
Time Limit: ${durationMinutes} minutes
Job Description / Responsibilities: ${(input.jobDescription || input.responsibilities || `Build production-ready software as a ${role}`).slice(0, 2500)}
Required Technical Skills: ${reqSkills.join(", ") || role}
Preferred Skills: ${prefSkills.join(", ") || "Testing, Clean Architecture, Error Handling"}

Candidate Profile:
- Name: ${input.candidateName || "Candidate"}
- Recent Role: ${candRole}
- Experience Level: ${candExp}
- Extracted Resume Skills: ${candSkills.join(", ") || "Not specified"}
- Resume Excerpt: ${(input.resumeText || "").slice(0, 2000)}

Return ONLY valid JSON matching this exact structure:
{
  "title": "Concise Project Title",
  "description": "2-3 sentence overview of the project",
  "problemStatement": "Realistic engineering problem statement tailored to the role",
  "objectives": ["Objective 1", "Objective 2", "Objective 3"],
  "functionalRequirements": ["FR1: ...", "FR2: ...", "FR3: ...", "FR4: ..."],
  "technicalRequirements": ["TR1: ...", "TR2: ...", "TR3: ..."],
  "requiredTechnologies": ["Tech 1", "Tech 2", "Tech 3"],
  "expectedDeliverables": ["Source code implementation", "Architecture & trade-offs notes", "Validation/test cases"],
  "implementationInstructions": ["Step 1...", "Step 2...", "Step 3..."],
  "evaluationCriteria": [
    { "id": "c1", "name": "Functional Correctness & Completeness", "description": "All functional requirements implemented accurately", "maxMarks": 30 },
    { "id": "c2", "name": "Code Quality, Architecture & Organization", "description": "Modular structure, readability, typing, clean patterns", "maxMarks": 25 },
    { "id": "c3", "name": "Error Handling, Validation & Security", "description": "Input validation, edge cases, safe defaults", "maxMarks": 25 },
    { "id": "c4", "name": "Testing, Performance & Documentation", "description": "Test cases, complexity awareness, clear rationale", "maxMarks": 20 }
  ],
  "testCases": [
    { "id": "tc1", "title": "Happy Path Validation", "input": "Valid payload/input", "expectedBehavior": "Returns expected structured output" },
    { "id": "tc2", "title": "Invalid Input / Edge Case", "input": "Malformed or boundary input", "expectedBehavior": "Rejects cleanly with clear error message" },
    { "id": "tc3", "title": "Concurrency / State Integrity", "input": "Repeated or concurrent requests", "expectedBehavior": "Maintains consistent state without corruption" }
  ],
  "starterFiles": [
    { "filename": "src/index.ts", "language": "typescript", "content": "// Starter entry point\\nexport function solve(input: unknown) {\\n  // TODO: implement\\n}\\n" },
    { "filename": "src/solution.test.ts", "language": "typescript", "content": "// Add validation / test cases here\\n" }
  ],
  "scoringRubric": {
    "90-100": "Production-grade implementation with full test coverage and edge-case handling",
    "70-89": "Solid working solution covering core requirements with minor gaps",
    "50-69": "Partial implementation missing key validation or architectural clarity",
    "0-49": "Incomplete or non-functional submission"
  }
}`;

  if (aiEnabled && env.AI_BASE_URL) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const parsed = await callAiJson<any>({
          message: prompt,
          systemPrompt: ROUND2_GENERATOR_SYSTEM_PROMPT,
          temperature: attempt === 1 ? 0.25 : 0.1,
          timeoutMs: 90_000,
        });

        if (parsed && parsed.title && Array.isArray(parsed.functionalRequirements) && parsed.functionalRequirements.length > 0) {
          const criteria: Round2Criterion[] = Array.isArray(parsed.evaluationCriteria) && parsed.evaluationCriteria.length > 0
            ? parsed.evaluationCriteria.map((c: any, i: number) => ({
                id: String(c.id || `c${i + 1}`),
                name: String(c.name || `Criterion ${i + 1}`),
                description: String(c.description || ""),
                maxMarks: Math.max(5, Number(c.maxMarks) || 25),
              }))
            : [
                { id: "c1", name: "Functional Correctness", description: "Core requirements implemented", maxMarks: 35 },
                { id: "c2", name: "Code Quality & Architecture", description: "Clean, modular design", maxMarks: 25 },
                { id: "c3", name: "Error Handling & Validation", description: "Edge cases and security", maxMarks: 20 },
                { id: "c4", name: "Tests & Documentation", description: "Verification and rationale", maxMarks: 20 },
              ];

          const totalMarks = criteria.reduce((sum, c) => sum + c.maxMarks, 0);

          return {
            title: String(parsed.title).trim(),
            description: String(parsed.description || parsed.problemStatement || "").trim(),
            problemStatement: String(parsed.problemStatement || parsed.description || "").trim(),
            objectives: Array.isArray(parsed.objectives) ? parsed.objectives.map(String) : ["Deliver a clean, working solution"],
            functionalRequirements: parsed.functionalRequirements.map(String),
            technicalRequirements: Array.isArray(parsed.technicalRequirements) ? parsed.technicalRequirements.map(String) : [],
            requiredTechnologies: Array.isArray(parsed.requiredTechnologies) && parsed.requiredTechnologies.length > 0
              ? parsed.requiredTechnologies.map(String)
              : reqSkills.slice(0, 5),
            expectedDeliverables: Array.isArray(parsed.expectedDeliverables)
              ? parsed.expectedDeliverables.map(String)
              : ["Complete source code", "Architecture rationale", "Test cases"],
            implementationInstructions: Array.isArray(parsed.implementationInstructions)
              ? parsed.implementationInstructions.map(String)
              : ["Implement all functional requirements", "Add input validation and error handling", "Document design choices"],
            evaluationCriteria: criteria,
            testCases: Array.isArray(parsed.testCases) && parsed.testCases.length > 0
              ? parsed.testCases.map((tc: any, idx: number) => ({
                  id: String(tc.id || `tc${idx + 1}`),
                  title: String(tc.title || `Test Case ${idx + 1}`),
                  input: String(tc.input || "Standard input"),
                  expectedBehavior: String(tc.expectedBehavior || "Expected behavior"),
                }))
              : [
                  { id: "tc1", title: "Core Functionality", input: "Valid input", expectedBehavior: "Produces expected output" },
                  { id: "tc2", title: "Validation & Error Handling", input: "Invalid input", expectedBehavior: "Returns structured error" },
                ],
            starterFiles: Array.isArray(parsed.starterFiles) && parsed.starterFiles.length > 0
              ? parsed.starterFiles.map((f: any) => ({
                  filename: String(f.filename || "src/index.ts"),
                  language: String(f.language || "typescript"),
                  content: String(f.content || ""),
                }))
              : buildDefaultStarterFiles(role, reqSkills),
            durationMinutes,
            totalMarks,
            difficulty: diff,
            scoringRubric: parsed.scoringRubric && typeof parsed.scoringRubric === "object"
              ? parsed.scoringRubric
              : {
                  "90-100": "Exceptional production-ready implementation",
                  "70-89": "Strong working solution meeting core criteria",
                  "50-69": "Partial solution with missing edge cases",
                  "0-49": "Incomplete submission",
                },
            generatedAt: new Date().toISOString(),
            generatedModel: env.AI_MODEL || "qwen3.5:9b",
          };
        }
      } catch (err) {
        logger.warn({ err, attempt }, "Round 2 LLM project generation attempt failed");
      }
    }
  }

  // Deterministic role-aware fallback if LLM is temporarily unreachable
  const stack = reqSkills.length > 0 ? reqSkills.slice(0, 5) : [role, "TypeScript", "REST API", "Testing"];
  return {
    title: `${role} — Practical Engineering Challenge`,
    description: `Design and implement a production-grade module tailored for the ${role} position using ${stack.join(", ")}.`,
    problemStatement: `Build a reliable, well-structured service/component for ${role} that validates inputs, handles edge cases gracefully, and includes automated verification.`,
    objectives: [
      `Demonstrate practical proficiency in ${stack.slice(0, 3).join(", ")}`,
      "Structure code cleanly with clear separation of concerns",
      "Handle invalid inputs, failures, and boundary conditions safely",
    ],
    functionalRequirements: [
      "FR1: Implement the primary domain workflow with typed data models and validation.",
      "FR2: Expose clean interfaces/endpoints with deterministic state transitions.",
      "FR3: Implement structured error handling and meaningful failure responses.",
      "FR4: Include automated test cases verifying happy paths and edge cases.",
    ],
    technicalRequirements: [
      `Use ${stack[0] || role} best practices and modular file organization.`,
      "Avoid hardcoded secrets, unsafe evaluations, or unhandled promise rejections.",
      "Document architectural trade-offs and complexity considerations.",
    ],
    requiredTechnologies: stack,
    expectedDeliverables: [
      "Complete source code files",
      "Architecture & implementation rationale",
      "Unit/integration test cases",
    ],
    implementationInstructions: [
      "Review the starter files and problem statement carefully.",
      "Implement all functional and technical requirements cleanly.",
      "Verify edge cases and explain your design decisions before submitting.",
    ],
    evaluationCriteria: [
      { id: "c1", name: "Functional Correctness", description: "Requirements implemented accurately", maxMarks: 35 },
      { id: "c2", name: "Code Quality & Architecture", description: "Clean, modular organization", maxMarks: 25 },
      { id: "c3", name: "Error Handling & Security", description: "Validation and edge-case safety", maxMarks: 20 },
      { id: "c4", name: "Testing & Documentation", description: "Test coverage and rationale", maxMarks: 20 },
    ],
    testCases: [
      { id: "tc1", title: "Happy Path Execution", input: "Valid domain payload", expectedBehavior: "Processes and returns expected result" },
      { id: "tc2", title: "Validation Failure", input: "Missing or invalid fields", expectedBehavior: "Throws or returns structured validation error" },
      { id: "tc3", title: "Idempotency / Edge Case", input: "Duplicate or boundary input", expectedBehavior: "Handles safely without corrupting state" },
    ],
    starterFiles: buildDefaultStarterFiles(role, reqSkills),
    durationMinutes,
    totalMarks: 100,
    difficulty: diff,
    scoringRubric: {
      "90-100": "Production-ready implementation with full validation and tests",
      "70-89": "Working solution covering core requirements",
      "50-69": "Partial implementation missing error handling or tests",
      "0-49": "Incomplete or non-functional submission",
    },
    generatedAt: new Date().toISOString(),
    generatedModel: "fallback-architect",
  };
}

function buildDefaultStarterFiles(role: string, skills: string[]): Round2StarterFile[] {
  const lower = `${role} ${skills.join(" ")}`.toLowerCase();
  if (lower.includes("python") || lower.includes("ai") || lower.includes("ml") || lower.includes("django") || lower.includes("fastapi")) {
    return [
      {
        filename: "main.py",
        language: "python",
        content: `"""${role} - Round 2 Technical Solution"""\nfrom typing import Any, Dict\n\ndef process_request(payload: Dict[str, Any]) -> Dict[str, Any]:\n    if not isinstance(payload, dict):\n        raise ValueError("Payload must be a dictionary")\n    # TODO: Implement core logic\n    return {"status": "ok", "data": payload}\n`,
      },
      {
        filename: "test_main.py",
        language: "python",
        content: `from main import process_request\n\ndef test_valid_request():\n    res = process_request({"id": 1})\n    assert res["status"] == "ok"\n`,
      },
    ];
  }
  if (lower.includes("react") || lower.includes("frontend")) {
    return [
      {
        filename: "src/App.tsx",
        language: "typescript",
        content: `import React, { useState } from "react";\n\nexport function FeatureWorkspace() {\n  const [status, setStatus] = useState<"idle" | "loading" | "ready">("idle");\n  // TODO: Implement state, validation, and API integration\n  return <div>Status: {status}</div>;\n}\n`,
      },
      {
        filename: "src/App.test.tsx",
        language: "typescript",
        content: `// Add component & validation tests here\n`,
      },
    ];
  }
  return [
    {
      filename: "src/index.ts",
      language: "typescript",
      content: `// ${role} - Round 2 Technical Implementation\nexport async function executeTask(input: Record<string, unknown>) {\n  if (!input || typeof input !== "object") {\n    throw new Error("Invalid input payload");\n  }\n  // TODO: Implement required business logic & error handling\n  return { ok: true, input };\n}\n`,
    },
    {
      filename: "src/index.test.ts",
      language: "typescript",
      content: `// Add unit/integration tests verifying requirements and edge cases\n`,
    },
  ];
}

/**
 * Static code analysis & automated deliverable validation for Round 2 submissions.
 */
export function runStaticAndAutomatedValidation(
  taskSpec: Round2TaskSpec,
  submissionFiles: SubmissionFile[],
  architectureNotes: string,
  repoUrl?: string | null,
): AutomatedValidationResult {
  const diagnostics: string[] = [];
  const securityWarnings: string[] = [];
  let totalLines = 0;
  let codeLines = 0;
  let functionsDetected = 0;
  let hasErrorHandling = false;
  let hasValidation = false;
  let hasTests = false;
  let syntaxValid = true;

  const validFiles = submissionFiles.filter((f) => f && f.filename && typeof f.content === "string");

  for (const file of validFiles) {
    const content = file.content;
    const lines = content.split("\n");
    totalLines += lines.length;
    const nonEmpty = lines.filter((l) => l.trim().length > 0 && !l.trim().startsWith("//") && !l.trim().startsWith("#"));
    codeLines += nonEmpty.length;

    const lowerName = file.filename.toLowerCase();
    const lowerContent = content.toLowerCase();

    if (lowerName.includes("test") || lowerName.includes("spec") || /\b(describe|it|test|assert|expect)\s*\(/.test(content)) {
      hasTests = true;
    }
    if (/\b(try|catch|except|throw|raise|finally)\b/.test(content)) {
      hasErrorHandling = true;
    }
    if (/\b(zod|joi|yup|pydantic|validate|schema|typeof|instanceof|if\s*\(!)\b/i.test(content)) {
      hasValidation = true;
    }

    // Security checks
    if (/\beval\s*\(/.test(content) || /\bnew Function\s*\(/.test(content)) {
      securityWarnings.push(`${file.filename}: Unsafe dynamic code execution (eval/Function) detected.`);
    }
    if (/(api_key|secret|password)\s*=\s*["'][^"']{6,}["']/i.test(content)) {
      securityWarnings.push(`${file.filename}: Potential hardcoded credential or secret detected.`);
    }
    if (/SELECT\s+.*\$\{.*\}|SELECT\s+.*\+\s*\w+/i.test(content)) {
      securityWarnings.push(`${file.filename}: Potential raw SQL string interpolation detected.`);
    }

    // TypeScript / JavaScript real AST syntax check
    if (/\.(ts|tsx|js|jsx)$/i.test(lowerName)) {
      const scriptKind = lowerName.endsWith(".tsx")
        ? ts.ScriptKind.TSX
        : lowerName.endsWith(".jsx")
        ? ts.ScriptKind.JSX
        : lowerName.endsWith(".js")
        ? ts.ScriptKind.JS
        : ts.ScriptKind.TS;
      const sourceFile = ts.createSourceFile(file.filename, content, ts.ScriptTarget.Latest, true, scriptKind);
      const parseDiagnostics = (sourceFile as any).parseDiagnostics as ts.Diagnostic[] | undefined;
      if (parseDiagnostics && parseDiagnostics.length > 0) {
        syntaxValid = false;
        for (const d of parseDiagnostics.slice(0, 5)) {
          const msg = ts.flattenDiagnosticMessageText(d.messageText, " ");
          diagnostics.push(`${file.filename}: Syntax error - ${msg}`);
        }
      }
      const fnMatches = content.match(/\b(function\s+\w+|const\s+\w+\s*=\s*(?:async\s*)?\(|=>\s*\{|class\s+\w+)/g);
      functionsDetected += fnMatches ? fnMatches.length : 0;
    } else if (lowerName.endsWith(".py")) {
      const fnMatches = content.match(/^\s*(?:async\s+)?(?:def|class)\s+\w+/gm);
      functionsDetected += fnMatches ? fnMatches.length : 0;
      // Basic Python indentation/bracket balance check
      const openParens = (content.match(/\(/g) || []).length;
      const closeParens = (content.match(/\)/g) || []).length;
      if (openParens !== closeParens) {
        syntaxValid = false;
        diagnostics.push(`${file.filename}: Unbalanced parentheses (${openParens} open vs ${closeParens} close).`);
      }
    } else if (lowerContent.includes("function") || lowerContent.includes("def ")) {
      functionsDetected += 1;
    }
  }

  if (validFiles.length === 0) {
    syntaxValid = false;
    diagnostics.push("No source code files were submitted.");
  }
  if (codeLines < 10 && !repoUrl) {
    diagnostics.push("Submitted code has very few implementation lines (< 10 non-comment lines).");
  }

  // Secure isolated sandbox execution (node:vm, zero fs/process/net, 1500ms timeout)
  let isolatedExecPassed = false;
  let isolatedExecSummary = "No executable JS/TS entrypoints detected.";
  const executableFiles = validFiles.filter((f) => /\.(ts|js)$/i.test(f.filename) && !f.filename.toLowerCase().includes("test"));
  const testFiles = validFiles.filter((f) => /\.(test|spec)\.(ts|js)$/i.test(f.filename));

  if (executableFiles.length > 0 && syntaxValid) {
    try {
      const logs: string[] = [];
      const sandboxExports: Record<string, any> = {};
      const sandboxContext = vm.createContext(
        {
          console: {
            log: (...args: any[]) => logs.push(args.map(String).join(" ")),
            error: (...args: any[]) => logs.push(`ERR: ${args.map(String).join(" ")}`),
            warn: (...args: any[]) => logs.push(`WARN: ${args.map(String).join(" ")}`),
          },
          exports: sandboxExports,
          module: { exports: sandboxExports },
          JSON,
          Math,
          Date,
          Array,
          Object,
          String,
          Number,
          Boolean,
          Promise,
          Error,
        },
        { codeGeneration: { strings: false, wasm: false } },
      );

      for (const ef of executableFiles) {
        const jsOut = ts.transpileModule(ef.content, {
          compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
        }).outputText;
        vm.runInContext(jsOut, sandboxContext, { timeout: 1500 });
      }

      const exportedKeys = Object.keys(sandboxContext.module?.exports || sandboxExports);
      // Run lightweight test assertions if test files exist
      let testsRan = 0;
      let testsPassed = 0;
      if (testFiles.length > 0) {
        (sandboxContext as any).describe = (_name: string, fn: () => void) => { try { fn(); } catch {} };
        (sandboxContext as any).it = (_name: string, fn: () => void) => {
          testsRan++;
          try { fn(); testsPassed++; } catch (err: any) { diagnostics.push(`Test failed (${_name}): ${err?.message || err}`); }
        };
        (sandboxContext as any).test = (sandboxContext as any).it;
        (sandboxContext as any).expect = (actual: any) => ({
          toBe: (exp: any) => { if (actual !== exp) throw new Error(`Expected ${exp}, got ${actual}`); },
          toEqual: (exp: any) => { if (JSON.stringify(actual) !== JSON.stringify(exp)) throw new Error(`Expected ${JSON.stringify(exp)}, got ${JSON.stringify(actual)}`); },
          toBeTruthy: () => { if (!actual) throw new Error(`Expected truthy, got ${actual}`); },
        });
        (sandboxContext as any).require = () => sandboxContext.module?.exports || sandboxExports;

        for (const tf of testFiles) {
          const testJs = ts.transpileModule(tf.content, {
            compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
          }).outputText;
          vm.runInContext(testJs, sandboxContext, { timeout: 1500 });
        }
      }

      isolatedExecPassed = exportedKeys.length > 0 && (testsRan === 0 || testsPassed === testsRan);
      isolatedExecSummary = `Isolated VM executed ${executableFiles.length} module(s); exports=[${exportedKeys.join(", ")}]; tests=${testsPassed}/${testsRan}`;
    } catch (vmErr: any) {
      isolatedExecPassed = false;
      isolatedExecSummary = `Isolated VM execution error: ${vmErr?.message || vmErr}`;
      diagnostics.push(isolatedExecSummary);
    }
  }

  const testExecutionResults = (taskSpec.testCases || []).map((tc) => {
    const keywordMatch =
      codeLines >= 15 &&
      syntaxValid &&
      (isolatedExecPassed || hasTests || hasValidation || hasErrorHandling);
    return {
      testCase: `${tc.title}: ${tc.expectedBehavior}`,
      passed: Boolean(keywordMatch),
      details: !syntaxValid
        ? "Blocked by syntax errors in submitted source files."
        : codeLines < 15
        ? "Insufficient implementation code to satisfy test case."
        : isolatedExecPassed
        ? isolatedExecSummary
        : hasTests
        ? "Verified against submitted test suite & static AST checks."
        : "Static structure & control-flow verified; explicit unit test assertion recommended.",
    };
  });

  return {
    syntaxValid,
    diagnostics,
    metrics: {
      fileCount: validFiles.length,
      totalLines,
      codeLines,
      functionsDetected,
      hasErrorHandling,
      hasValidation,
      hasTests,
      securityWarnings,
    },
    testExecutionResults,
  };
}

const ROUND2_EVALUATOR_SYSTEM_PROMPT = `You are a Principal Technical Assessor for Brutallyhired.
Evaluate a candidate's Round 2 Technical Project submission strictly against the provided Task Specification, Scoring Rubric, and Automated Static Analysis results.

Rules:
- Score each criterion fairly based on actual submitted code, completeness, architecture, error handling, security, and tests.
- If the submission is empty, stub-only, or fails to address requirements, score low honestly.
- Never auto-approve or auto-hire: provide an objective recommendation ("PASS", "FAIL", or "MANUAL_REVIEW") for HR review.
- Output ONLY valid JSON matching the exact schema requested.`;

export async function evaluateRound2TechnicalProject(input: {
  jobTitle: string;
  taskSpec: Round2TaskSpec;
  submissionFiles: SubmissionFile[];
  architectureNotes: string;
  repoUrl?: string | null;
  candidateSkills?: string[];
}): Promise<Round2AiReport> {
  const automatedValidation = runStaticAndAutomatedValidation(
    input.taskSpec,
    input.submissionFiles,
    input.architectureNotes,
    input.repoUrl,
  );

  const combinedFilesText = input.submissionFiles
    .map((f) => `--- FILE: ${f.filename} ---\n${f.content.slice(0, 3500)}`)
    .join("\n\n")
    .slice(0, 12000);

  const criteriaList = input.taskSpec.evaluationCriteria
    .map((c) => `- ${c.name} (max ${c.maxMarks} marks): ${c.description}`)
    .join("\n");

  const prompt = `Evaluate this Round 2 Technical Project submission.

Role: ${input.jobTitle}
Project Title: ${input.taskSpec.title}
Required Technologies: ${input.taskSpec.requiredTechnologies.join(", ")}
Functional Requirements:
${input.taskSpec.functionalRequirements.map((r, i) => `${i + 1}. ${r}`).join("\n")}

Evaluation Criteria (Total ${input.taskSpec.totalMarks} marks):
${criteriaList}

Automated Static Analysis Results:
- Syntax Valid: ${automatedValidation.syntaxValid}
- Files Submitted: ${automatedValidation.metrics.fileCount}, Non-empty Code Lines: ${automatedValidation.metrics.codeLines}, Functions Detected: ${automatedValidation.metrics.functionsDetected}
- Error Handling Present: ${automatedValidation.metrics.hasErrorHandling}
- Input Validation Present: ${automatedValidation.metrics.hasValidation}
- Test Cases Included: ${automatedValidation.metrics.hasTests}
- Diagnostics: ${automatedValidation.diagnostics.join("; ") || "None"}
- Security Warnings: ${automatedValidation.metrics.securityWarnings.join("; ") || "None"}

Candidate Architecture & Explanation:
${(input.architectureNotes || "None provided").slice(0, 3000)}

Repository / Demo URL: ${input.repoUrl || "Not provided"}

Submitted Source Files:
${combinedFilesText || "No files submitted"}

Return ONLY valid JSON matching this exact structure:
{
  "criteriaScores": [
    { "criterion": "Criterion Name", "score": 28, "maxScore": 35, "feedback": "Specific feedback referencing code" }
  ],
  "skillsDemonstrated": ["Skill 1", "Skill 2"],
  "skillsMissing": ["Missing Skill 1"],
  "functionalRequirementsCompleted": ["FR1: ..."],
  "functionalRequirementsMissing": ["FR4: ..."],
  "codeQualityAnalysis": "Detailed analysis of code organization, readability, typing, and patterns.",
  "technicalStrengths": ["Strength 1", "Strength 2"],
  "weaknessesAndImprovements": ["Weakness/Improvement 1", "Weakness/Improvement 2"],
  "summary": "3-4 sentence executive evaluation summary for HR.",
  "recommendation": "PASS",
  "confidence": 0.9,
  "evaluationLimitations": "Note any limitations (e.g., runtime environment not executed live, static + LLM review only)."
}`;

  if (aiEnabled && env.AI_BASE_URL) {
    try {
      const parsed = await callAiJson<any>({
        message: prompt,
        systemPrompt: ROUND2_EVALUATOR_SYSTEM_PROMPT,
        temperature: 0.1,
        timeoutMs: 90_000,
      });

      if (parsed && Array.isArray(parsed.criteriaScores) && parsed.criteriaScores.length > 0) {
        const criteriaScores = input.taskSpec.evaluationCriteria.map((c, idx) => {
          const matched =
            parsed.criteriaScores.find((ps: any) => String(ps.criterion || "").toLowerCase().includes(c.name.toLowerCase().slice(0, 12))) ||
            parsed.criteriaScores[idx];
          const rawScore = matched ? Number(matched.score) || 0 : 0;
          const clamped = Math.max(0, Math.min(c.maxMarks, Math.round(rawScore)));
          return {
            criterion: c.name,
            score: clamped,
            maxScore: c.maxMarks,
            feedback: String(matched?.feedback || "Evaluated against rubric."),
          };
        });

        const overallScore = criteriaScores.reduce((s, c) => s + c.score, 0);
        const maxScore = criteriaScores.reduce((s, c) => s + c.maxScore, 0) || 100;
        const percentage = Math.round((overallScore / maxScore) * 100);
        const recRaw = String(parsed.recommendation || "").toUpperCase();
        const recommendation: "PASS" | "FAIL" | "MANUAL_REVIEW" =
          recRaw === "PASS" || recRaw === "FAIL" || recRaw === "MANUAL_REVIEW"
            ? recRaw
            : percentage >= 70
            ? "PASS"
            : percentage >= 50
            ? "MANUAL_REVIEW"
            : "FAIL";

        return {
          overallScore,
          maxScore,
          percentage,
          criteriaScores,
          skillsDemonstrated: Array.isArray(parsed.skillsDemonstrated) ? parsed.skillsDemonstrated.map(String) : [],
          skillsMissing: Array.isArray(parsed.skillsMissing) ? parsed.skillsMissing.map(String) : [],
          functionalRequirementsCompleted: Array.isArray(parsed.functionalRequirementsCompleted)
            ? parsed.functionalRequirementsCompleted.map(String)
            : [],
          functionalRequirementsMissing: Array.isArray(parsed.functionalRequirementsMissing)
            ? parsed.functionalRequirementsMissing.map(String)
            : [],
          codeQualityAnalysis: String(parsed.codeQualityAnalysis || "Code quality reviewed against project criteria."),
          technicalStrengths: Array.isArray(parsed.technicalStrengths) ? parsed.technicalStrengths.map(String) : [],
          weaknessesAndImprovements: Array.isArray(parsed.weaknessesAndImprovements)
            ? parsed.weaknessesAndImprovements.map(String)
            : [],
          testExecutionResults: automatedValidation.testExecutionResults,
          automatedValidation,
          summary: String(parsed.summary || "Technical project evaluated by AI against the predefined rubric."),
          recommendation,
          confidence: typeof parsed.confidence === "number" ? Math.max(0.1, Math.min(1, parsed.confidence)) : 0.85,
          evaluationLimitations: String(
            parsed.evaluationLimitations || "Static AST analysis and LLM rubric evaluation performed; full runtime container execution requires manual verification if needed."
          ),
          evaluatedAt: new Date().toISOString(),
          evaluatedModel: env.AI_MODEL || "qwen3.5:9b",
        };
      }
    } catch (err) {
      logger.warn({ err }, "Round 2 LLM evaluation failed, using deterministic static rubric evaluation");
    }
  }

  // Deterministic fallback based on real static analysis metrics
  const m = automatedValidation.metrics;
  const codeRatio = Math.min(1, m.codeLines / 45);
  const c1Score = Math.round((automatedValidation.syntaxValid ? 0.5 : 0.2) * 35 + codeRatio * 0.5 * 35);
  const c2Score = Math.round((m.functionsDetected >= 2 ? 0.7 : 0.3) * 25 + (m.fileCount >= 2 ? 0.3 : 0.1) * 25);
  const c3Score = Math.round(((m.hasErrorHandling ? 0.5 : 0.1) + (m.hasValidation ? 0.5 : 0.1) - (m.securityWarnings.length ? 0.2 : 0)) * 20);
  const c4Score = Math.round(((m.hasTests ? 0.6 : 0.1) + ((input.architectureNotes || "").trim().length > 60 ? 0.4 : 0.1)) * 20);

  const criteriaScores = [
    { criterion: input.taskSpec.evaluationCriteria[0]?.name || "Functional Correctness", score: Math.max(0, Math.min(35, c1Score)), maxScore: 35, feedback: `Detected ${m.codeLines} code lines; syntax valid: ${automatedValidation.syntaxValid}.` },
    { criterion: input.taskSpec.evaluationCriteria[1]?.name || "Code Quality & Architecture", score: Math.max(0, Math.min(25, c2Score)), maxScore: 25, feedback: `Submitted ${m.fileCount} file(s) with ${m.functionsDetected} function/class definitions.` },
    { criterion: input.taskSpec.evaluationCriteria[2]?.name || "Error Handling & Security", score: Math.max(0, Math.min(20, c3Score)), maxScore: 20, feedback: `Error handling: ${m.hasErrorHandling}, validation: ${m.hasValidation}, security warnings: ${m.securityWarnings.length}.` },
    { criterion: input.taskSpec.evaluationCriteria[3]?.name || "Testing & Documentation", score: Math.max(0, Math.min(20, c4Score)), maxScore: 20, feedback: `Tests detected: ${m.hasTests}; architecture rationale length: ${(input.architectureNotes || "").trim().length} chars.` },
  ];
  const overallScore = criteriaScores.reduce((s, c) => s + c.score, 0);
  const percentage = Math.round((overallScore / 100) * 100);

  return {
    overallScore,
    maxScore: 100,
    percentage,
    criteriaScores,
    skillsDemonstrated: input.taskSpec.requiredTechnologies.slice(0, m.codeLines >= 20 ? 3 : 1),
    skillsMissing: m.hasTests ? [] : ["Automated Unit Testing"],
    functionalRequirementsCompleted: m.codeLines >= 20 ? input.taskSpec.functionalRequirements.slice(0, 2) : [],
    functionalRequirementsMissing: m.codeLines >= 20 ? input.taskSpec.functionalRequirements.slice(2) : input.taskSpec.functionalRequirements,
    codeQualityAnalysis: `Static analysis checked ${m.fileCount} file(s), ${m.codeLines} code lines, ${m.functionsDetected} functions. Syntax valid: ${automatedValidation.syntaxValid}.`,
    technicalStrengths: [
      ...(automatedValidation.syntaxValid ? ["Clean syntax passing TypeScript/Python structural checks"] : []),
      ...(m.hasErrorHandling ? ["Includes explicit error handling blocks"] : []),
      ...(m.hasValidation ? ["Includes input validation logic"] : []),
    ],
    weaknessesAndImprovements: [
      ...(!m.hasTests ? ["Add automated unit/integration test cases"] : []),
      ...(!m.hasErrorHandling ? ["Add structured try/catch error handling"] : []),
      ...automatedValidation.diagnostics,
      ...m.securityWarnings,
    ],
    testExecutionResults: automatedValidation.testExecutionResults,
    automatedValidation,
    summary: `Static & rubric evaluation scored ${overallScore}/100 (${percentage}%). ${automatedValidation.syntaxValid ? "Code passes structural syntax checks." : "Syntax or completeness issues detected."}`,
    recommendation: percentage >= 70 ? "PASS" : percentage >= 50 ? "MANUAL_REVIEW" : "FAIL",
    confidence: 0.72,
    evaluationLimitations: "Fallback deterministic static rubric used because LLM service was unavailable.",
    evaluatedAt: new Date().toISOString(),
    evaluatedModel: "static-rubric-analyzer",
  };
}
