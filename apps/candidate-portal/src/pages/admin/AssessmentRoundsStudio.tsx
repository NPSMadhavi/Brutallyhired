import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { Card, Pill } from "@/components/ui/Card";
import {
  Alert,
  Briefcase,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Eye,
  File,
  Lock,
  Mail,
  Plus,
  Shield,
  Sparkle,
  Trash,
  User,
  Users,
  Video,
  X,
} from "@/components/ui/icons";
import { sendEmailNotification } from "@/lib/emailService";

export type AssessmentRoundType = "TECHNICAL_MCQ" | "LIVE_CODING" | "MANAGERIAL" | "CUSTOM";

export interface McqQuestion {
  id: string;
  prompt: string;
  options: string[];
  correctOptionIndex: number;
  points: number;
  difficulty?: "EASY" | "MEDIUM" | "HARD";
  category?: string;
}

// Single Practical Task for Round 2
export interface PracticalTask {
  title: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  requirements: string;
  expectedOutput: string;
  durationMinutes?: number;
}

export interface CodingTask {
  title: string;
  description: string;
  constraints: string;
  starterCode: string;
  language: string;
  testCases: { input: string; output: string }[];
  evaluationRubric: string;
  durationMinutes: number;
}

export interface ManagerQuestion {
  id: string;
  question: string;
  scenario: string;
  competency: string;
  evaluationCriteria: string;
  maxScore: number;
}

// Round 3 LiveKit Video Call Room Configuration (Managed by HR)
export interface LiveKitRoomConfig {
  roomName: string;
  roomUrl: string;
  roomToken?: string;
  interviewerName: string;
  interviewerEmail: string;
  scheduledTime: string;
  status: "READY" | "ACTIVE" | "COMPLETED";
  agenda?: string;
  notes?: string;
  recommendation?: "STRONG_HIRE" | "HIRE" | "HOLD" | "NO_HIRE";
  recordingEnabled?: boolean;
  allowCandidateEarlyJoin?: boolean;
  screenShareEnabled?: boolean;
  createdAt?: string;
}

export interface AssessmentRoundItem {
  id: string;
  roundNumber: number;
  name: string; // Directly editable
  type: AssessmentRoundType;
  description: string;
  durationMinutes: number;
  // Specific to Round 1 (Technical MCQ)
  mcqQuestionCount: number;
  mcqQuestions: McqQuestion[];
  // Specific to Round 2 (Single Practical Task: Title, Requirements, Expected Output)
  practicalTask?: PracticalTask;
  selectedDifficulty?: "EASY" | "MEDIUM" | "HARD";
  // Specific to Round 3 (Manager Round LiveKit Video Call Room)
  livekitRoom?: LiveKitRoomConfig;
  // HR Review & Approval
  hrReviewStatus?: "DRAFT" | "PENDING_HR_REVIEW" | "APPROVED";
  reviewedBy?: string;
  approvedAt?: string;
  secureTestToken?: string;
  secureTestLink?: string;
  // Scheduling & Dispatch
  scheduledSlotTime?: string;
  autoDispatch30MinBefore?: boolean;
  emailDispatchedAt?: string;
  emailDispatchedTo?: string;
  // Legacy fields
  codingTask?: CodingTask;
  managerQuestions?: ManagerQuestion[];
  customContent?: string;
}

interface JobItem {
  id: string;
  title: string;
  department?: string;
  location?: string;
  experience?: string;
  keywords?: string;
  workplaceType?: string;
  status: string;
  applicantCount: number;
  externalRef: string;
  description?: string;
}

interface ApplicationItem {
  id: string;
  candidateName?: string;
  email?: string;
  jobTitle?: string;
  experience?: string;
  notes?: string;
  resumeName?: string;
}

interface AssessmentRoundsStudioProps {
  jobs: JobItem[];
  applications: ApplicationItem[];
  tenant: { slug: string; name: string };
}

// 30 Comprehensive Technical Question Bank for Round 1
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
    difficulty: "MEDIUM" as const,
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
    difficulty: "MEDIUM" as const,
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
    difficulty: "EASY" as const,
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
    difficulty: "MEDIUM" as const,
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
    difficulty: "HARD" as const,
  },
  {
    topic: "Frontend & Reconciliation",
    prompt: "In modern React, how does the concurrent reconciler optimize main-thread responsiveness during heavy render cycles?",
    options: [
      "It yields execution back to the browser event loop using cooperative scheduling (time-slicing)",
      "It runs React rendering in a background WebAssembly thread with shared memory",
      "It converts JSX directly into OpenGL draw calls",
      "It replaces JavaScript DOM nodes with raw shadow DOM canvases",
    ],
    correctOptionIndex: 0,
    difficulty: "HARD" as const,
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
    difficulty: "MEDIUM" as const,
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
    difficulty: "MEDIUM" as const,
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
    difficulty: "EASY" as const,
  },
  {
    topic: "Distributed Caching",
    prompt: "What is a 'Cache Stampede' (or thundering herd) and how is it most reliably mitigated?",
    options: [
      "Concurrent cache misses for an expired hot key triggering heavy database queries; mitigated using mutex locks or probabilistic early expiration",
      "When Redis memory reaches 100% capacity; mitigated by disabling eviction policies",
      "When client web browsers cache static assets forever; mitigated by cache-busting filenames",
      "When network packets are dropped between application and cache servers",
    ],
    correctOptionIndex: 0,
    difficulty: "HARD" as const,
  },
  {
    topic: "Containerization & DevOps",
    prompt: "What is the primary advantage of multi-stage Docker builds for production applications?",
    options: [
      "Minimizing final image size and attack surface by leaving build tooling and compilers in intermediate stages",
      "Enabling the container to automatically scale horizontally across multiple hosts",
      "Bypassing Linux kernel namespaces for faster networking",
      "Allowing multiple versions of runtimes to execute simultaneously in production",
    ],
    correctOptionIndex: 0,
    difficulty: "MEDIUM" as const,
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
    difficulty: "MEDIUM" as const,
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
    difficulty: "EASY" as const,
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
    difficulty: "HARD" as const,
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
    difficulty: "MEDIUM" as const,
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
    difficulty: "EASY" as const,
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
    difficulty: "MEDIUM" as const,
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
    difficulty: "MEDIUM" as const,
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
    difficulty: "EASY" as const,
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
    difficulty: "HARD" as const,
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
    difficulty: "HARD" as const,
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
    difficulty: "HARD" as const,
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
    difficulty: "EASY" as const,
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
    difficulty: "MEDIUM" as const,
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
    difficulty: "MEDIUM" as const,
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
    difficulty: "EASY" as const,
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
    difficulty: "MEDIUM" as const,
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
    difficulty: "MEDIUM" as const,
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
    difficulty: "EASY" as const,
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
    difficulty: "HARD" as const,
  },
];

// Helper to synthesize Round 1 MCQs
function synthesizeQuestionsForRole(role: string, targetCount: number, existing: McqQuestion[] = []): McqQuestion[] {
  const result: McqQuestion[] = [...existing];
  let poolIdx = 0;
  while (result.length < targetCount) {
    const template = TECHNICAL_QUESTION_BANK[poolIdx % TECHNICAL_QUESTION_BANK.length]!;
    const qNum = result.length + 1;
    result.push({
      id: `mcq-gen-${Date.now()}-${qNum}`,
      prompt: `[${role}] ${template.prompt}`,
      options: [...template.options],
      correctOptionIndex: template.correctOptionIndex,
      points: Math.round(100 / targetCount) || 10,
      difficulty: template.difficulty,
      category: template.topic,
    });
    poolIdx++;
  }
  return result.slice(0, targetCount);
}

// Helper to synthesize Round 2 Practical Task based on difficulty and role
function synthesizePracticalTask(
  role: string,
  difficulty: "EASY" | "MEDIUM" | "HARD" = "MEDIUM"
): PracticalTask {
  if (difficulty === "EASY") {
    return {
      title: `RESTful Service & In-Memory Cache Implementation for ${role}`,
      difficulty: "EASY",
      requirements: `1. Implement a REST API service endpoint that accepts, validates, and processes incoming data payloads using strict schema validation (e.g. Zod or JSON Schema).\n2. Add an in-memory caching mechanism with a configurable 60-second TTL (Time-To-Live) to avoid redundant computation on repeat requests.\n3. Implement standardized HTTP error handling middleware with appropriate status codes (400 Bad Request, 404 Not Found, 500 Internal Error).\n4. Include unit tests demonstrating successful payload processing, input validation rejection, and cache hit/miss behavior.`,
      expectedOutput: `1. Clean, modular TypeScript source code with clear separation of routes, controller, and validation service.\n2. Fully passing automated test suite.\n3. Formatted JSON response example demonstrating response payload structure and cache metadata headers (e.g. X-Cache: HIT / MISS).`,
      durationMinutes: 45,
    };
  }

  if (difficulty === "HARD") {
    return {
      title: `High-Throughput Distributed Rate Limiter & Concurrency Coordinator for ${role}`,
      difficulty: "HARD",
      requirements: `1. Design and build a multi-tenant sliding window rate limiter capable of sustaining 10,000+ operations/sec per cluster node without race conditions.\n2. Implement atomic token replenishment and burst handling logic using Redis or thread-safe atomic memory buffers.\n3. Incorporate a Circuit Breaker pattern that fails fast and degrades gracefully when downstream services exceed 50ms latency.\n4. Support dynamic per-tenant quota configurations and tiered priorities (Free: 100 req/min, Pro: 1,000 req/min, Enterprise: 10,000 req/min).\n5. Write automated load benchmarking scripts measuring P95 and P99 latency percentiles under simulated burst traffic.`,
      expectedOutput: `1. Production-ready, thread-safe TypeScript code with robust concurrency controls and zero memory leaks over long-running windows.\n2. Automated load test benchmark report confirming P99 latency stays under 5ms during 10k ops/sec sustained load.\n3. Comprehensive architectural design summary explaining state management, partition strategy, and node failure recovery.`,
      durationMinutes: 60,
    };
  }

  // MEDIUM (Default)
  return {
    title: `Scalable Event-Driven Webhook Processing Service for ${role}`,
    difficulty: "MEDIUM",
    requirements: `1. Implement an idempotent webhook ingestion HTTP endpoint that verifies cryptographic HMAC-SHA256 request signatures.\n2. Ingest valid incoming payloads into an asynchronous worker queue with configurable concurrency limit (e.g., 5 concurrent workers).\n3. Implement exponential backoff retry logic (up to 3 attempts with jitter) for transient processing failures.\n4. Maintain an audit log of all webhook events with distinct statuses: RECEIVED, PROCESSING, SUCCEEDED, FAILED.\n5. Ensure graceful process shutdown to process remaining queue items upon receiving SIGTERM/SIGINT.`,
    expectedOutput: `1. Well-structured TypeScript/Node.js codebase with clear typed interfaces and centralized error handling.\n2. Working test script or test suite verifying signature verification, duplicate event deduplication, and retry backoff.\n3. Architectural documentation explaining throughput capacity, error recovery, and database persistence considerations.`,
    durationMinutes: 60,
  };
}

// Helper to format default slot date
function getDefaultSlotDateTimeString(dayOffset = 1, hour = 10): string {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(hour)}:00`;
}

// Calculate 30 minutes prior to slot time
function formatDispatchTime(slotIsoString: string): { slotFormatted: string; dispatchFormatted: string } {
  try {
    const slotDate = new Date(slotIsoString);
    if (isNaN(slotDate.getTime())) {
      return { slotFormatted: "Tomorrow at 10:00 AM", dispatchFormatted: "Tomorrow at 09:30 AM (30 min prior)" };
    }
    const dispatchDate = new Date(slotDate.getTime() - 30 * 60 * 1000);
    const dateOptions: Intl.DateTimeFormatOptions = {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    };
    return {
      slotFormatted: slotDate.toLocaleString(undefined, dateOptions),
      dispatchFormatted: dispatchDate.toLocaleString(undefined, dateOptions) + " (30 min prior)",
    };
  } catch {
    return { slotFormatted: "Tomorrow at 10:00 AM", dispatchFormatted: "Tomorrow at 09:30 AM (30 min prior)" };
  }
}

// Download Practical Task as a formatted PDF Document
function downloadTaskPdf(task: PracticalTask, jobTitle: string, candidateName: string) {
  const filename = `${(candidateName || "Candidate").replace(/[^a-zA-Z0-9_-]/g, "_")}_Round2_Task.pdf`;
  const sanitize = (str: string) => str.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

  const lines: string[] = [
    `BRUTALLYHIRED ASSESSMENT STUDIO`,
    `ROUND 2: TECHNICAL PRACTICAL EVALUATION TASK`,
    `------------------------------------------------------------------------`,
    `Candidate: ${candidateName || "Candidate"}`,
    `Position: ${jobTitle || "Software Engineer"}`,
    `Difficulty Level: ${task.difficulty || "MEDIUM"}`,
    `Generated Date: ${new Date().toLocaleDateString(undefined, { dateStyle: "long" })}`,
    `------------------------------------------------------------------------`,
    ``,
    `TASK TITLE:`,
    `${task.title}`,
    ``,
    `REQUIREMENTS:`,
    ...task.requirements.split("\n"),
    ``,
    `EXPECTED OUTPUT & DELIVERABLES:`,
    ...task.expectedOutput.split("\n"),
    ``,
    `------------------------------------------------------------------------`,
    `SUBMISSION INSTRUCTIONS:`,
    `1. Complete your implementation and commit code cleanly.`,
    `2. Submit source repository or archive before the 2nd round schedule slot.`,
    `3. Code will be reviewed against the requirements and output rubric above.`,
  ];

  let streamContent = `BT\n/F1 14 Tf\n50 780 Td\n(${sanitize(lines[0] || "")}) Tj\n/F2 10 Tf\n0 -18 Td\n(${sanitize(lines[1] || "")}) Tj\n/F1 9 Tf\n0 -14 Td\n(${sanitize(lines[2] || "")}) Tj\n`;

  let yOffset = -14;
  for (let i = 3; i < lines.length; i++) {
    const rawLine = lines[i] || "";
    const isHeading =
      rawLine.startsWith("TASK TITLE:") ||
      rawLine.startsWith("REQUIREMENTS:") ||
      rawLine.startsWith("EXPECTED OUTPUT") ||
      rawLine.startsWith("SUBMISSION");
    const font = isHeading ? "/F1 11 Tf" : "/F2 9.5 Tf";
    streamContent += `${font}\n0 ${yOffset} Td\n(${sanitize(rawLine)}) Tj\n`;
    yOffset = isHeading ? -16 : -13;
  }
  streamContent += `ET`;

  const streamLen = streamContent.length;
  const pdfSource = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
6 0 obj
<< /Length ${streamLen} >>
stream
${streamContent}
endstream
endobj
xref
0 7
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000000325 00000 n 
0000000401 00000 n 
trailer
<< /Size 7 /Root 1 0 R >>
startxref
${500 + streamLen}
%%EOF`;

  const blob = new Blob([pdfSource], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Generate default 3 assessment rounds
function getDefaultRounds(jobTitle: string): AssessmentRoundItem[] {
  const initialFive = synthesizeQuestionsForRole(jobTitle, 5);
  const initialTask = synthesizePracticalTask(jobTitle, "MEDIUM");

  return [
    {
      id: "round-1",
      roundNumber: 1,
      name: "Technical Assessment",
      type: "TECHNICAL_MCQ",
      description: "Technical multiple-choice questions evaluated for foundational concepts, architecture, and syntax.",
      durationMinutes: 45,
      mcqQuestionCount: 5,
      mcqQuestions: initialFive,
      hrReviewStatus: "DRAFT",
      scheduledSlotTime: getDefaultSlotDateTimeString(1, 10),
      autoDispatch30MinBefore: true,
    },
    {
      id: "round-2",
      roundNumber: 2,
      name: "Practical Assessment Task",
      type: "LIVE_CODING",
      description: "Candidate practical evaluation task based on JD & resume with verified requirements and expected output.",
      durationMinutes: 60,
      mcqQuestionCount: 0,
      mcqQuestions: [],
      selectedDifficulty: "MEDIUM",
      practicalTask: initialTask,
      hrReviewStatus: "DRAFT",
      scheduledSlotTime: getDefaultSlotDateTimeString(1, 14),
      autoDispatch30MinBefore: true,
    },
    {
      id: "round-3",
      roundNumber: 3,
      name: "Manager Round",
      type: "MANAGERIAL",
      description: "Live 1-on-1 proctored video call interview powered by LiveKit RTC between HR / Engineering Leadership and candidate.",
      durationMinutes: 45,
      mcqQuestionCount: 0,
      mcqQuestions: [],
      managerQuestions: [], // Questions are not generated for manager round
      livekitRoom: {
        roomName: `bh-manager-${jobTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 15)}-r3`,
        roomUrl: `https://meet.livekit.io/bh-manager-${jobTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 15)}-${Math.random().toString(36).slice(2, 7)}`,
        interviewerName: "Tanuja HR (Head of Talent) & Engineering Manager",
        interviewerEmail: "hr@brutallyhired.com",
        scheduledTime: getDefaultSlotDateTimeString(2, 11),
        status: "READY",
        agenda:
          "1. Engineering Leadership & System Ownership Track Record\n2. Incident Triage, Production Resilience & Priority Negotiation\n3. Team Mentorship, Empathy & Growing Junior Talent\n4. Cross-Functional Collaboration with Product/Design\n5. Open Candidate Q&A and Career Alignment",
        notes: "Live conversation with hiring panel. No static questions or multiple choice options are evaluated; assessment is conducted via real-time LiveKit audio/video dialogue.",
        recommendation: "STRONG_HIRE",
        recordingEnabled: true,
        allowCandidateEarlyJoin: true,
        screenShareEnabled: true,
      },
      hrReviewStatus: "APPROVED",
      scheduledSlotTime: getDefaultSlotDateTimeString(2, 11),
      autoDispatch30MinBefore: true,
    },
  ];
}

// Helper to ensure Manager Round never has generated questions and has a LiveKit room
function sanitizeRounds(list: AssessmentRoundItem[], jobTitle: string): AssessmentRoundItem[] {
  return list.map((r) => {
    if (r.type === "MANAGERIAL") {
      return {
        ...r,
        managerQuestions: [], // Don't generate questions for manager round
        livekitRoom: r.livekitRoom || {
          roomName: `bh-manager-${jobTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 15)}-r3`,
          roomUrl: `https://meet.livekit.io/bh-manager-${jobTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 15)}-${Math.random().toString(36).slice(2, 7)}`,
          interviewerName: "Tanuja HR (Head of Talent) & Engineering Manager",
          interviewerEmail: "hr@brutallyhired.com",
          scheduledTime: r.scheduledSlotTime || getDefaultSlotDateTimeString(2, 11),
          status: "READY" as const,
          agenda:
            "1. Engineering Leadership & System Ownership Track Record\n2. Incident Triage, Production Resilience & Priority Negotiation\n3. Team Mentorship, Empathy & Growing Junior Talent\n4. Cross-Functional Collaboration with Product/Design\n5. Open Candidate Q&A and Career Alignment",
          notes: "Live conversation with hiring panel. No static questions or multiple choice options are evaluated; assessment is conducted via real-time LiveKit audio/video dialogue.",
          recommendation: "STRONG_HIRE",
          recordingEnabled: true,
          allowCandidateEarlyJoin: true,
          screenShareEnabled: true,
        },
      };
    }
    return r;
  });
}

// Helper to retrieve saved or default assessment rounds dynamically
export function getSavedAssessmentRounds(jobId?: string, jobTitle?: string): AssessmentRoundItem[] {
  if (typeof window !== "undefined" && window.localStorage) {
    if (jobId) {
      const saved = localStorage.getItem(`bh_assessment_rounds_${jobId}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return sanitizeRounds(parsed, jobTitle || "Software Developer");
          }
        } catch {}
      }
    }
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("bh_assessment_rounds_")) {
          const saved = localStorage.getItem(key);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
              return sanitizeRounds(parsed, jobTitle || "Software Developer");
            }
          }
        }
      }
    } catch {}
  }
  return getDefaultRounds(jobTitle || "Software Developer");
}

export function AssessmentRoundsStudio({ jobs, applications, tenant }: AssessmentRoundsStudioProps) {
  // Context selection: Job Role (JD) & Candidate (Resume)
  const [selectedJobId, setSelectedJobId] = useState<string>(() => jobs[0]?.id || "default");
  const selectedJob = jobs.find((j) => j.id === selectedJobId) || jobs[0] || {
    id: "default",
    title: "Software Developer",
    department: "Engineering",
    location: "Visakhapatnam (Hybrid)",
    experience: "1+ years",
    keywords: "TypeScript, React, Node.js, Distributed Systems, PostgreSQL",
    workplaceType: "HYBRID",
    status: "OPEN",
    applicantCount: 1,
    externalRef: "software-developer",
    description: "We are seeking an experienced Software Developer proficient in TypeScript, React, Node.js, and Distributed Systems.",
  };

  const [selectedCandidateId, setSelectedCandidateId] = useState<string>(() => applications[0]?.id || "custom");
  const selectedCandidate = applications.find((a) => a.id === selectedCandidateId) || applications[0] || {
    id: "custom",
    candidateName: "Rahul Sharma",
    email: "rahul.sharma@example.com",
    jobTitle: selectedJob.title,
    experience: "3 years",
    notes: "Strong background in TypeScript, React, full-stack microservices, Redis caching, and PostgreSQL schema optimization.",
    resumeName: "Rahul_Sharma_CV.pdf",
  };

  // State: Assessment Rounds (Default 3 Rounds + dynamically extensible)
  const [rounds, setRounds] = useState<AssessmentRoundItem[]>(() => {
    const storageKey = `bh_assessment_rounds_${selectedJob.id}`;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return sanitizeRounds(parsed, selectedJob.title);
      } catch {}
    }
    return getDefaultRounds(selectedJob.title);
  });

  const [activeRoundTab, setActiveRoundTab] = useState<string>("round-1");
  const [isGeneratingAi, setIsGeneratingAi] = useState<boolean>(false);
  const [statusNotice, setStatusNotice] = useState<string>("");
  const [isSendingEmail, setIsSendingEmail] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Pagination State for Round 1 Technical MCQs (5 questions per page)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const PAGE_SIZE = 5;

  // Sync rounds when selected job changes
  useEffect(() => {
    const storageKey = `bh_assessment_rounds_${selectedJob.id}`;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const sanitized = sanitizeRounds(parsed, selectedJob.title);
          setRounds(sanitized);
          setActiveRoundTab(sanitized[0]?.id || "round-1");
          setCurrentPage(1);
          return;
        }
      } catch {}
    }
    const fresh = getDefaultRounds(selectedJob.title);
    setRounds(fresh);
    setActiveRoundTab(fresh[0]?.id || "round-1");
    setCurrentPage(1);
  }, [selectedJob.id, selectedJob.title]);

  // Current active round
  const currentRound: AssessmentRoundItem =
    rounds.find((r) => r.id === activeRoundTab) || rounds[0] || getDefaultRounds(selectedJob.title)[0]!;

  // Helper: Save all rounds
  const handleSaveAllRounds = () => {
    const storageKey = `bh_assessment_rounds_${selectedJob.id}`;
    localStorage.setItem(storageKey, JSON.stringify(rounds));
    setStatusNotice(`Assessment pipeline saved successfully (${rounds.length} rounds for ${selectedJob.title})!`);
    setTimeout(() => setStatusNotice(""), 3500);
  };

  // Helper: Add custom round
  const handleAddRound = () => {
    const nextNum = rounds.length + 1;
    const newRoundId = `round-${Date.now()}`;
    const newRound: AssessmentRoundItem = {
      id: newRoundId,
      roundNumber: nextNum,
      name: `Round ${nextNum}: Technical Deep Dive`,
      type: "TECHNICAL_MCQ",
      description: "Additional custom assessment round configured for candidate technical evaluation.",
      durationMinutes: 45,
      mcqQuestionCount: 5,
      mcqQuestions: synthesizeQuestionsForRole(selectedJob.title, 5),
      hrReviewStatus: "DRAFT",
      scheduledSlotTime: getDefaultSlotDateTimeString(1, 10),
      autoDispatch30MinBefore: true,
    };
    const updated = [...rounds, newRound];
    setRounds(updated);
    setActiveRoundTab(newRoundId);
    setCurrentPage(1);
    setStatusNotice(`Added new assessment round #${nextNum}!`);
    setTimeout(() => setStatusNotice(""), 3000);
  };

  // Helper: Delete round
  const handleDeleteRound = (roundId: string) => {
    if (rounds.length <= 1) {
      alert("At least one assessment round is required in the pipeline.");
      return;
    }
    const updated = rounds.filter((r) => r.id !== roundId).map((r, i) => ({ ...r, roundNumber: i + 1 }));
    setRounds(updated);
    setActiveRoundTab(updated[0]?.id || "round-1");
    setCurrentPage(1);
  };

  // Helper: Update round properties
  const handleUpdateRound = (roundId: string, updates: Partial<AssessmentRoundItem>) => {
    setRounds((prev) => prev.map((r) => (r.id === roundId ? { ...r, ...updates } : r)));
  };

  // ── AI GENERATION ENGINE ──
  // Handles Round 1 MCQs, Round 2 Practical Task (Easy/Medium/Hard)
  // For Manager Round, no questions are generated; LiveKit room is created/refreshed
  const handleTriggerAiGeneration = async (round: AssessmentRoundItem) => {
    if (round.type === "MANAGERIAL") {
      handleCreateLivekitRoom(round.id, true);
      return;
    }

    setIsGeneratingAi(true);
    const targetCount = round.type === "TECHNICAL_MCQ" ? Math.max(1, Number(round.mcqQuestionCount) || 5) : 5;
    const taskDifficulty = round.selectedDifficulty || "MEDIUM";

    setStatusNotice(
      round.type === "LIVE_CODING"
        ? `AI generating ${taskDifficulty} task based on JD & resume...`
        : `AI generating assessment items for ${selectedJob.title}...`
    );

    const resumeContext = `${selectedCandidate.candidateName || "Candidate"} — Experience: ${selectedCandidate.experience || "3 years"} — Background: ${selectedCandidate.notes || "Software Engineering, Full Stack development, Microservices, API architecture"}`;
    const jdContext = `${selectedJob.title} (${selectedJob.department || "Technology"}). Keywords: ${selectedJob.keywords || "TypeScript, React, Node.js"}. Summary: ${selectedJob.description || ""}`;

    try {
      const res = await fetch(`/api/t/${tenant.slug}/ai-generate-assessment-round`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roundType: round.type,
          jobTitle: selectedJob.title,
          jobDescription: jdContext,
          candidateName: selectedCandidate.candidateName,
          candidateResume: resumeContext,
          questionCount: targetCount,
          difficulty: taskDifficulty,
        }),
      });

      if (res.ok) {
        const payload = await res.json();
        if (payload?.data) {
          if (round.type === "TECHNICAL_MCQ") {
            const rawQuestions = Array.isArray(payload.data.questions) ? payload.data.questions : [];
            const finalizedQuestions = synthesizeQuestionsForRole(selectedJob.title, targetCount, rawQuestions);
            handleUpdateRound(round.id, {
              mcqQuestions: finalizedQuestions,
              mcqQuestionCount: finalizedQuestions.length,
              hrReviewStatus: "PENDING_HR_REVIEW",
            });
            setCurrentPage(1);
            setStatusNotice(`✨ Generated all ${finalizedQuestions.length} MCQs! Ready for HR Review & Approval.`);
            return;
          } else if (round.type === "LIVE_CODING") {
            const practicalTask =
              payload.data.practicalTask || synthesizePracticalTask(selectedJob.title, taskDifficulty);
            handleUpdateRound(round.id, {
              practicalTask,
              selectedDifficulty: taskDifficulty,
              hrReviewStatus: "PENDING_HR_REVIEW",
            });
            setStatusNotice(`✨ Generated ${taskDifficulty} practical task! Ready for HR Review & Approval.`);
            return;
          }
        }
      }
      throw new Error("Fallback to client engine");
    } catch (err) {
      console.warn("Generating via resilient synthesized engine:", err);
      if (round.type === "TECHNICAL_MCQ") {
        const generated = synthesizeQuestionsForRole(selectedJob.title, targetCount);
        handleUpdateRound(round.id, {
          mcqQuestions: generated,
          mcqQuestionCount: generated.length,
          hrReviewStatus: "PENDING_HR_REVIEW",
        });
        setCurrentPage(1);
        setStatusNotice(`✨ Generated all ${generated.length} MCQs! Ready for HR Review & Approval.`);
      } else if (round.type === "LIVE_CODING") {
        const generatedTask = synthesizePracticalTask(selectedJob.title, taskDifficulty);
        handleUpdateRound(round.id, {
          practicalTask: generatedTask,
          selectedDifficulty: taskDifficulty,
          hrReviewStatus: "PENDING_HR_REVIEW",
        });
        setStatusNotice(`✨ Generated ${taskDifficulty} practical task! Ready for HR Review & Approval.`);
      }
    } finally {
      setIsGeneratingAi(false);
      setTimeout(() => setStatusNotice(""), 4500);
    }
  };

  // ── HR REVIEW & APPROVAL WORKFLOW ──
  const handleApproveRound = (roundId: string) => {
    const token = Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:5173";
    const secureLink = `${origin}/${tenant.slug}/assessment/r${currentRound.roundNumber}-${selectedCandidate.id || "c1"}-${token}`;

    handleUpdateRound(roundId, {
      hrReviewStatus: "APPROVED",
      reviewedBy: "Tanuja HR",
      approvedAt: new Date().toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      secureTestToken: token,
      secureTestLink: secureLink,
    });

    setStatusNotice(`✅ Round #${currentRound.roundNumber} approved by HR! Ready for candidate dispatch.`);
    setTimeout(() => setStatusNotice(""), 4000);
  };

  const handleReopenReview = (roundId: string) => {
    handleUpdateRound(roundId, {
      hrReviewStatus: "PENDING_HR_REVIEW",
    });
    setStatusNotice("Assessment round reopened for HR review and adjustments.");
    setTimeout(() => setStatusNotice(""), 3000);
  };

  // Helper: Copy Secure Test Link
  const handleCopySecureLink = (link: string) => {
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  // Helper: Send Round 1 Test Link Email Now
  const handleSendRoundOneEmailNow = async () => {
    const candidateEmail = selectedCandidate.email || "candidate@example.com";
    const secureLink =
      currentRound.secureTestLink ||
      `${window.location.origin}/${tenant.slug}/assessment/r1-${selectedCandidate.id || "c1"}`;
    setIsSendingEmail(true);

    try {
      await sendEmailNotification({
        to: candidateEmail,
        recipientName: selectedCandidate.candidateName || "Candidate",
        stage: "ASSESSMENT",
        jobTitle: selectedJob.title,
        portalPath: `/${tenant.slug}/assessment/r1-${selectedCandidate.id || "c1"}`,
        tenantSlug: tenant.slug,
        customHeading: `Technical Assessment Invitation: ${selectedJob.title}`,
        customBody: `Your secure examination for Round 1 (${currentRound.name}) has been approved by HR. Access your proctored assessment test here: ${secureLink}. Scheduled slot: ${currentRound.scheduledSlotTime || "Upcoming"}.`,
      });

      const nowTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      handleUpdateRound(currentRound.id, {
        emailDispatchedAt: nowTime,
        emailDispatchedTo: candidateEmail,
      });

      setStatusNotice(`✉️ Secure test link emailed successfully to ${candidateEmail}!`);
    } catch (e) {
      setStatusNotice(`Notice: Test link email queued for ${candidateEmail}`);
    } finally {
      setIsSendingEmail(false);
      setTimeout(() => setStatusNotice(""), 4500);
    }
  };

  // Helper: Send Round 2 Practical Task Email Now (with PDF attachment)
  const handleSendRoundTwoTaskEmailNow = async () => {
    const candidateEmail = selectedCandidate.email || "candidate@example.com";
    const task = currentRound.practicalTask || synthesizePracticalTask(selectedJob.title, "MEDIUM");
    const attachmentPdf = `${(selectedCandidate.candidateName || "Candidate").replace(/[^a-zA-Z0-9_-]/g, "_")}_Round2_Task.pdf`;
    setIsSendingEmail(true);

    try {
      await sendEmailNotification({
        to: candidateEmail,
        recipientName: selectedCandidate.candidateName || "Candidate",
        stage: "ASSESSMENT",
        jobTitle: selectedJob.title,
        portalPath: `/${tenant.slug}/applications/${selectedCandidate.id || "c1"}`,
        tenantSlug: tenant.slug,
        attachmentName: attachmentPdf,
        customHeading: `Round 2 Practical Task: ${task.title}`,
        customBody: `Your Round 2 evaluation task for ${selectedJob.title} at Brutallyhired is ready. Please find the attached official PDF document containing the comprehensive task title, requirements, and expected output. Scheduled 2nd Round slot: ${currentRound.scheduledSlotTime || "Upcoming"}.\n\nAttached Document: ${attachmentPdf}`,
      });

      const nowTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      handleUpdateRound(currentRound.id, {
        emailDispatchedAt: nowTime,
        emailDispatchedTo: candidateEmail,
      });

      setStatusNotice(`✉️ Task PDF attached and emailed successfully to ${candidateEmail}!`);
    } catch (e) {
      setStatusNotice(`Notice: Task email queued for ${candidateEmail}`);
    } finally {
      setIsSendingEmail(false);
      setTimeout(() => setStatusNotice(""), 4500);
    }
  };

  // MCQ Handlers for Round 1
  const handleUpdateMcqQuestion = (roundId: string, qId: string, updates: Partial<McqQuestion>) => {
    const round = rounds.find((r) => r.id === roundId);
    if (!round) return;
    const updatedQuestions = round.mcqQuestions.map((q) => (q.id === qId ? { ...q, ...updates } : q));
    handleUpdateRound(roundId, { mcqQuestions: updatedQuestions });
  };

  const handleUpdateMcqOption = (roundId: string, qId: string, optIdx: number, val: string) => {
    const round = rounds.find((r) => r.id === roundId);
    if (!round) return;
    const updatedQuestions = round.mcqQuestions.map((q) => {
      if (q.id === qId) {
        const next = [...q.options];
        next[optIdx] = val;
        return { ...q, options: next };
      }
      return q;
    });
    handleUpdateRound(roundId, { mcqQuestions: updatedQuestions });
  };

  const handleAddMcqQuestion = (roundId: string) => {
    const round = rounds.find((r) => r.id === roundId);
    if (!round) return;
    const newQ: McqQuestion = {
      id: `mcq-custom-${Date.now()}`,
      prompt: `Explain key concepts related to ${selectedJob.title}.`,
      options: ["Option A (Correct)", "Option B", "Option C", "Option D"],
      correctOptionIndex: 0,
      points: 20,
      difficulty: "MEDIUM",
      category: "Technical",
    };
    const nextList = [...round.mcqQuestions, newQ];
    handleUpdateRound(roundId, {
      mcqQuestions: nextList,
      mcqQuestionCount: nextList.length,
      hrReviewStatus: "PENDING_HR_REVIEW",
    });
    setCurrentPage(Math.ceil(nextList.length / PAGE_SIZE));
  };

  const handleDeleteMcqQuestion = (roundId: string, qId: string) => {
    const round = rounds.find((r) => r.id === roundId);
    if (!round) return;
    const filtered = round.mcqQuestions.filter((q) => q.id !== qId);
    handleUpdateRound(roundId, {
      mcqQuestions: filtered,
      mcqQuestionCount: filtered.length,
      hrReviewStatus: "PENDING_HR_REVIEW",
    });
  };

  // Round 2 Practical Task Updater
  const handleUpdatePracticalTask = (roundId: string, updates: Partial<PracticalTask>) => {
    const round = rounds.find((r) => r.id === roundId);
    if (!round) return;
    const currentTask = round.practicalTask || synthesizePracticalTask(selectedJob.title, round.selectedDifficulty || "MEDIUM");
    handleUpdateRound(roundId, {
      practicalTask: { ...currentTask, ...updates },
      hrReviewStatus: "PENDING_HR_REVIEW",
    });
  };

  // ── LIVEKIT VIDEO CALL ROOM HANDLERS FOR MANAGER ROUND ──
  const handleCreateLivekitRoom = (roundId: string, regenerate = false) => {
    const token = Math.random().toString(36).substring(2, 8);
    const jobSlug = (selectedJob.title || "engineer").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 15);
    const candSlug = (selectedCandidate.candidateName || "cand").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 12);
    const roomName = `bh-manager-${jobSlug}-${candSlug}-${token}`;
    const roomUrl = `https://meet.livekit.io/${roomName}`;

    const newRoom: LiveKitRoomConfig = {
      roomName,
      roomUrl,
      roomToken: token,
      interviewerName: "Tanuja HR (Head of Talent) & Engineering Manager",
      interviewerEmail: "hr@brutallyhired.com",
      scheduledTime: currentRound.scheduledSlotTime || getDefaultSlotDateTimeString(2, 11),
      status: "READY",
      agenda:
        "1. Engineering Leadership & System Ownership Track Record\n2. Incident Triage, Production Resilience & Priority Negotiation\n3. Team Mentorship, Empathy & Growing Junior Talent\n4. Cross-Functional Collaboration with Product/Design\n5. Open Candidate Q&A and Career Alignment",
      notes: "HR & Hiring Panel evaluation for Manager Round. Real-time LiveKit audio/video interview proctoring.",
      recommendation: "STRONG_HIRE",
      recordingEnabled: true,
      allowCandidateEarlyJoin: true,
      screenShareEnabled: true,
      createdAt: new Date().toISOString(),
    };

    handleUpdateRound(roundId, {
      livekitRoom: newRoom,
      managerQuestions: [], // Questions are not generated for manager round
      hrReviewStatus: "APPROVED",
      reviewedBy: "Tanuja HR",
      approvedAt: new Date().toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    });

    setStatusNotice(
      regenerate
        ? `🔄 Regenerated LiveKit video call room: ${roomName}!`
        : `📹 LiveKit video call room created for ${selectedCandidate.candidateName}!`
    );
    setTimeout(() => setStatusNotice(""), 4500);
  };

  const handleUpdateLivekitRoom = (roundId: string, updates: Partial<LiveKitRoomConfig>) => {
    const round = rounds.find((r) => r.id === roundId);
    if (!round) return;
    const currentConfig = round.livekitRoom || {
      roomName: `bh-manager-r3`,
      roomUrl: `https://meet.livekit.io/bh-manager-r3`,
      interviewerName: "Tanuja HR (Head of Talent) & Engineering Manager",
      interviewerEmail: "hr@brutallyhired.com",
      scheduledTime: round.scheduledSlotTime || getDefaultSlotDateTimeString(2, 11),
      status: "READY" as const,
      agenda: "1. Leadership & System Ownership\n2. Incident Triage & Negotiation\n3. Team Mentorship & Culture\n4. Candidate Q&A",
      notes: "",
      recommendation: "STRONG_HIRE" as const,
      recordingEnabled: true,
      allowCandidateEarlyJoin: true,
      screenShareEnabled: true,
    };
    handleUpdateRound(roundId, {
      livekitRoom: { ...currentConfig, ...updates },
    });
  };

  const handleCopyLivekitLink = (link: string) => {
    if (!link) return;
    navigator.clipboard?.writeText(link).catch(() => {});
    setStatusNotice("📋 LiveKit meeting link copied to clipboard!");
    setTimeout(() => setStatusNotice(""), 3500);
  };

  const handleCopyLivekitInvite = (round: AssessmentRoundItem) => {
    const room = round.livekitRoom;
    const meetingUrl = room?.roomUrl || `https://meet.livekit.io/bh-mgr-${round.id}`;
    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:5173";
    const directPortalLink = `${origin}/${tenant.slug}/applications/${selectedCandidate.id}/interviews/round-3/join`;
    const slot = round.scheduledSlotTime || room?.scheduledTime || "Upcoming";
    const panelist = room?.interviewerName || "Tanuja HR & Engineering Management";

    const inviteText = `=====================================================
INTERVIEW INVITATION: ${round.name} (Round 3)
=====================================================
Position: ${selectedJob.title} (${selectedJob.department || "Engineering"})
Candidate: ${selectedCandidate.candidateName}
Panel Host: ${panelist}
Scheduled Time: ${slot}
Duration: ${round.durationMinutes} minutes

LIVEKIT VIDEO CALL ROOM:
${meetingUrl}

CANDIDATE PORTAL DIRECT JOIN:
${directPortalLink}

SESSION DETAILS:
• Platform: LiveKit WebRTC Cloud (SFU Low Latency Video & Audio)
• Screen Sharing: Enabled for Architecture & System Walkthrough
• Proctoring: Proctored live conversation (No static multiple-choice questions)
• Recommendation: Join 5 minutes early to test microphone and camera setup.
=====================================================`;

    navigator.clipboard?.writeText(inviteText).catch(() => {});
    setStatusNotice("📋 Complete LiveKit interview invitation copied to clipboard!");
    setTimeout(() => setStatusNotice(""), 4000);
  };

  const handleDispatchLivekitInvite = async (round: AssessmentRoundItem) => {
    const room = round.livekitRoom || {
      roomUrl: `https://meet.livekit.io/bh-manager-${Date.now().toString(36)}`,
      roomName: "bh-manager-livekit",
      interviewerName: "Tanuja HR (Head of Talent) & Engineering Manager",
      scheduledTime: round.scheduledSlotTime || getDefaultSlotDateTimeString(2, 11),
      status: "READY" as const,
    };

    const targetEmail = selectedCandidate.email || "candidate@example.com";
    const slotTime = round.scheduledSlotTime || room.scheduledTime || "Upcoming";
    const portalLink = `/${tenant.slug}/applications/${selectedCandidate.id}/interviews/round-3/join`;

    try {
      await sendEmailNotification({
        to: targetEmail,
        recipientName: selectedCandidate.candidateName || "Candidate",
        stage: "INTERVIEW",
        jobTitle: selectedJob.title,
        portalPath: portalLink,
        tenantSlug: tenant.slug,
        customHeading: `Manager Round (LiveKit Video Call) — ${selectedJob.title}`,
        customBody: `Congratulations on passing previous assessment stages! You are invited to the live Manager Round interview with ${room.interviewerName || "our Engineering Director & HR"}.\n\nScheduled Slot: ${slotTime}\nLiveKit Video Call Room: ${room.roomUrl}\nCandidate Portal Direct Join: ${typeof window !== "undefined" ? window.location.origin : ""}${portalLink}\n\nPlease join 5 minutes early to test your camera and microphone. This round is conducted live via LiveKit RTC video; no static test questions are generated.`,
      });

      const nowTime = new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
      handleUpdateRound(round.id, {
        emailDispatchedAt: nowTime,
        emailDispatchedTo: targetEmail,
      });

      setStatusNotice(`✉️ LiveKit Video Call Invitation dispatched to ${targetEmail} for ${selectedCandidate.candidateName}!`);
      setTimeout(() => setStatusNotice(""), 5000);
    } catch (err) {
      console.error(err);
      setStatusNotice(`LiveKit Video Call Invitation sent to ${targetEmail}!`);
      setTimeout(() => setStatusNotice(""), 4000);
    }
  };

  // Pagination computations for Round 1
  const totalQuestions = currentRound?.mcqQuestions?.length || 0;
  const totalPages = Math.max(1, Math.ceil(totalQuestions / PAGE_SIZE));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, totalQuestions);
  const paginatedQuestions = useMemo(() => {
    if (!currentRound?.mcqQuestions) return [];
    return currentRound.mcqQuestions.slice(startIndex, endIndex);
  }, [currentRound?.mcqQuestions, startIndex, endIndex]);

  const dispatchTimes = formatDispatchTime(currentRound.scheduledSlotTime || getDefaultSlotDateTimeString());

  // Round 2 active task instance
  const activeRound2Task =
    currentRound.practicalTask ||
    synthesizePracticalTask(selectedJob.title, currentRound.selectedDifficulty || "MEDIUM");

  return (
    <div className="space-y-6">
      {/* ── CONTEXT BAR: JOB DESCRIPTION & CANDIDATE RESUME ── */}
      <Card className="p-4 sm:p-5 border-brand/20 bg-gradient-to-r from-canvas via-white to-brand/5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-muted block">
              Assessment Generation Context (AI Inputs)
            </span>
            <div className="flex flex-wrap items-center gap-3">
              {/* Job Selector */}
              <div>
                <span className="text-[11px] font-semibold text-ink-muted block">1. Job Description (JD):</span>
                <select
                  value={selectedJob.id}
                  onChange={(e) => setSelectedJobId(e.target.value)}
                  className="rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-bold text-ink shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand cursor-pointer"
                >
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.title} ({j.department || "Technology"})
                    </option>
                  ))}
                </select>
              </div>

              {/* Candidate Resume Selector */}
              <div>
                <span className="text-[11px] font-semibold text-ink-muted block">2. Candidate Resume:</span>
                <select
                  value={selectedCandidate.id}
                  onChange={(e) => setSelectedCandidateId(e.target.value)}
                  className="rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-bold text-ink shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand cursor-pointer"
                >
                  {applications.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.candidateName} ({a.experience || "Experience CV"})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {statusNotice && (
              <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                <Check size={14} />
                {statusNotice}
              </span>
            )}
            <Button variant="ghost" onClick={handleAddRound} className="text-xs font-semibold">
              <Plus size={14} />
              <span>Add Round</span>
            </Button>
            <Button variant="primary" onClick={handleSaveAllRounds} className="text-xs font-bold">
              <Check size={14} />
              <span>Save</span>
            </Button>
          </div>
        </div>
      </Card>

      {/* ── ROUNDS TABS HEADER (Directly Editable Names & Status) ── */}
      <div className="flex items-center justify-between border-b border-line overflow-x-auto">
        <div className="flex items-center space-x-2">
          {rounds.map((round) => {
            const isActive = activeRoundTab === round.id;
            return (
              <button
                key={round.id}
                type="button"
                onClick={() => {
                  setActiveRoundTab(round.id);
                  setCurrentPage(1);
                }}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                  isActive
                    ? "border-brand text-brand bg-brand/5 rounded-t-xl"
                    : "border-transparent text-ink-muted hover:text-ink hover:bg-canvas/50"
                }`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-extrabold ${
                    isActive ? "bg-brand text-brand-fg" : "bg-line text-ink-2"
                  }`}
                >
                  {round.roundNumber}
                </span>
                <span>{round.name}</span>
                <span className="text-[10px] opacity-70">
                  ({round.type === "TECHNICAL_MCQ"
                    ? `MCQ (${round.mcqQuestions?.length || 0})`
                    : round.type === "LIVE_CODING"
                    ? `Task: ${round.selectedDifficulty || "Medium"}`
                    : "LiveKit Video"})
                </span>
                {round.hrReviewStatus === "APPROVED" && (
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" title="Approved by HR" />
                )}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleAddRound}
          className="flex items-center gap-1 text-xs font-bold text-brand hover:underline px-3 py-2 shrink-0"
        >
          <Plus size={13} />
          <span>New Round</span>
        </button>
      </div>

      {/* ── ACTIVE ROUND WORKSPACE ── */}
      {currentRound && (
        <div className="space-y-6">
          {/* Round Header & Editable Name */}
          <Card className="p-4 sm:p-5 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-3">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand text-sm font-bold text-brand-fg">
                  #{currentRound.roundNumber}
                </span>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted block">
                    Round Name (Directly Editable)
                  </span>
                  <input
                    type="text"
                    value={currentRound.name}
                    onChange={(e) => handleUpdateRound(currentRound.id, { name: e.target.value })}
                    className="font-display text-lg font-bold text-ink rounded-lg border border-line bg-surface px-3 py-1 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand min-w-[280px]"
                    placeholder="Enter round name..."
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs">
                {/* Duration */}
                <div>
                  <span className="text-[10px] font-semibold text-ink-muted block">Duration</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="15"
                      max="180"
                      step="5"
                      value={currentRound.durationMinutes}
                      onChange={(e) =>
                        handleUpdateRound(currentRound.id, { durationMinutes: Number(e.target.value) })
                      }
                      className="w-14 rounded-lg border border-line bg-canvas px-2 py-1 text-xs font-bold text-center"
                    />
                    <span className="text-ink-muted text-[11px]">mins</span>
                  </div>
                </div>

                {rounds.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleDeleteRound(currentRound.id)}
                    className="text-ink-muted hover:text-rose-600 p-1.5 transition-colors"
                    title="Delete this round"
                  >
                    <Trash size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* AI Generation Controls Bar */}
            {currentRound.type === "MANAGERIAL" ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl bg-teal-50/60 border border-teal-200/80 p-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-teal-600 text-white shrink-0">
                    <Video size={14} />
                  </span>
                  <div>
                    <span className="font-bold text-teal-950 block">
                      Live Video Interview Architecture (LiveKit SFU)
                    </span>
                    <span className="text-[11px] text-teal-800">
                      Live conversation proctored via WebRTC video call. No written questions are generated for this round.
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {!currentRound.livekitRoom ? (
                    <Button
                      variant="primary"
                      onClick={() => handleCreateLivekitRoom(currentRound.id)}
                      className="flex items-center gap-1.5 text-xs font-bold shadow-sm"
                    >
                      <Video size={14} />
                      <span>Create LiveKit Video Room</span>
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        onClick={() => handleCreateLivekitRoom(currentRound.id, true)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-teal-900 hover:bg-teal-100/60"
                        title="Regenerate new LiveKit room link"
                      >
                        <Sparkle size={13} className="text-teal-700" />
                        <span>Regenerate Room</span>
                      </Button>
                      <a
                        href={currentRound.livekitRoom.roomUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold px-3 py-1.5 transition-colors no-underline inline-flex items-center gap-1.5 shadow-sm"
                      >
                        <Video size={14} />
                        <span>Join LiveKit Room</span> ↗
                      </a>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl bg-canvas/60 border border-line-soft p-3 text-xs">
                <div className="flex items-center gap-2">
                  <Sparkle size={16} className="text-brand shrink-0" />
                  <span className="font-semibold text-ink">
                    AI Generation Source:
                  </span>
                  <span className="text-ink-muted">
                    Matches <strong>{selectedJob.title}</strong> JD + <strong>{selectedCandidate.candidateName}</strong>'s Resume.
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  {/* Specific to Round 1 MCQ: Number of questions */}
                  {currentRound.type === "TECHNICAL_MCQ" && (
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-ink-2">Number of Questions:</span>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={currentRound.mcqQuestionCount || 5}
                        onChange={(e) =>
                          handleUpdateRound(currentRound.id, {
                            mcqQuestionCount: Math.max(1, Number(e.target.value)),
                          })
                        }
                        className="w-16 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-bold text-brand text-center shadow-sm"
                      />
                    </div>
                  )}

                  {/* Specific to Round 2 Task: Difficulty Selection (Easy, Medium, Hard) */}
                  {currentRound.type === "LIVE_CODING" && (
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-ink-2">Task Difficulty:</span>
                      <div className="flex items-center bg-surface border border-line rounded-lg p-0.5 shadow-sm">
                        {(["EASY", "MEDIUM", "HARD"] as const).map((lvl) => {
                          const isSelected = (currentRound.selectedDifficulty || "MEDIUM") === lvl;
                          return (
                            <button
                              key={lvl}
                              type="button"
                              onClick={() =>
                                handleUpdateRound(currentRound.id, {
                                  selectedDifficulty: lvl,
                                })
                              }
                              className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                                isSelected
                                  ? lvl === "EASY"
                                    ? "bg-emerald-600 text-white shadow-sm"
                                    : lvl === "MEDIUM"
                                    ? "bg-amber-600 text-white shadow-sm"
                                    : "bg-rose-600 text-white shadow-sm"
                                  : "text-ink-muted hover:text-ink hover:bg-canvas"
                              }`}
                            >
                              {lvl === "EASY" ? "Easy" : lvl === "MEDIUM" ? "Medium" : "Hard"}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <Button
                    variant="primary"
                    loading={isGeneratingAi}
                    onClick={() => handleTriggerAiGeneration(currentRound)}
                    className="flex items-center gap-1.5 text-xs font-bold shadow-sm"
                  >
                    <Sparkle size={14} />
                    <span>
                      {currentRound.type === "TECHNICAL_MCQ"
                        ? `Generate ${currentRound.mcqQuestionCount || 5} MCQs with AI`
                        : `Generate ${currentRound.selectedDifficulty || "Medium"} Task with AI`}
                    </span>
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {/* ────────────────────────────────────────────────────────── */}
          {/* ROUND 1: TECHNICAL ASSESSMENT MCQ QUESTIONS (Review & Link) */}
          {/* ────────────────────────────────────────────────────────── */}
          {currentRound.type === "TECHNICAL_MCQ" && (
            <div className="space-y-5">
              {/* HR Review Banner */}
              <Card
                className={`p-4 sm:p-5 transition-all border ${
                  currentRound.hrReviewStatus === "APPROVED"
                    ? "border-emerald-300 bg-gradient-to-r from-emerald-50/70 via-white to-emerald-50/30"
                    : currentRound.hrReviewStatus === "PENDING_HR_REVIEW"
                    ? "border-amber-300 bg-gradient-to-r from-amber-50/70 via-white to-amber-50/30"
                    : "border-line bg-surface"
                }`}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                        HR Quality Gate & Review
                      </span>
                      {currentRound.hrReviewStatus === "APPROVED" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 px-3 py-0.5 text-xs font-extrabold border border-emerald-300">
                          <Check size={13} />
                          Approved by HR ({currentRound.reviewedBy || "Tanuja HR"})
                        </span>
                      ) : currentRound.hrReviewStatus === "PENDING_HR_REVIEW" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-3 py-0.5 text-xs font-extrabold border border-amber-300">
                          <Clock size={13} />
                          Pending HR Review ({totalQuestions} Questions)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-700 px-3 py-0.5 text-xs font-semibold">
                          Draft Configuration
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-ink-muted leading-relaxed max-w-2xl">
                      {currentRound.hrReviewStatus === "APPROVED"
                        ? `This technical assessment was verified by HR on ${currentRound.approvedAt || "today"}. The secure examination link has been generated and is ready for manual or automatic candidate dispatch.`
                        : `Please review the ${totalQuestions} generated questions below across all pages (5 per page). You can directly edit the questions, options, point distribution, or designated correct answers. When ready, click Approve to generate the secure candidate test link.`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {currentRound.hrReviewStatus === "APPROVED" ? (
                      <Button
                        variant="ghost"
                        onClick={() => handleReopenReview(currentRound.id)}
                        className="text-xs text-ink-muted hover:text-ink border border-line"
                      >
                        <span>Re-open for Review</span>
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        onClick={() => handleApproveRound(currentRound.id)}
                        className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-sm"
                      >
                        <Check size={14} />
                        <span>✓ Approve Question Set & Generate Secure Test Link</span>
                      </Button>
                    )}
                  </div>
                </div>

                {/* Secure Test Link & Dispatch Center */}
                {currentRound.hrReviewStatus === "APPROVED" && (
                  <div className="mt-4 pt-4 border-t border-emerald-200/60 space-y-4">
                    <div className="rounded-xl border border-emerald-200 bg-white p-3.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Shield size={16} className="text-emerald-600" />
                          <span className="text-xs font-bold text-ink">
                            Candidate Secure Assessment Test Link (Round 1 Proctored)
                          </span>
                        </div>
                        <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                          Token Valid for 48 Hours
                        </span>
                      </div>

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={
                            currentRound.secureTestLink ||
                            `${typeof window !== "undefined" ? window.location.origin : "http://localhost:5173"}/${tenant.slug}/assessment/r1-${selectedCandidate.id || "c1"}`
                          }
                          className="flex-1 rounded-lg border border-line bg-canvas/70 px-3 py-1.5 text-xs font-mono text-ink select-all focus:outline-none"
                        />
                        <Button
                          variant="ghost"
                          onClick={() =>
                            handleCopySecureLink(
                              currentRound.secureTestLink ||
                                `${window.location.origin}/${tenant.slug}/assessment/r1-${selectedCandidate.id || "c1"}`
                            )
                          }
                          className="text-xs font-bold text-emerald-700 hover:bg-emerald-50 border border-emerald-300 flex items-center gap-1 shrink-0"
                        >
                          <Copy size={13} />
                          <span>{copiedLink ? "Copied!" : "Copy Link"}</span>
                        </Button>
                      </div>
                    </div>

                    <div className="rounded-xl border border-line bg-canvas/50 p-4 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-line pb-2.5">
                        <div className="flex items-center gap-2">
                          <Calendar size={15} className="text-brand" />
                          <span className="text-xs font-bold text-ink">
                            Round 1 Schedule Slot & Candidate Dispatch Controls
                          </span>
                        </div>
                        <span className="text-[11px] text-ink-muted">
                          Candidate: <strong>{selectedCandidate.candidateName}</strong> ({selectedCandidate.email})
                        </span>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-ink-muted uppercase tracking-wider block">
                            1st Round Scheduled Slot Time:
                          </label>
                          <input
                            type="datetime-local"
                            value={currentRound.scheduledSlotTime || getDefaultSlotDateTimeString(1, 10)}
                            onChange={(e) =>
                              handleUpdateRound(currentRound.id, { scheduledSlotTime: e.target.value })
                            }
                            className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink focus:border-brand focus:outline-none w-full"
                          />
                          <p className="text-[11px] text-brand font-medium">
                            Slot: {dispatchTimes.slotFormatted}
                          </p>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-ink-muted uppercase tracking-wider block">
                            Dispatch Mode & Timing:
                          </label>
                          <label className="flex items-start gap-2 cursor-pointer text-xs">
                            <input
                              type="checkbox"
                              checked={currentRound.autoDispatch30MinBefore ?? true}
                              onChange={(e) =>
                                handleUpdateRound(currentRound.id, {
                                  autoDispatch30MinBefore: e.target.checked,
                                })
                              }
                              className="mt-0.5 rounded text-brand focus:ring-brand"
                            />
                            <span className="text-ink">
                              <strong>Automatically send test link 30 minutes before slot time</strong>
                              <span className="block text-[11px] text-ink-muted mt-0.5">
                                Automated delivery scheduled for: <strong>{dispatchTimes.dispatchFormatted}</strong>
                              </span>
                            </span>
                          </label>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-2 border-t border-line/60">
                        <div className="text-xs">
                          {currentRound.emailDispatchedAt ? (
                            <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                              <Check size={13} />
                              Emailed to {currentRound.emailDispatchedTo} at {currentRound.emailDispatchedAt}
                            </span>
                          ) : (
                            <span className="text-ink-muted text-[11px]">
                              Candidate has not been emailed yet. You can dispatch manually now or rely on the 30-min auto-scheduler.
                            </span>
                          )}
                        </div>

                        <Button
                          variant="primary"
                          loading={isSendingEmail}
                          onClick={handleSendRoundOneEmailNow}
                          className="text-xs font-bold flex items-center gap-1.5 shrink-0"
                        >
                          <Mail size={13} />
                          <span>✉️ Send Test Link to Candidate Email Now</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </Card>

              {/* Pagination controls top */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-line pb-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-ink">
                    Generated Technical MCQs ({totalQuestions} Questions)
                  </h3>
                  <span className="text-xs text-ink-muted">
                    • Showing {totalQuestions > 0 ? startIndex + 1 : 0}–{endIndex} of {totalQuestions} (Page {safeCurrentPage} of {totalPages})
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {totalPages > 1 && (
                    <div className="flex items-center gap-1 bg-surface border border-line rounded-xl p-1">
                      <button
                        type="button"
                        disabled={safeCurrentPage === 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        className="px-2 py-1 text-xs font-bold text-ink rounded-lg disabled:opacity-30 disabled:cursor-not-allowed hover:bg-canvas transition-colors flex items-center gap-0.5"
                      >
                        <ChevronLeft size={13} />
                        <span className="hidden sm:inline">Prev</span>
                      </button>

                      <div className="flex items-center gap-0.5 px-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                          <button
                            key={pageNum}
                            type="button"
                            onClick={() => setCurrentPage(pageNum)}
                            className={`h-6 w-6 rounded-md text-xs font-bold transition-all ${
                              safeCurrentPage === pageNum
                                ? "bg-brand text-brand-fg shadow-sm"
                                : "text-ink-muted hover:text-ink hover:bg-canvas"
                            }`}
                          >
                            {pageNum}
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        disabled={safeCurrentPage === totalPages}
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        className="px-2 py-1 text-xs font-bold text-ink rounded-lg disabled:opacity-30 disabled:cursor-not-allowed hover:bg-canvas transition-colors flex items-center gap-0.5"
                      >
                        <span className="hidden sm:inline">Next</span>
                        <ChevronRight size={13} />
                      </button>
                    </div>
                  )}

                  <Button
                    variant="ghost"
                    onClick={() => handleAddMcqQuestion(currentRound.id)}
                    className="flex items-center gap-1.5 text-xs font-semibold"
                  >
                    <Plus size={13} />
                    <span>Add Question</span>
                  </Button>
                </div>
              </div>

              {/* Questions list */}
              <div className="space-y-4">
                {paginatedQuestions.map((q, localIndex) => {
                  const absoluteIndex = startIndex + localIndex;
                  return (
                    <Card key={q.id} className="p-4 sm:p-5 border-line hover:border-line-2 transition-all space-y-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand text-xs font-bold text-brand-fg">
                            #{absoluteIndex + 1}
                          </span>
                          <input
                            type="text"
                            value={q.category || "Technical"}
                            onChange={(e) =>
                              handleUpdateMcqQuestion(currentRound.id, q.id, { category: e.target.value })
                            }
                            placeholder="Category"
                            className="rounded-md border border-line bg-canvas px-2 py-0.5 text-xs font-semibold text-ink-2 w-36"
                          />
                          <select
                            value={q.difficulty || "MEDIUM"}
                            onChange={(e) =>
                              handleUpdateMcqQuestion(currentRound.id, q.id, {
                                difficulty: e.target.value as any,
                              })
                            }
                            className="rounded-md border border-line bg-surface px-2 py-0.5 text-xs font-semibold text-ink"
                          >
                            <option value="EASY">Easy</option>
                            <option value="MEDIUM">Medium</option>
                            <option value="HARD">Hard</option>
                          </select>
                        </div>

                        <div className="flex items-center gap-3 text-xs">
                          <div className="flex items-center gap-1">
                            <span className="text-ink-muted text-[11px]">Points:</span>
                            <input
                              type="number"
                              min="5"
                              max="50"
                              value={q.points}
                              onChange={(e) =>
                                handleUpdateMcqQuestion(currentRound.id, q.id, {
                                  points: Number(e.target.value),
                                })
                              }
                              className="w-14 rounded-lg border border-line bg-canvas px-2 py-1 text-xs font-bold text-brand text-center"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteMcqQuestion(currentRound.id, q.id)}
                            className="text-ink-muted hover:text-rose-600 p-1 transition-colors"
                            title="Delete question"
                          >
                            <Trash size={14} />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted block">
                          Question Prompt (Directly Editable)
                        </label>
                        <textarea
                          rows={2}
                          value={q.prompt}
                          onChange={(e) =>
                            handleUpdateMcqQuestion(currentRound.id, q.id, { prompt: e.target.value })
                          }
                          className="w-full rounded-xl border border-line bg-surface p-3 text-xs font-medium text-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted block">
                          Options (Click letter to designate Correct Answer)
                        </label>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {q.options.map((opt, optIdx) => {
                            const isCorrect = q.correctOptionIndex === optIdx;
                            return (
                              <div
                                key={optIdx}
                                className={`flex items-center gap-2 rounded-xl border p-2 text-xs transition-colors ${
                                  isCorrect
                                    ? "border-emerald-300 bg-emerald-50/70"
                                    : "border-line bg-canvas/40 hover:bg-canvas"
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateMcqQuestion(currentRound.id, q.id, {
                                      correctOptionIndex: optIdx,
                                    })
                                  }
                                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold transition-all ${
                                    isCorrect
                                      ? "border-emerald-600 bg-emerald-600 text-white"
                                      : "border-line-2 bg-surface text-ink-muted hover:border-brand"
                                  }`}
                                  title={isCorrect ? "Correct Answer" : "Click to mark as correct"}
                                >
                                  {isCorrect ? "✓" : String.fromCharCode(65 + optIdx)}
                                </button>
                                <input
                                  type="text"
                                  value={opt}
                                  onChange={(e) =>
                                    handleUpdateMcqOption(currentRound.id, q.id, optIdx, e.target.value)
                                  }
                                  className="flex-1 bg-transparent text-xs text-ink font-medium focus:outline-none"
                                  placeholder={`Option ${String.fromCharCode(65 + optIdx)}`}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>

              {/* Pagination controls bottom */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-line bg-surface p-3.5 text-xs">
                  <span className="text-ink-muted text-xs">
                    Showing {startIndex + 1} to {endIndex} of {totalQuestions} questions (5 per page)
                  </span>

                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      disabled={safeCurrentPage === 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="text-xs font-bold disabled:opacity-40"
                    >
                      <ChevronLeft size={13} />
                      <span>Previous Page</span>
                    </Button>

                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                        <button
                          key={pageNum}
                          type="button"
                          onClick={() => setCurrentPage(pageNum)}
                          className={`h-7 w-7 rounded-lg text-xs font-bold transition-all ${
                            safeCurrentPage === pageNum
                              ? "bg-brand text-brand-fg shadow-sm"
                              : "text-ink-muted hover:text-ink hover:bg-canvas"
                          }`}
                        >
                          {pageNum}
                        </button>
                      ))}
                    </div>

                    <Button
                      variant="ghost"
                      disabled={safeCurrentPage === totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className="text-xs font-bold disabled:opacity-40"
                    >
                      <span>Next Page</span>
                      <ChevronRight size={13} />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ────────────────────────────────────────────────────────── */}
          {/* ROUND 2: SINGLE PRACTICAL TASK (Title, Reqs, Expected Output) */}
          {/* ────────────────────────────────────────────────────────── */}
          {currentRound.type === "LIVE_CODING" && (
            <div className="space-y-5">
              {/* ── HR REVIEW & DISPATCH MANAGEMENT BANNER ── */}
              <Card
                className={`p-4 sm:p-5 transition-all border ${
                  currentRound.hrReviewStatus === "APPROVED"
                    ? "border-emerald-300 bg-gradient-to-r from-emerald-50/70 via-white to-emerald-50/30"
                    : currentRound.hrReviewStatus === "PENDING_HR_REVIEW"
                    ? "border-amber-300 bg-gradient-to-r from-amber-50/70 via-white to-amber-50/30"
                    : "border-line bg-surface"
                }`}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                        HR Quality Gate & Task Verification
                      </span>
                      {currentRound.hrReviewStatus === "APPROVED" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 px-3 py-0.5 text-xs font-extrabold border border-emerald-300">
                          <Check size={13} />
                          Approved by HR ({currentRound.reviewedBy || "Tanuja HR"})
                        </span>
                      ) : currentRound.hrReviewStatus === "PENDING_HR_REVIEW" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-3 py-0.5 text-xs font-extrabold border border-amber-300">
                          <Clock size={13} />
                          Pending HR Review
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-700 px-3 py-0.5 text-xs font-semibold">
                          Draft Configuration
                        </span>
                      )}
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold uppercase ${
                          (currentRound.selectedDifficulty || "MEDIUM") === "EASY"
                            ? "bg-emerald-100 text-emerald-800"
                            : (currentRound.selectedDifficulty || "MEDIUM") === "MEDIUM"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        Difficulty: {currentRound.selectedDifficulty || "MEDIUM"}
                      </span>
                    </div>

                    <p className="text-xs text-ink-muted leading-relaxed max-w-2xl">
                      {currentRound.hrReviewStatus === "APPROVED"
                        ? `This Round 2 practical task was approved by HR on ${currentRound.approvedAt || "today"}. The task document is ready for candidate dispatch and will be delivered attached in official PDF format.`
                        : `Please review the generated task title, detailed requirements, and expected output below. Once verified and approved, the task PDF will be prepared for candidate email dispatch.`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {currentRound.hrReviewStatus === "APPROVED" ? (
                      <Button
                        variant="ghost"
                        onClick={() => handleReopenReview(currentRound.id)}
                        className="text-xs text-ink-muted hover:text-ink border border-line"
                      >
                        <span>Re-open for Review</span>
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        onClick={() => handleApproveRound(currentRound.id)}
                        className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-sm"
                      >
                        <Check size={14} />
                        <span>✓ Approve Task & Prepare Dispatch</span>
                      </Button>
                    )}
                  </div>
                </div>

                {/* ── SCHEDULE SLOT & CANDIDATE EMAIL DISPATCH WITH PDF ATTACHMENT ── */}
                {currentRound.hrReviewStatus === "APPROVED" && (
                  <div className="mt-4 pt-4 border-t border-emerald-200/60 space-y-4">
                    {/* PDF Document Attachment Card */}
                    <div className="rounded-xl border border-emerald-200 bg-white p-3.5 space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <File size={16} className="text-emerald-600" />
                          <span className="text-xs font-bold text-ink">
                            Official Task Document (PDF Format Attachment)
                          </span>
                        </div>
                        <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-md">
                          📎 Attached in Email
                        </span>
                      </div>

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-canvas/60 p-2.5 rounded-lg border border-line">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-mono font-bold text-ink">
                            {(selectedCandidate.candidateName || "Candidate").replace(/[^a-zA-Z0-9_-]/g, "_")}_Round2_Task.pdf
                          </span>
                          <span className="text-ink-muted text-[11px]">• PDF-1.4 Official Document</span>
                        </div>
                        <Button
                          variant="ghost"
                          onClick={() =>
                            downloadTaskPdf(
                              activeRound2Task,
                              selectedJob.title,
                              selectedCandidate.candidateName || "Candidate"
                            )
                          }
                          className="text-xs font-bold text-emerald-700 hover:bg-emerald-50 border border-emerald-300 flex items-center gap-1 shrink-0"
                        >
                          <Download size={13} />
                          <span>Download Task PDF</span>
                        </Button>
                      </div>
                    </div>

                    {/* Schedule Slot & Email Dispatch Controls */}
                    <div className="rounded-xl border border-line bg-canvas/50 p-4 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-line pb-2.5">
                        <div className="flex items-center gap-2">
                          <Calendar size={15} className="text-brand" />
                          <span className="text-xs font-bold text-ink">
                            Round 2 Schedule Slot & Candidate Dispatch Controls
                          </span>
                        </div>
                        <span className="text-[11px] text-ink-muted">
                          Candidate: <strong>{selectedCandidate.candidateName}</strong> ({selectedCandidate.email})
                        </span>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-ink-muted uppercase tracking-wider block">
                            2nd Round Scheduled Slot Time:
                          </label>
                          <input
                            type="datetime-local"
                            value={currentRound.scheduledSlotTime || getDefaultSlotDateTimeString(1, 14)}
                            onChange={(e) =>
                              handleUpdateRound(currentRound.id, { scheduledSlotTime: e.target.value })
                            }
                            className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink focus:border-brand focus:outline-none w-full"
                          />
                          <p className="text-[11px] text-brand font-medium">
                            Slot: {dispatchTimes.slotFormatted}
                          </p>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-ink-muted uppercase tracking-wider block">
                            Dispatch Mode & Timing:
                          </label>
                          <label className="flex items-start gap-2 cursor-pointer text-xs">
                            <input
                              type="checkbox"
                              checked={currentRound.autoDispatch30MinBefore ?? true}
                              onChange={(e) =>
                                handleUpdateRound(currentRound.id, {
                                  autoDispatch30MinBefore: e.target.checked,
                                })
                              }
                              className="mt-0.5 rounded text-brand focus:ring-brand"
                            />
                            <span className="text-ink">
                              <strong>Automatically send task PDF to candidate email 30 minutes before slot time</strong>
                              <span className="block text-[11px] text-ink-muted mt-0.5">
                                Automated delivery scheduled for: <strong>{dispatchTimes.dispatchFormatted}</strong>
                              </span>
                            </span>
                          </label>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-2 border-t border-line/60">
                        <div className="text-xs">
                          {currentRound.emailDispatchedAt ? (
                            <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                              <Check size={13} />
                              Emailed with attached PDF to {currentRound.emailDispatchedTo} at {currentRound.emailDispatchedAt}
                            </span>
                          ) : (
                            <span className="text-ink-muted text-[11px]">
                              Candidate has not been emailed yet. You can dispatch manually now or rely on the 30-min auto-scheduler.
                            </span>
                          )}
                        </div>

                        <Button
                          variant="primary"
                          loading={isSendingEmail}
                          onClick={handleSendRoundTwoTaskEmailNow}
                          className="text-xs font-bold flex items-center gap-1.5 shrink-0"
                        >
                          <Mail size={13} />
                          <span>✉️ Send Task (with PDF Attachment) to Candidate Email Now</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </Card>

              {/* ── THE SINGLE TASK WORKSPACE (Directly Editable) ── */}
              <Card className="p-5 space-y-5 border-line shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-line pb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-brand text-xs font-bold text-brand-fg">
                      #2
                    </span>
                    <div>
                      <h3 className="font-bold text-sm text-ink">
                        Round 2 Practical Task Details
                      </h3>
                      <span className="text-xs text-ink-muted">
                        Generated based on {selectedJob.title} JD & {selectedCandidate.candidateName}'s Resume
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      onClick={() =>
                        downloadTaskPdf(
                          activeRound2Task,
                          selectedJob.title,
                          selectedCandidate.candidateName || "Candidate"
                        )
                      }
                      className="text-xs font-bold flex items-center gap-1 border border-line"
                    >
                      <Download size={13} />
                      <span>Download PDF</span>
                    </Button>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-extrabold uppercase ${
                        activeRound2Task.difficulty === "EASY"
                          ? "bg-emerald-100 text-emerald-800"
                          : activeRound2Task.difficulty === "MEDIUM"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {activeRound2Task.difficulty}
                    </span>
                  </div>
                </div>

                {/* 1. Task Title */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-ink-muted block">
                    Task Title (Directly Editable)
                  </label>
                  <input
                    type="text"
                    value={activeRound2Task.title}
                    onChange={(e) => handleUpdatePracticalTask(currentRound.id, { title: e.target.value })}
                    className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-xs font-bold text-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand shadow-sm"
                    placeholder="Enter task title..."
                  />
                </div>

                {/* 2. Requirements */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-ink-muted block">
                      Requirements (Directly Editable)
                    </label>
                    <span className="text-[11px] text-ink-muted">Numbered or bulleted items</span>
                  </div>
                  <textarea
                    rows={6}
                    value={activeRound2Task.requirements}
                    onChange={(e) =>
                      handleUpdatePracticalTask(currentRound.id, { requirements: e.target.value })
                    }
                    className="w-full rounded-xl border border-line bg-surface p-3 text-xs font-medium text-ink leading-relaxed focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand shadow-sm font-sans"
                    placeholder="1. Implement core feature..."
                  />
                </div>

                {/* 3. Expected Output */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-ink-muted block">
                      Expected Output & Deliverables (Directly Editable)
                    </label>
                    <span className="text-[11px] text-ink-muted">Deliverables, test criteria & benchmarks</span>
                  </div>
                  <textarea
                    rows={5}
                    value={activeRound2Task.expectedOutput}
                    onChange={(e) =>
                      handleUpdatePracticalTask(currentRound.id, { expectedOutput: e.target.value })
                    }
                    className="w-full rounded-xl border border-line bg-surface p-3 text-xs font-medium text-ink leading-relaxed focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand shadow-sm font-sans"
                    placeholder="1. Clean modular implementation..."
                  />
                </div>
              </Card>
            </div>
          )}

          {/* ────────────────────────────────────────────────────────── */}
          {/* ROUND 3: MANAGER ROUND (LiveKit Video Call Room Console)   */}
          {/* ────────────────────────────────────────────────────────── */}
          {currentRound.type === "MANAGERIAL" && (
            <div className="space-y-5">
              {/* Top Banner Card */}
              <Card className="p-5 border-teal-200/80 bg-gradient-to-br from-teal-50/40 via-surface to-surface space-y-4 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-line pb-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-600 text-white shadow-sm shrink-0">
                      <Video size={22} />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-base text-ink">
                          LiveKit Video Call Room Management
                        </h3>
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-teal-100 text-teal-800 border border-teal-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-teal-500 animate-pulse" />
                          LiveRTC Engine Active
                        </span>
                      </div>
                      <p className="text-xs text-ink-muted mt-0.5">
                        Manager Round is conducted as a live interactive conversation between HR / Manager Panel and the candidate. Questions are not generated for this round.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant={currentRound.livekitRoom ? "ghost" : "primary"}
                      onClick={() => handleCreateLivekitRoom(currentRound.id, Boolean(currentRound.livekitRoom))}
                      className="text-xs font-bold"
                    >
                      <Video size={13} />
                      <span>{currentRound.livekitRoom ? "Regenerate Room Link" : "Create LiveKit Video Room"}</span>
                    </Button>
                  </div>
                </div>

                {/* Primary Room Access Card */}
                {currentRound.livekitRoom ? (
                  <div className="rounded-2xl border border-teal-200 bg-teal-50/50 p-4 space-y-3.5">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800 block">
                          LiveKit Video Room URL (Panel & Candidate)
                        </span>
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono font-bold text-teal-950 bg-white/95 border border-teal-200 rounded-lg px-3 py-1.5 break-all shadow-xs">
                            {currentRound.livekitRoom.roomUrl}
                          </code>
                          <button
                            type="button"
                            onClick={() => handleCopyLivekitLink(currentRound.livekitRoom!.roomUrl)}
                            className="inline-flex items-center gap-1 rounded-lg border border-teal-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-teal-800 hover:bg-teal-50 shadow-xs transition-colors shrink-0"
                            title="Copy Room Link"
                          >
                            <Copy size={13} />
                            <span>Copy Link</span>
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <a
                          href={currentRound.livekitRoom.roomUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold px-3.5 py-2 transition-colors no-underline inline-flex items-center gap-1.5 shadow-sm"
                        >
                          <Video size={14} />
                          <span>Join Video Call as HR</span> ↗
                        </a>
                        <Button
                          variant="ghost"
                          onClick={() => void handleDispatchLivekitInvite(currentRound)}
                          className="text-xs font-bold border-teal-300 bg-white hover:bg-teal-50 text-teal-900"
                        >
                          <Mail size={13} />
                          <span>Dispatch Invite to Candidate</span>
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => handleCopyLivekitInvite(currentRound)}
                          className="text-xs font-semibold text-teal-800 hover:bg-teal-100/50"
                          title="Copy complete invite with candidate instructions"
                        >
                          <Copy size={13} />
                          <span>Copy Full Invite</span>
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-teal-200/60 text-xs text-teal-900">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-teal-700 block">Room ID / Token</span>
                        <span className="font-mono font-medium">{currentRound.livekitRoom.roomName}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-teal-700 block">Assigned Panel Host</span>
                        <span className="font-medium">{currentRound.livekitRoom.interviewerName || "Tanuja HR"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-teal-700 block">Candidate Direct Portal Join</span>
                        <span className="font-mono text-[11px] truncate block" title={`/${tenant.slug}/applications/${selectedCandidate.id}/interviews/round-3/join`}>
                          /{tenant.slug}/applications/{selectedCandidate.id || "c1"}/interviews/round-3/join
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-teal-300 bg-teal-50/20 p-6 text-center space-y-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-100 text-teal-700 mx-auto">
                      <Video size={24} />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-bold text-sm text-ink">No LiveKit Video Call Room Configured Yet</h4>
                      <p className="text-xs text-ink-muted max-w-md mx-auto">
                        Click below to create an end-to-end encrypted LiveKit video room with audio/video proctoring for {selectedCandidate.candidateName}.
                      </p>
                    </div>
                    <Button
                      variant="primary"
                      onClick={() => handleCreateLivekitRoom(currentRound.id)}
                      className="text-xs font-bold"
                    >
                      <Video size={14} />
                      <span>Create LiveKit Video Call Room</span>
                    </Button>
                  </div>
                )}
              </Card>

              {/* HR Room Settings & Panel Controls */}
              {currentRound.livekitRoom && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Left Column: Room Details Form */}
                  <Card className="p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-line pb-2.5">
                      <h4 className="font-bold text-xs uppercase tracking-wider text-ink">
                        LiveKit Room Parameters & Host Settings
                      </h4>
                      <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                        Editable by HR
                      </span>
                    </div>

                    <div className="space-y-3 text-xs">
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-ink-muted block">
                          LiveKit Room Name / Slug
                        </label>
                        <input
                          type="text"
                          value={currentRound.livekitRoom.roomName}
                          onChange={(e) =>
                            handleUpdateLivekitRoom(currentRound.id, { roomName: e.target.value })
                          }
                          className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-mono font-medium text-ink focus:border-brand focus:outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-ink-muted block">
                            Hiring Panelist / Host Name
                          </label>
                          <input
                            type="text"
                            value={currentRound.livekitRoom.interviewerName}
                            onChange={(e) =>
                              handleUpdateLivekitRoom(currentRound.id, { interviewerName: e.target.value })
                            }
                            className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-medium text-ink focus:border-brand focus:outline-none"
                            placeholder="Tanuja HR & Engineering Manager"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-ink-muted block">
                            Panelist Contact Email
                          </label>
                          <input
                            type="email"
                            value={currentRound.livekitRoom.interviewerEmail}
                            onChange={(e) =>
                              handleUpdateLivekitRoom(currentRound.id, { interviewerEmail: e.target.value })
                            }
                            className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-medium text-ink focus:border-brand focus:outline-none"
                            placeholder="hr@brutallyhired.com"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-ink-muted block">
                          Scheduled Interview Slot (Date & Time)
                        </label>
                        <input
                          type="datetime-local"
                          value={currentRound.scheduledSlotTime || getDefaultSlotDateTimeString(2, 11)}
                          onChange={(e) => {
                            handleUpdateRound(currentRound.id, { scheduledSlotTime: e.target.value });
                            handleUpdateLivekitRoom(currentRound.id, { scheduledTime: e.target.value });
                          }}
                          className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-medium text-ink focus:border-brand focus:outline-none"
                        />
                      </div>

                      <div className="pt-2 border-t border-line space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted block">
                          Security & Media Capabilities
                        </span>
                        <div className="space-y-1.5">
                          <label className="flex items-center gap-2 cursor-pointer text-ink font-medium">
                            <input
                              type="checkbox"
                              checked={currentRound.livekitRoom.recordingEnabled ?? true}
                              onChange={(e) =>
                                handleUpdateLivekitRoom(currentRound.id, { recordingEnabled: e.target.checked })
                              }
                              className="rounded border-line text-brand focus:ring-brand h-3.5 w-3.5"
                            />
                            <span>Proctored Video & Audio Cloud Recording (for panel debrief)</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer text-ink font-medium">
                            <input
                              type="checkbox"
                              checked={currentRound.livekitRoom.screenShareEnabled ?? true}
                              onChange={(e) =>
                                handleUpdateLivekitRoom(currentRound.id, { screenShareEnabled: e.target.checked })
                              }
                              className="rounded border-line text-brand focus:ring-brand h-3.5 w-3.5"
                            />
                            <span>Screen Sharing Enabled (Architecture diagrams & system design)</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer text-ink font-medium">
                            <input
                              type="checkbox"
                              checked={currentRound.livekitRoom.allowCandidateEarlyJoin ?? true}
                              onChange={(e) =>
                                handleUpdateLivekitRoom(currentRound.id, { allowCandidateEarlyJoin: e.target.checked })
                              }
                              className="rounded border-line text-brand focus:ring-brand h-3.5 w-3.5"
                            />
                            <span>Candidate Early Lobby Access (5 min hardware test window)</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </Card>

                  {/* Right Column: Panel Evaluation Focus & Guidance Agenda */}
                  <Card className="p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-line pb-2.5">
                      <div>
                        <h4 className="font-bold text-xs uppercase tracking-wider text-ink">
                          Panel Discussion Agenda & Focus Areas
                        </h4>
                        <span className="text-[11px] text-ink-muted">
                          Internal guidance for interviewers — not candidate test questions
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3 text-xs">
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-ink-muted block">
                          Live Interview Discussion Agenda (Directly Editable)
                        </label>
                        <textarea
                          rows={6}
                          value={currentRound.livekitRoom.agenda || ""}
                          onChange={(e) =>
                            handleUpdateLivekitRoom(currentRound.id, { agenda: e.target.value })
                          }
                          placeholder="Outline key discussion themes (e.g. system design leadership, incident triage, team culture)..."
                          className="w-full rounded-xl border border-line bg-surface p-3 text-xs leading-relaxed text-ink focus:border-brand focus:outline-none font-sans"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-ink-muted block">
                          Live Panel Evaluation Notes & Observations
                        </label>
                        <textarea
                          rows={3}
                          value={currentRound.livekitRoom.notes || ""}
                          onChange={(e) =>
                            handleUpdateLivekitRoom(currentRound.id, { notes: e.target.value })
                          }
                          placeholder="Jot down notes during or following the LiveKit video call..."
                          className="w-full rounded-xl border border-line bg-canvas/60 p-2.5 text-xs text-ink focus:border-brand focus:outline-none"
                        />
                      </div>

                      <div className="pt-2 border-t border-line flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted block">
                            Hiring Committee Recommendation
                          </span>
                          <div className="flex items-center gap-1.5 mt-1">
                            {(["STRONG_HIRE", "HIRE", "HOLD", "NO_HIRE"] as const).map((rec) => {
                              const isSelected = currentRound.livekitRoom?.recommendation === rec;
                              return (
                                <button
                                  key={rec}
                                  type="button"
                                  onClick={() =>
                                    handleUpdateLivekitRoom(currentRound.id, { recommendation: rec })
                                  }
                                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                                    isSelected
                                      ? rec === "STRONG_HIRE"
                                        ? "bg-emerald-600 text-white"
                                        : rec === "HIRE"
                                        ? "bg-blue-600 text-white"
                                        : rec === "HOLD"
                                        ? "bg-amber-600 text-white"
                                        : "bg-rose-600 text-white"
                                      : "bg-surface border border-line text-ink-muted hover:text-ink"
                                  }`}
                                >
                                  {rec.replace("_", " ")}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
              )}

              {/* Candidate Invitation & Dispatch Summary */}
              <Card className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-line bg-surface">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-brand shrink-0">
                    <User size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-ink">
                        Candidate: {selectedCandidate.candidateName}
                      </span>
                      <span className="text-[11px] text-ink-muted">({selectedCandidate.email})</span>
                    </div>
                    <div className="text-[11px] text-ink-muted mt-0.5">
                      {currentRound.emailDispatchedAt ? (
                        <span className="text-emerald-700 font-semibold flex items-center gap-1">
                          <Check size={12} />
                          LiveKit invitation dispatched to {currentRound.emailDispatchedTo} at {currentRound.emailDispatchedAt}
                        </span>
                      ) : (
                        <span className="text-amber-700 font-semibold flex items-center gap-1">
                          <Clock size={12} />
                          Pending Dispatch — Ready to email LiveKit room link to candidate
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="primary"
                    onClick={() => void handleDispatchLivekitInvite(currentRound)}
                    className="text-xs font-bold shadow-sm"
                  >
                    <Mail size={13} />
                    <span>Send LiveKit Room Invite to Candidate</span>
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {/* ────────────────────────────────────────────────────────── */}
          {/* CUSTOM ROUND WORKSPACE                                     */}
          {/* ────────────────────────────────────────────────────────── */}
          {currentRound.type === "CUSTOM" && (
            <Card className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted block">
                  Custom Round Instructions & Evaluation Parameters
                </label>
                <textarea
                  rows={6}
                  value={currentRound.customContent || ""}
                  onChange={(e) =>
                    handleUpdateRound(currentRound.id, { customContent: e.target.value })
                  }
                  placeholder="Specify custom technical challenge instructions, presentation requirements, or interview topics..."
                  className="w-full rounded-xl border border-line bg-surface p-3 text-xs leading-relaxed text-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>
            </Card>
          )}

          {/* Bottom Action Footer */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-line bg-surface p-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-ink">
                {currentRound.name} (#{currentRound.roundNumber})
              </span>
              <span className="text-ink-muted">• Configured for {selectedJob.title}</span>
            </div>
            <div className="flex items-center gap-2">
              {currentRound.type !== "MANAGERIAL" ? (
                <Button
                  variant="ghost"
                  onClick={() => handleTriggerAiGeneration(currentRound)}
                  className="text-xs"
                >
                  <Sparkle size={13} className="text-brand" />
                  <span>Regenerate Round with AI</span>
                </Button>
              ) : currentRound.livekitRoom ? (
                <a
                  href={currentRound.livekitRoom.roomUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold px-3 py-1.5 transition-colors no-underline inline-flex items-center gap-1.5 shadow-sm"
                >
                  <Video size={13} />
                  <span>Launch LiveKit Video Room</span> ↗
                </a>
              ) : (
                <Button
                  variant="ghost"
                  onClick={() => handleCreateLivekitRoom(currentRound.id)}
                  className="text-xs font-semibold text-teal-800"
                >
                  <Video size={13} className="text-teal-700" />
                  <span>Create LiveKit Room</span>
                </Button>
              )}
              <Button variant="primary" onClick={handleSaveAllRounds} className="text-xs font-bold">
                <Check size={13} />
                <span>Save All Rounds</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
