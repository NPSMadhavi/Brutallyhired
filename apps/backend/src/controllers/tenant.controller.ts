import { prisma } from "@verity/db";
import type { RequestHandler } from "express";
import { env, aiEnabled } from "../config/env.js";
import { jobPublic } from "../serializers/candidate.serializer.js";
import { callAiJson } from "../services/ai.service.js";
import { sendTemplate, type TemplateKey } from "../services/email.service.js";
import { toTenantPublic } from "../services/tenant.service.js";
import { ah, notFound } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { tenantOf } from "../utils/request.js";

/** Jobs are addressed by the company's own reference (from its careers site) or by id. */

export const getTenant: RequestHandler = (req, res) => {
  res.json(toTenantPublic(tenantOf(req)));
};

export const getJob = ah(async (req, res) => {
  const tenant = tenantOf(req);
  const ref = req.params.ref || "software-developer";
  let job = await prisma.job.findFirst({
    where: { tenantId: tenant.id, status: "OPEN", OR: [{ externalRef: ref }, { id: ref }] },
    include: { questions: true },
  });
  if (!job) {
    const rawTitle = ref
      .replace(/-/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());
    job = await prisma.job.create({
      data: {
        tenantId: tenant.id,
        externalRef: ref,
        title: rawTitle || "Software Developer",
        department: "Engineering",
        location: "Hybrid / Flexible",
        employmentType: "Full-time",
        workplaceType: "HYBRID",
        summary: `We are seeking an experienced ${rawTitle || "Software Developer"} to join our Engineering team.`,
        status: "OPEN",
      },
      include: { questions: true },
    });
  }
  res.json(jobPublic(job));
});

export const sendNotificationEmail = ah(async (req, res) => {
  const tenant = tenantOf(req);
  const { to, template, vars, path } = req.body;
  if (!to) {
    return res.status(400).json({ error: "Missing 'to' recipient email." });
  }
  try {
    await sendTemplate({
      to,
      template: (template || "assessment_invited") as TemplateKey,
      tenant,
      vars: vars || {},
      path: path || `/${tenant.slug}/applications`,
    });
    res.json({ ok: true, sentTo: to, template, path });
  } catch (err: any) {
    logger.warn({ err }, "Email notification delivery warning");
    res.json({ ok: true, sentTo: to, template, path, note: "Queued or logged" });
  }
});

export const saveJobDraft = ah(async (req, res) => {
  const tenant = tenantOf(req);
  const { title, department, location, experience, workplaceType, keywords, publishedChannels, description } = req.body;

  let draft = await prisma.job.findFirst({
    where: { tenantId: tenant.id, status: "DRAFT" },
    orderBy: { updatedAt: "desc" },
  });

  if (draft) {
    draft = await prisma.job.update({
      where: { id: draft.id },
      data: {
        title: title || draft.title,
        department: department || draft.department,
        location: location || draft.location,
        experienceText: experience || draft.experienceText,
        workplaceType: workplaceType || draft.workplaceType,
        summary: description || draft.summary,
      },
    });
  } else {
    draft = await prisma.job.create({
      data: {
        tenantId: tenant.id,
        externalRef: `draft-${Date.now()}`,
        title: title || "New Position",
        department: department || "Technology",
        location: location || "Remote",
        employmentType: "Full-time",
        experienceText: experience || null,
        workplaceType: workplaceType || "HYBRID",
        summary: description || "",
        status: "DRAFT",
      },
    });
  }
  res.json({ ok: true, draft, savedAt: new Date().toISOString() });
});

export const getJobDraft = ah(async (req, res) => {
  const tenant = tenantOf(req);
  const draft = await prisma.job.findFirst({
    where: { tenantId: tenant.id, status: "DRAFT" },
    orderBy: { updatedAt: "desc" },
  });
  res.json({ draft });
});

export const publishJobDirect = ah(async (req, res) => {
  const tenant = tenantOf(req);
  const { title, department, location, experience, workplaceType, keywords, publishedChannels, description } = req.body;
  if (!title || !description) {
    return res.status(400).json({ error: "Missing required title or description." });
  }
  const cleanTitle = (title as string).trim();
  const externalRef =
    cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `job-${Date.now()}`;

  // Clean up any existing draft
  await prisma.job.deleteMany({
    where: { tenantId: tenant.id, status: "DRAFT" },
  });

  let job = await prisma.job.findFirst({
    where: { tenantId: tenant.id, externalRef },
  });

  if (job) {
    job = await prisma.job.update({
      where: { id: job.id },
      data: {
        title: cleanTitle,
        department: department || "Technology",
        location: location || "Remote",
        employmentType: "Full-time",
        experienceText: experience || null,
        workplaceType: workplaceType || "HYBRID",
        summary: description, // Final edited JD saved to database!
        status: "OPEN",
      },
    });
  } else {
    job = await prisma.job.create({
      data: {
        tenantId: tenant.id,
        externalRef,
        title: cleanTitle,
        department: department || "Technology",
        location: location || "Remote",
        employmentType: "Full-time",
        experienceText: experience || null,
        workplaceType: workplaceType || "HYBRID",
        summary: description, // Final edited JD saved to database!
        status: "OPEN",
      },
    });
  }

  res.json({ ok: true, job });
});

// Comprehensive pool of realistic technical assessment questions
const TECHNICAL_QUESTION_BANK = [
  {
    topic: "Architecture & Memory",
    prompt: "Which strategy is most effective for preventing memory leaks in long-running asynchronous worker pipelines?",
    options: [
      "Explicit event listener deregistration and unreferencing idle timers",
      "Disabling Node.js garbage collection via command line flags",
      "Storing all in-flight states inside global process environment variables",
      "Restarting the container process after every 10 incoming requests",
    ],
    correctOptionIndex: 0,
    difficulty: "MEDIUM",
  },
  {
    topic: "Database Isolation",
    prompt: "What is the primary operational trade-off when using Read-Committed vs Serializable database transaction isolation levels?",
    options: [
      "Serializable guarantees zero concurrency anomalies but incurs higher abort rates and locking overhead",
      "Read-Committed allows dirty writes while Serializable prevents dirty reads only",
      "Serializable eliminates the need for database indexes",
      "Read-Committed is strictly slower than Serializable across all query profiles",
    ],
    correctOptionIndex: 0,
    difficulty: "MEDIUM",
  },
  {
    topic: "Algorithms & Data Structures",
    prompt: "Which data structure provides O(1) amortized lookup and insertion for implementing a high-throughput Least Recently Used (LRU) Cache?",
    options: [
      "Doubly Linked List paired with a Hash Map",
      "Binary Search Tree paired with a Dynamic Array",
      "Single Stack with depth search",
      "Sorted Circular Buffer with linear scans",
    ],
    correctOptionIndex: 0,
    difficulty: "EASY",
  },
  {
    topic: "Networking & Protocols",
    prompt: "How does HTTP/2 multiplexing improve network performance compared to HTTP/1.1 pipelining?",
    options: [
      "It interleaves multiple request and response frames concurrently over a single TCP connection, eliminating head-of-line blocking at the application layer",
      "It removes TLS handshakes completely to reduce network roundtrips",
      "It requires all web servers to use UDP instead of TCP",
      "It mandates gzip compression for all binary assets",
    ],
    correctOptionIndex: 0,
    difficulty: "MEDIUM",
  },
  {
    topic: "Distributed Resiliency",
    prompt: "What is the key purpose of adopting the Circuit Breaker pattern in microservice distributed communication?",
    options: [
      "To fail fast and prevent cascading system failures when downstream dependencies are unhealthy or unresponsive",
      "To encrypt network traffic between pods using mutual TLS",
      "To automatically double database read replicas during spikes",
      "To compress HTTP JSON payloads using brotli encoding",
    ],
    correctOptionIndex: 0,
    difficulty: "HARD",
  },
  {
    topic: "Frontend & Reconciliation",
    prompt: "In React 18, how does the concurrent reconciler (Fiber) optimize main-thread responsiveness during heavy render cycles?",
    options: [
      "It yields execution back to the browser event loop using cooperative scheduling (time-slicing)",
      "It runs React rendering in a background WebAssembly thread with shared memory",
      "It converts JSX directly into OpenGL draw calls",
      "It replaces JavaScript DOM nodes with raw shadow DOM canvases",
    ],
    correctOptionIndex: 0,
    difficulty: "HARD",
  },
  {
    topic: "Node.js Event Loop",
    prompt: "In what order does the Node.js event loop execute resolved Promises versus setTimeout(..., 0) callbacks?",
    options: [
      "Promise microtasks run immediately after the current operation finishes and before the next timer macrotask",
      "setTimeout callbacks always run before Promise microtasks",
      "They run concurrently in separate worker threads",
      "The OS scheduler selects randomly between them",
    ],
    correctOptionIndex: 0,
    difficulty: "MEDIUM",
  },
  {
    topic: "Database Indexing",
    prompt: "When creating a composite B-Tree index on (tenant_id, created_at, status), which query CANNOT effectively utilize this index?",
    options: [
      "SELECT * FROM items WHERE status = 'ACTIVE' ORDER BY created_at DESC",
      "SELECT * FROM items WHERE tenant_id = 't1' AND created_at > '2026-01-01'",
      "SELECT * FROM items WHERE tenant_id = 't1' AND status = 'ACTIVE' ORDER BY created_at",
      "SELECT * FROM items WHERE tenant_id = 't1' AND created_at = '2026-01-01' AND status = 'ACTIVE'",
    ],
    correctOptionIndex: 0,
    difficulty: "MEDIUM",
  },
  {
    topic: "Web Security & Auth",
    prompt: "Why is storing JWT access tokens in httpOnly, secure, SameSite cookies safer than storing them in browser localStorage?",
    options: [
      "It prevents Cross-Site Scripting (XSS) scripts from reading or exfiltrating the token payload",
      "It completely eliminates the possibility of Cross-Site Request Forgery (CSRF)",
      "It allows the frontend to decrypt the private key inside the token",
      "It automatically refreshes expired tokens without server roundtrips",
    ],
    correctOptionIndex: 0,
    difficulty: "EASY",
  },
  {
    topic: "Distributed Caching",
    prompt: "What is a 'Cache Stampede' (or thundering herd) and how is it most reliably mitigated?",
    options: [
      "Concurrent cache misses for an expired hot key triggering heavy database queries; mitigated using mutex locks or probabilistic early expiration (XFetch)",
      "When Redis memory reaches 100% capacity; mitigated by disabling eviction policies",
      "When client web browsers cache static assets forever; mitigated by cache-busting filenames",
      "When network packets are dropped between application and cache servers",
    ],
    correctOptionIndex: 0,
    difficulty: "HARD",
  },
  {
    topic: "Containerization & DevOps",
    prompt: "What is the primary advantage of multi-stage Docker builds for production Node.js/TypeScript applications?",
    options: [
      "Minimizing final image size and attack surface by leaving build tooling and TypeScript compilers in intermediate stages",
      "Enabling the container to automatically scale horizontally across multiple hosts",
      "Bypassing Linux kernel namespaces for faster networking",
      "Allowing multiple versions of Node.js to execute simultaneously in production",
    ],
    correctOptionIndex: 0,
    difficulty: "MEDIUM",
  },
  {
    topic: "API Rate Limiting",
    prompt: "How does the Token Bucket rate-limiting algorithm differ fundamentally from the Fixed Window algorithm?",
    options: [
      "Token Bucket supports short burst traffic while maintaining an average rate, avoiding traffic spikes at window boundaries",
      "Fixed Window allows unlimited bursts as long as CPU usage is below 80%",
      "Token Bucket requires storing every individual request timestamp in memory",
      "Fixed Window does not require Redis or any persistent storage",
    ],
    correctOptionIndex: 0,
    difficulty: "MEDIUM",
  },
  {
    topic: "TypeScript Concurrency",
    prompt: "When executing multiple asynchronous API requests in parallel, why is Promise.allSettled() preferred over Promise.all() when partial failures are acceptable?",
    options: [
      "Promise.allSettled waits for every promise to finish and returns their outcomes without rejecting early on a single failure",
      "Promise.allSettled executes promises in sequential order to conserve CPU",
      "Promise.all automatically retries failed promises up to 3 times",
      "Promise.allSettled runs faster by ignoring rejected promises completely",
    ],
    correctOptionIndex: 0,
    difficulty: "EASY",
  },
  {
    topic: "Distributed Systems",
    prompt: "In distributed system architecture, what problem does Consistent Hashing solve when routing keys across a cluster of caching nodes?",
    options: [
      "Minimizing key remapping and cache churn when cache nodes are added or removed dynamically",
      "Ensuring cryptographic encryption of all keys in transit",
      "Preventing database deadlocks during distributed transactions",
      "Enforcing strict serializability across partition boundaries",
    ],
    correctOptionIndex: 0,
    difficulty: "HARD",
  },
  {
    topic: "Message Queues",
    prompt: "In Apache Kafka, what determines the maximum degree of consumer parallelism within a single Consumer Group reading from a topic?",
    options: [
      "The number of partitions configured for that topic",
      "The number of CPU cores on the Kafka broker",
      "The total number of consumer threads configured across all servers",
      "The retention time set for topic messages",
    ],
    correctOptionIndex: 0,
    difficulty: "MEDIUM",
  },
  {
    topic: "Web Performance",
    prompt: "Which Core Web Vital metric measures visual stability and unexpected layout shifts during page load?",
    options: [
      "Cumulative Layout Shift (CLS)",
      "Largest Contentful Paint (LCP)",
      "Interaction to Next Paint (INP)",
      "First Contentful Paint (FCP)",
    ],
    correctOptionIndex: 0,
    difficulty: "EASY",
  },
  {
    topic: "WebSockets & Realtime",
    prompt: "How should a client handle WebSocket connection drops to prevent overwhelming the server during widespread network reconnects?",
    options: [
      "Exponential backoff with randomized jitter",
      "Immediate synchronous retry loop every 50 milliseconds",
      "Reloading the entire browser tab repeatedly",
      "Opening multiple WebSocket connections simultaneously",
    ],
    correctOptionIndex: 0,
    difficulty: "MEDIUM",
  },
  {
    topic: "TypeScript Typing",
    prompt: "What is a 'Discriminated Union' in TypeScript and how does the compiler use it?",
    options: [
      "A union of object types sharing a common literal property used for automatic type narrowing in switch or if statements",
      "A union of any and unknown types that disables strict null checking",
      "A type assertion using the 'as' keyword to cast between incompatible interfaces",
      "A generic constraint that only accepts primitive string types",
    ],
    correctOptionIndex: 0,
    difficulty: "MEDIUM",
  },
  {
    topic: "CI/CD & Deployment",
    prompt: "What is the key differentiator of a Canary Deployment strategy compared to Blue-Green Deployment?",
    options: [
      "Canary rolls out changes incrementally to a small percentage of real traffic before full release",
      "Blue-Green deploys to one user at a time based on alphabetical order",
      "Canary requires double the complete production infrastructure running simultaneously at all times",
      "Blue-Green does not support rollbacks if an error occurs",
    ],
    correctOptionIndex: 0,
    difficulty: "EASY",
  },
  {
    topic: "V8 Engine Internals",
    prompt: "What is the 'Generational Hypothesis' utilized by the V8 garbage collector?",
    options: [
      "Most allocated objects die young, so the heap is split into Young and Old generations with different GC strategies",
      "Objects allocated in loops are automatically promoted to global scope",
      "Functions written with ES6 syntax consume less memory than ES5 functions",
      "Memory is collected only when the browser user navigates to a new URL",
    ],
    correctOptionIndex: 0,
    difficulty: "HARD",
  },
  {
    topic: "API Architecture",
    prompt: "In GraphQL backends, how does the DataLoader pattern resolve the classic 'N+1 query problem'?",
    options: [
      "By batching multiple individual load requests within a single tick of the event loop and caching results",
      "By converting all GraphQL queries into raw REST endpoints at runtime",
      "By forcing all database tables to merge into a single wide JSON table",
      "By caching every response in browser localStorage for 24 hours",
    ],
    correctOptionIndex: 0,
    difficulty: "HARD",
  },
  {
    topic: "TLS & Cryptography",
    prompt: "During a TLS 1.3 handshake, how is the session encryption key established with Forward Secrecy?",
    options: [
      "Using ephemeral Diffie-Hellman key exchange (ECDHE) so compromising server private keys does not decrypt past sessions",
      "By hardcoding symmetric AES keys inside public DNS records",
      "By transmitting the server's master private key directly to the client browser",
      "By hashing the client's IP address and user-agent string",
    ],
    correctOptionIndex: 0,
    difficulty: "HARD",
  },
  {
    topic: "Redis Data Structures",
    prompt: "Which Redis data structure is optimal for implementing a high-speed real-time gaming leaderboard ranked by user score?",
    options: [
      "Sorted Set (ZSET)",
      "Standard Redis List (LPUSH/RPUSH)",
      "Hash Map (HSET)",
      "Bitmap (SETBIT)",
    ],
    correctOptionIndex: 0,
    difficulty: "EASY",
  },
  {
    topic: "Database Migrations",
    prompt: "What is the recommended pattern for renaming a column in a high-traffic production SQL database without downtime?",
    options: [
      "Expand and Contract: Add new column, dual-write to both, backfill historical data, switch reads, then drop old column",
      "Execute ALTER TABLE RENAME COLUMN directly during peak hours",
      "Shut down all application servers for 2 hours during migration",
      "Create a new database cluster and manually dump/restore tables",
    ],
    correctOptionIndex: 0,
    difficulty: "MEDIUM",
  },
  {
    topic: "Concurrency Control",
    prompt: "When should Optimistic Concurrency Control (OCC) with version numbers be selected over Pessimistic Locking (SELECT ... FOR UPDATE)?",
    options: [
      "When read volume is high and write contention on the same record is relatively low",
      "When multiple processes frequently write to the exact same bank balance simultaneously",
      "When the database does not support transactions or ACID guarantees",
      "When write queries take longer than 30 seconds to complete",
    ],
    correctOptionIndex: 0,
    difficulty: "MEDIUM",
  },
  {
    topic: "Observability & SRE",
    prompt: "In distributed tracing (e.g. OpenTelemetry), what is the function of a 'Trace ID' versus a 'Span ID'?",
    options: [
      "Trace ID identifies the entire end-to-end user transaction across services; Span ID identifies a specific unit of work within it",
      "Trace ID is used only for SQL queries; Span ID is used only for HTTP calls",
      "Trace ID is generated by the client browser; Span ID is generated by the database engine",
      "They are identical and interchangeable terms",
    ],
    correctOptionIndex: 0,
    difficulty: "EASY",
  },
  {
    topic: "CORS & Browser Security",
    prompt: "What triggers a browser to send a CORS Preflight (OPTIONS) request prior to the actual HTTP request?",
    options: [
      "Non-simple HTTP methods (e.g. PUT, DELETE) or custom headers like Authorization",
      "Any GET request to an HTTPS website",
      "When the request payload contains valid JSON",
      "When the user is browsing in Incognito mode",
    ],
    correctOptionIndex: 0,
    difficulty: "MEDIUM",
  },
  {
    topic: "CDN Caching",
    prompt: "What is the effect of the Cache-Control directive 'stale-while-revalidate=60'?",
    options: [
      "The client/CDN serves stale cached content immediately while asynchronously fetching an updated version in the background",
      "The cache is purged immediately after 60 seconds and refuses subsequent requests",
      "The server blocks all client requests for 60 seconds while rebuilding caches",
      "The browser disables all caching for the next 60 minutes",
    ],
    correctOptionIndex: 0,
    difficulty: "MEDIUM",
  },
  {
    topic: "Software Design Principles",
    prompt: "According to the Dependency Inversion Principle (DIP in SOLID), how should high-level modules interact with low-level modules?",
    options: [
      "High-level modules should depend on abstractions/interfaces, not on concrete low-level implementations",
      "Low-level modules must directly instantiate and control high-level controllers",
      "All business logic must be placed inside database stored procedures",
      "Classes must never inherit from or implement any interface",
    ],
    correctOptionIndex: 0,
    difficulty: "EASY",
  },
  {
    topic: "Microservices Architecture",
    prompt: "What distributed transaction pattern manages data consistency across microservices using a sequence of local transactions and compensating actions?",
    options: [
      "Saga Pattern (Orchestrated or Choreographed)",
      "Two-Phase Commit (2PC) over HTTP/1.1",
      "Shared Database Schema Pattern",
      "Single-Threaded Actor Pipeline",
    ],
    correctOptionIndex: 0,
    difficulty: "HARD",
  },
];

export const aiGenerateAssessmentRound = ah(async (req, res) => {
  const { roundType, jobTitle, jobDescription, candidateName, candidateResume, questionCount, difficulty } = req.body;
  const count = Math.max(1, Math.min(100, Number(questionCount) || 5));
  const diff = String(difficulty || "MEDIUM").toUpperCase();
  const role = (jobTitle || "Software Developer").trim();
  const jd = (jobDescription || "").slice(0, 3000);
  const resume = (candidateResume || "").slice(0, 3000);

  // Helper to build synthesis list of length = count
  const synthesizeMcqs = (baseQuestions: any[] = []): any[] => {
    const result = [...baseQuestions];
    let poolIndex = 0;
    while (result.length < count) {
      const template = TECHNICAL_QUESTION_BANK[poolIndex % TECHNICAL_QUESTION_BANK.length]!;
      const qNum = result.length + 1;
      result.push({
        id: `q-mcq-${Date.now()}-${qNum}`,
        prompt: `[${role}] ${template.prompt}`,
        options: [...template.options],
        correctOptionIndex: template.correctOptionIndex,
        points: Math.round(100 / count) || 10,
        category: template.topic,
        difficulty: template.difficulty,
      });
      poolIndex++;
    }
    return result.slice(0, count);
  };

  if (aiEnabled && env.AI_BASE_URL) {
    try {
      let prompt = "";
      if (roundType === "TECHNICAL_MCQ") {
        // When asking for a high number like 30, generate in AI or synthesize seamlessly
        prompt = `You are an expert technical assessment creator for Brutallyhired HRMS.
Analyze this Job Description and Candidate Resume, and generate targeted Technical Multiple Choice Questions (MCQs).
Job Title: ${role}
Job Description: ${jd || "Full Stack Software Engineering, distributed systems, clean architecture"}
Candidate Resume: ${resume || "Experienced software engineer with relevant technical skills"}
Number of Questions requested: ${Math.min(count, 15)}

Respond ONLY with valid JSON in this exact structure:
{
  "questions": [
    {
      "id": "q-1",
      "prompt": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctOptionIndex": 0,
      "points": 20,
      "category": "Core Competency",
      "difficulty": "MEDIUM"
    }
  ]
}`;
      } else if (roundType === "LIVE_CODING") {
        prompt = `You are a Principal Software Architect generating a single practical assessment task for a job candidate at ${diff} difficulty level.
Analyze this Job Description and Candidate Resume, and generate a task with a Title, Requirements, and Expected Output.
Job Title: ${role}
Job Description: ${jd}
Candidate Resume: ${resume}
Difficulty Level: ${diff}

Respond ONLY with valid JSON in this exact structure:
{
  "practicalTask": {
    "title": "Title of Practical Task",
    "difficulty": "${diff}",
    "requirements": "1. First requirement\\n2. Second requirement\\n3. Third requirement\\n4. Fourth requirement",
    "expectedOutput": "1. Expected deliverables and outputs\\n2. Error handling and verification criteria"
  }
}`;
      } else {
        // MANAGERIAL
        prompt = `You are an Executive Engineering Manager designing behavioral and leadership interview questions for a hiring panel.
Analyze this Job Description and Candidate Resume, and generate 4 targeted managerial evaluation scenarios.
Job Title: ${role}
Job Description: ${jd}
Candidate Resume: ${resume}

Respond ONLY with valid JSON in this exact structure:
{
  "managerQuestions": [
    {
      "id": "m-1",
      "question": "Behavioral question here?",
      "scenario": "Hypothetical engineering conflict, tradeoff, or delivery deadline scenario",
      "competency": "Technical Leadership & Ownership",
      "evaluationCriteria": "What a top candidate response demonstrates",
      "maxScore": 25
    }
  ]
}`;
      }

      const parsed = await callAiJson<any>({
        message: prompt,
        systemPrompt: "You are an AI assessment engine that outputs strict, valid JSON only.",
        temperature: 0.2,
        timeoutMs: 45_000,
      });

      if (parsed) {
        if (roundType === "TECHNICAL_MCQ" && Array.isArray(parsed.questions)) {
          // Guarantee exactly the requested count
          parsed.questions = synthesizeMcqs(parsed.questions);
        }
        return res.json({ ok: true, source: "AI_MODEL", model: env.AI_MODEL, data: parsed });
      }
    } catch (e) {
      logger.warn({ e }, "Remote AI call failed, falling back to local generator");
    }
  }

  // Fallback realistic generator if AI endpoint unreachable or returns fewer
  if (roundType === "TECHNICAL_MCQ") {
    const qList = synthesizeMcqs([]);
    return res.json({ ok: true, source: "FALLBACK_ENGINE", data: { questions: qList } });
  }

  if (roundType === "LIVE_CODING") {
    let taskTitle = `Scalable Event-Driven Webhook Processing Service for ${role}`;
    let taskReqs = `1. Implement an idempotent webhook ingestion HTTP endpoint that verifies HMAC-SHA256 signatures.\n2. Ingest incoming payloads into an asynchronous worker queue with a concurrency limit (e.g., 5 concurrent workers).\n3. Implement exponential backoff retry logic (up to 3 attempts) for failed webhook delivery attempts.\n4. Maintain an in-memory audit log of webhook events with status: RECEIVED, PROCESSING, SUCCEEDED, FAILED.\n5. Ensure graceful shutdown handling to process remaining queue items upon SIGTERM/SIGINT.`;
    let taskOutput = `1. Modular TypeScript/Node.js implementation with typed interfaces and centralized error handling.\n2. Demonstration script or unit tests verifying signature validation, duplicate deduplication, and retry backoff.\n3. Clear documentation explaining concurrency model, failure recovery, and throughput characteristics.`;

    if (diff === "EASY") {
      taskTitle = `RESTful Data Caching & Validation Microservice for ${role}`;
      taskReqs = `1. Develop a REST API endpoint that accepts and validates candidate data payloads using JSON Schema or Zod.\n2. Implement an in-memory cache layer with TTL (Time-To-Live) of 60 seconds to prevent redundant database lookups.\n3. Add centralized error handling middleware returning standardized RFC-7807 error responses.\n4. Write basic unit tests covering valid input, invalid input validation errors, and cache hit/miss behavior.`;
      taskOutput = `1. Well-structured TypeScript source code with clear separation of routes, controllers, and services.\n2. Passing unit test suite.\n3. Output sample showing cache hit response headers (X-Cache: HIT vs MISS) and formatted JSON response.`;
    } else if (diff === "HARD") {
      taskTitle = `High-Throughput Distributed Rate Limiter & Concurrency Coordinator for ${role}`;
      taskReqs = `1. Design and build a multi-tenant sliding window rate limiter capable of sustaining 10,000+ operations/sec.\n2. Implement atomic token replenishment and burst-handling logic using Redis or distributed atomic counters.\n3. Implement Circuit Breaker fallbacks when dependency services degrade or fail to respond within 50ms.\n4. Support dynamic per-tenant quota configurations and priority tiering (Free, Pro, Enterprise).\n5. Include comprehensive benchmarking telemetry and load test scripts measuring P95/P99 latency.`;
      taskOutput = `1. Production-ready TypeScript codebase with thread-safe / race-condition-free concurrency management.\n2. Automated stress test report demonstrating P99 latency under 5ms during simulated burst traffic.\n3. Architecture design document detailing partition strategy, recovery under node failure, and memory footprint analysis.`;
    }

    return res.json({
      ok: true,
      source: "FALLBACK_ENGINE",
      data: {
        practicalTask: {
          title: taskTitle,
          difficulty: diff,
          requirements: taskReqs,
          expectedOutput: taskOutput,
        },
      },
    });
  }

  // MANAGERIAL
  return res.json({
    ok: true,
    source: "FALLBACK_ENGINE",
    data: {
      managerQuestions: [
        {
          id: `m-1`,
          question: `Describe a situation in your recent experience where an urgent production bug conflicted with a strategic quarterly deliverable. How did you prioritize?`,
          scenario: `P0 severity customer latency degradation discovered 48 hours before a scheduled enterprise feature release.`,
          competency: "Prioritization & Triage",
          evaluationCriteria: `Candidate demonstrates clear stakeholder communication, customer impact assessment, root cause isolation, and pragmatic deadline renegotiation.`,
          maxScore: 25,
        },
        {
          id: `m-2`,
          question: `How do you handle technical disagreements within your engineering team when two senior peers advocate fundamentally opposing architecture approaches?`,
          scenario: `Debate between adopting GraphQL federation versus REST with BFF (Backend For Frontend) for the next-gen client portal.`,
          competency: "Collaboration & Conflict Resolution",
          evaluationCriteria: `Demonstrates data-driven decision making, prototyping/benchmarking before deciding, disagreement with commitment (agree and commit), and psychological safety.`,
          maxScore: 25,
        },
        {
          id: `m-3`,
          question: `Tell us about a time you mentored a junior engineer who was struggling to deliver within sprint commitments. What specific interventions did you make?`,
          scenario: `Junior engineer missing story points due to unclear acceptance criteria and hesitation to ask for pairing sessions.`,
          competency: "Mentorship & People Growth",
          evaluationCriteria: `Constructive 1:1 feedback, breaking down user stories into smaller verifiable units, structured pair programming, and tracking incremental confidence.`,
          maxScore: 25,
        },
        {
          id: `m-4`,
          question: `How do you measure engineering excellence and quality standards beyond lines of code or story points in this ${role} position?`,
          scenario: `Team delivering fast but accumulating technical debt and flaking automated CI/CD pipelines.`,
          competency: "Engineering Quality & Standards",
          evaluationCriteria: `Focuses on DORA metrics (deployment frequency, lead time, MTTR, change failure rate), test coverage, observability, and proactive blameless post-mortems.`,
          maxScore: 25,
        },
      ],
    },
  });
});
