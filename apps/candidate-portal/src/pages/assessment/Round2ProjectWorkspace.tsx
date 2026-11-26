import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { clsx } from "clsx";
import { useTenantCtx } from "@/components/layout/TenantContext";
import { Button } from "@/components/ui/Button";
import { Alert, Check, File, Plus, Shield, Sparkle, Trash, Upload } from "@/components/ui/icons";
import type { useProctoring } from "@/hooks/useProctoring";
import type { ProctoringViolationReport } from "./AssessmentRunner";

export interface Round2TaskSpecDto {
  title: string;
  description: string;
  problemStatement: string;
  objectives: string[];
  functionalRequirements: string[];
  technicalRequirements: string[];
  requiredTechnologies: string[];
  expectedDeliverables: string[];
  implementationInstructions: string[];
  evaluationCriteria: Array<{ id: string; name: string; description: string; maxMarks: number }>;
  testCases: Array<{ id: string; title: string; input: string; expectedBehavior: string }>;
  starterFiles: Array<{ filename: string; language: string; content: string }>;
  durationMinutes: number;
  totalMarks: number;
  difficulty: string;
}

export interface Round2ProjectDto {
  id: string;
  applicationId: string;
  status: string;
  taskSpec: Round2TaskSpecDto;
  durationMinutes: number;
  totalMarks: number;
  scheduledSlotStart?: string | null;
  scheduledSlotEnd?: string | null;
  dueAt?: string | null;
  startedAt?: string | null;
  submittedAt?: string | null;
}

export function Round2ProjectWorkspace({
  project,
  appId,
  candidateName,
  candidateEmail,
  jobTitle,
  proctor,
  portMonitorOnline,
  onSubmitted,
}: {
  project: Round2ProjectDto;
  appId: string;
  candidateName: string;
  candidateEmail: string;
  jobTitle: string;
  proctor: ReturnType<typeof useProctoring>;
  portMonitorOnline: boolean;
  onSubmitted: (result: { aiReport?: any }) => void;
}) {
  const tenant = useTenantCtx();
  const spec = project.taskSpec;

  const [files, setFiles] = useState<Array<{ filename: string; language: string; content: string }>>(() => {
    try {
      const draft = localStorage.getItem(`bh_r2_draft_${appId}`);
      if (draft) {
        const parsed = JSON.parse(draft);
        if (Array.isArray(parsed.files) && parsed.files.length > 0) return parsed.files;
      }
    } catch {}
    return spec.starterFiles?.length
      ? spec.starterFiles
      : [{ filename: "src/index.ts", language: "typescript", content: "// Implement your solution here\n" }];
  });

  const [activeFileIdx, setActiveFileIdx] = useState(0);
  const [newFileName, setNewFileName] = useState("");
  const [architectureNotes, setArchitectureNotes] = useState<string>(() => {
    try {
      const draft = localStorage.getItem(`bh_r2_draft_${appId}`);
      if (draft) {
        const parsed = JSON.parse(draft);
        if (typeof parsed.architectureNotes === "string") return parsed.architectureNotes;
      }
    } catch {}
    return "";
  });
  const [repoUrl, setRepoUrl] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [clientCheckMsg, setClientCheckMsg] = useState<string | null>(null);

  // Timer based on startedAt + durationMinutes
  const [leftSeconds, setLeftSeconds] = useState(() => {
    const durSec = (project.durationMinutes || spec.durationMinutes || 90) * 60;
    if (project.startedAt) {
      const elapsed = Math.floor((Date.now() - new Date(project.startedAt).getTime()) / 1000);
      return Math.max(0, durSec - elapsed);
    }
    return durSec;
  });

  const finishedRef = useRef(false);
  const lastViolationTime = useRef(0);
  const [violationReports, setViolationReports] = useState<ProctoringViolationReport[]>([]);
  const [isDisqualified, setIsDisqualified] = useState(false);
  const [hardwareState, setHardwareState] = useState({
    power: "AC Power Connected",
    usbCount: 0,
    displaysCount: 1,
    isOnline: portMonitorOnline,
  });

  // Autosave draft locally
  useEffect(() => {
    try {
      localStorage.setItem(`bh_r2_draft_${appId}`, JSON.stringify({ files, architectureNotes, repoUrl }));
    } catch {}
  }, [appId, files, architectureNotes, repoUrl]);

  // Countdown timer
  useEffect(() => {
    const id = window.setInterval(() => {
      setLeftSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const recordViolation = useCallback(
    (
      eventType: string,
      description: string,
      severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "HIGH",
      source: ProctoringViolationReport["source"] = "BROWSER_FOCUS",
    ) => {
      if (finishedRef.current) return;
      const now = Date.now();
      if (now - lastViolationTime.current < 1500) return;
      lastViolationTime.current = now;

      setViolationReports((prev) => {
        if (prev.length >= 5) return prev;
        const num = prev.length + 1;
        const nextReport: ProctoringViolationReport = {
          id: `r2-rep-${num}-${Date.now()}`,
          incidentNumber: num,
          eventType,
          description,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          severity: num >= 5 ? "CRITICAL" : severity,
          source,
        };
        const updated = [...prev, nextReport];

        fetch(`/api/t/${tenant.slug}/proctoring/telemetry`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-verity-csrf": "1" },
          body: JSON.stringify({
            candidateId: appId,
            candidateName,
            candidateEmail,
            jobTitle,
            report: nextReport,
            totalViolations: updated.length,
            isDisqualified: updated.length >= 5,
          }),
        }).catch(() => {});

        if (updated.length >= 5) {
          setIsDisqualified(true);
        }
        return updated;
      });
    },
    [appId, candidateEmail, candidateName, jobTitle, tenant.slug],
  );

  // Browser focus & visibility proctoring
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        recordViolation("TAB_SWITCH", "Candidate switched away from the Round 2 workspace tab.", "HIGH", "BROWSER_FOCUS");
      }
    };
    const onBlur = () => {
      recordViolation("WINDOW_BLUR", "Round 2 assessment window lost active focus.", "MEDIUM", "BROWSER_FOCUS");
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
    };
  }, [recordViolation]);

  // Port Monitor 4899 polling
  useEffect(() => {
    const id = window.setInterval(async () => {
      try {
        const res = await fetch("http://127.0.0.1:4899/status");
        const data = await res.json();
        if (data?.status === "ONLINE") {
          setHardwareState({
            power: data.power?.label || "AC Power Connected",
            usbCount: data.usb?.count || 0,
            displaysCount: data.displays?.count || 1,
            isOnline: true,
          });
          if (data.displays?.count > 1) {
            recordViolation("MULTI_DISPLAY", `External display detected (${data.displays.count} monitors).`, "HIGH", "DISPLAY_GUARD");
          }
        }
      } catch {}
    }, 3000);
    return () => window.clearInterval(id);
  }, [recordViolation]);

  const handleAddFile = () => {
    const clean = newFileName.trim();
    if (!clean) return;
    if (files.some((f) => f.filename === clean)) {
      setActiveFileIdx(files.findIndex((f) => f.filename === clean));
      setNewFileName("");
      return;
    }
    const ext = clean.split(".").pop()?.toLowerCase() || "ts";
    const lang = ext === "py" ? "python" : ext === "json" ? "json" : ext === "md" ? "markdown" : "typescript";
    setFiles((prev) => [...prev, { filename: clean, language: lang, content: "" }]);
    setActiveFileIdx(files.length);
    setNewFileName("");
  };

  const handleUploadFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const loaded: Array<{ filename: string; language: string; content: string }> = [];
    for (const f of Array.from(fileList)) {
      if (f.size > 512_000) continue;
      const text = await f.text();
      loaded.push({
        filename: f.name,
        language: f.name.endsWith(".py") ? "python" : "typescript",
        content: text,
      });
    }
    if (loaded.length > 0) {
      setFiles((prev) => {
        const next = [...prev];
        for (const item of loaded) {
          const idx = next.findIndex((x) => x.filename === item.filename);
          if (idx >= 0) next[idx] = item;
          else next.push(item);
        }
        return next;
      });
    }
    e.target.value = "";
  };

  const runQuickValidation = () => {
    const nonEmpty = files.filter((f) => f.content.trim().length > 15);
    if (nonEmpty.length === 0) {
      setClientCheckMsg("Warning: Please implement code in at least one source file before submitting.");
      return;
    }
    let unbalanced = 0;
    for (const f of nonEmpty) {
      const open = (f.content.match(/\{/g) || []).length;
      const close = (f.content.match(/\}/g) || []).length;
      if (open !== close) unbalanced++;
    }
    if (unbalanced > 0) {
      setClientCheckMsg(`Check warning: ${unbalanced} file(s) may have unbalanced curly braces.`);
    } else {
      setClientCheckMsg(`Ready: ${nonEmpty.length} implemented file(s) and ${architectureNotes.trim().length} chars of rationale.`);
    }
  };

  const handleSubmitProject = async (forcedDisqualified = false) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/t/${tenant.slug}/workflow/applications/${appId}/round2/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-verity-csrf": "1" },
        body: JSON.stringify({
          submissionFiles: files,
          architectureNotes,
          repoUrl,
          proctoringReports: violationReports,
          disqualified: forcedDisqualified || isDisqualified,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to submit Round 2 project.");
      }
      proctor.stop();
      localStorage.removeItem(`bh_r2_draft_${appId}`);
      onSubmitted({ aiReport: data.aiReport });
    } catch (err: any) {
      finishedRef.current = false;
      setSubmitError(err?.message || "Submission failed. Please retry.");
    } finally {
      setSubmitting(false);
    }
  };

  if (isDisqualified) {
    return (
      <div className="mx-auto max-w-2xl py-10">
        <div className="card border-rose-200 bg-rose-50/70 p-8 text-center space-y-4">
          <Alert size={36} className="mx-auto text-rose-600" />
          <h2 className="text-xl font-bold text-rose-950">Assessment Terminated (5/5 Proctoring Violations)</h2>
          <p className="text-sm text-rose-800">
            The session recorded 5 integrity violations. Your current deliverables will be logged with the proctoring report for HR review.
          </p>
          <div className="flex justify-center gap-3">
            <Button loading={submitting} onClick={() => void handleSubmitProject(true)}>
              Record & Exit Session
            </Button>
            <Link to={`/${tenant.slug}/applications/${appId}`} className="inline-flex items-center px-4 py-2 text-sm font-semibold text-ink">
              Return to Overview
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const mm = String(Math.floor(leftSeconds / 60)).padStart(2, "0");
  const ss = String(leftSeconds % 60).padStart(2, "0");
  const curFile = files[activeFileIdx] ?? files[0]!;

  return (
    <div className="flex flex-col gap-5 pb-12">
      {/* Top Bar */}
      <header className="card flex flex-wrap items-center justify-between gap-4 px-5 py-3.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-bold text-brand">
              ROUND 2 TECHNICAL PROJECT
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-ink-2">
              {spec.difficulty || "MEDIUM"} · {spec.totalMarks || 100} Marks
            </span>
          </div>
          <h1 className="mt-1 text-lg font-bold text-ink">{spec.title}</h1>
        </div>
        <div className="flex items-center gap-3">
          <div
            className={clsx(
              "rounded-xl border px-3.5 py-1.5 font-mono text-base font-bold",
              leftSeconds < 300 ? "border-rose-300 bg-rose-50 text-rose-700" : "border-line bg-canvas text-ink",
            )}
          >
            {mm}:{ss}
          </div>
          <Button onClick={() => setConfirmSubmit(true)}>Submit Deliverables</Button>
        </div>
      </header>

      {confirmSubmit && (
        <div className="card border-brand/30 bg-brand-soft/40 p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-bold text-ink text-sm">Ready to submit your Round 2 technical project for AI & HR evaluation?</p>
            <p className="text-xs text-ink-muted mt-0.5">
              Submitting will run automated code validation + Qwen AI rubric scoring and notify HR. You cannot edit after submission.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => setConfirmSubmit(false)} disabled={submitting}>
              Keep Editing
            </Button>
            <Button loading={submitting} onClick={() => void handleSubmitProject(false)}>
              Confirm & Submit Project
            </Button>
          </div>
          {submitError && <p className="w-full text-xs text-rose-700 font-semibold">{submitError}</p>}
        </div>
      )}

      <div className="flex flex-wrap items-start gap-5">
        {/* Main Column: Project Spec + Code Workspace */}
        <div className="flex min-w-0 flex-[999_1_640px] flex-col gap-5">
          {/* Specification Card */}
          <section className="card p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-bold text-ink flex items-center gap-2">
                <Sparkle size={16} className="text-brand" /> Project Specification & Requirements
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {spec.requiredTechnologies?.map((tech) => (
                  <span key={tech} className="rounded-full border border-line bg-canvas px-2.5 py-0.5 text-[11px] font-semibold text-ink-2">
                    {tech}
                  </span>
                ))}
              </div>
            </div>
            <p className="text-sm text-ink-2 leading-relaxed">{spec.problemStatement || spec.description}</p>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-line-soft bg-canvas p-4 space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">Functional Requirements</h3>
                <ul className="space-y-1.5 text-xs text-ink-2 list-disc pl-4">
                  {spec.functionalRequirements?.map((fr, idx) => (
                    <li key={idx}>{fr}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-line-soft bg-canvas p-4 space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">Evaluation Rubric ({spec.totalMarks} Marks)</h3>
                <ul className="space-y-1.5 text-xs text-ink-2">
                  {spec.evaluationCriteria?.map((c) => (
                    <li key={c.id} className="flex items-start justify-between gap-2">
                      <span>{c.name}</span>
                      <strong className="shrink-0 text-ink">{c.maxMarks} pts</strong>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {spec.testCases?.length > 0 && (
              <div className="rounded-xl border border-line-soft bg-canvas p-4 space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">Test Cases & Validation Requirements</h3>
                <div className="grid gap-2 md:grid-cols-3">
                  {spec.testCases.map((tc) => (
                    <div key={tc.id} className="rounded-lg bg-white border border-line p-2.5 text-xs">
                      <p className="font-semibold text-ink">{tc.title}</p>
                      <p className="text-ink-muted mt-0.5">Input: {tc.input}</p>
                      <p className="text-emerald-700 mt-0.5">Expected: {tc.expectedBehavior}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Code Files Workspace */}
          <section className="card p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-bold text-ink flex items-center gap-2">
                <File size={16} className="text-brand" /> Source Code & Project Deliverables
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-canvas">
                  <Upload size={14} /> Upload Source Files
                  <input type="file" multiple className="hidden" onChange={(e) => void handleUploadFiles(e)} />
                </label>
                <Button variant="ghost" onClick={runQuickValidation}>
                  <Check size={14} /> Quick Check
                </Button>
              </div>
            </div>

            {clientCheckMsg && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-medium text-blue-900">
                {clientCheckMsg}
              </div>
            )}

            {/* File Tabs */}
            <div className="flex flex-wrap items-center gap-2 border-b border-line-soft pb-3">
              {files.map((f, idx) => (
                <div
                  key={f.filename}
                  className={clsx(
                    "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-mono",
                    idx === activeFileIdx ? "border-ink bg-ink text-white" : "border-line bg-canvas text-ink-2",
                  )}
                >
                  <button type="button" onClick={() => setActiveFileIdx(idx)} className="font-semibold">
                    {f.filename}
                  </button>
                  {files.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        setFiles((prev) => prev.filter((_, i) => i !== idx));
                        setActiveFileIdx(0);
                      }}
                      className="opacity-70 hover:opacity-100"
                      title="Remove file"
                    >
                      <Trash size={12} />
                    </button>
                  )}
                </div>
              ))}
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  placeholder="e.g. src/utils.ts"
                  className="h-8 w-36 rounded-lg border border-line px-2.5 text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={handleAddFile}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-line bg-white px-2.5 text-xs font-semibold hover:bg-canvas"
                >
                  <Plus size={12} /> Add
                </button>
              </div>
            </div>

            {curFile && (
              <textarea
                rows={16}
                spellCheck={false}
                value={curFile.content}
                onChange={(e) => {
                  const val = e.target.value;
                  setFiles((prev) => prev.map((item, idx) => (idx === activeFileIdx ? { ...item, content: val } : item)));
                }}
                className="w-full rounded-xl border border-line-2 bg-slate-950 p-4 font-mono text-[13px] leading-relaxed text-slate-100 focus:border-brand focus:outline-none"
                placeholder="// Write your implementation here..."
              />
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-ink">Architecture & Implementation Rationale</label>
                <textarea
                  rows={5}
                  value={architectureNotes}
                  onChange={(e) => setArchitectureNotes(e.target.value)}
                  placeholder="Explain your architecture, trade-offs, error handling, and how requirements are satisfied..."
                  className="w-full rounded-xl border border-line-2 p-3 text-xs leading-relaxed focus:border-brand focus:outline-none"
                />
              </div>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-ink">Repository / Demo URL (Optional)</label>
                  <input
                    type="url"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    placeholder="https://github.com/username/project"
                    className="h-10 w-full rounded-xl border border-line-2 px-3 text-xs focus:border-brand focus:outline-none"
                  />
                </div>
                <div className="rounded-xl border border-line-soft bg-canvas p-3 text-xs text-ink-muted">
                  <strong className="text-ink block mb-1">Expected Deliverables:</strong>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {spec.expectedDeliverables?.map((d, idx) => (
                      <li key={idx}>{d}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Proctoring Sidebar (Consistent with Round 1) */}
        <aside className="flex flex-[1_1_280px] flex-col gap-4">
          <section className="card flex flex-col gap-3 p-4 bg-gradient-to-br from-white to-blue-50/40 border border-blue-100">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-bold text-xs text-ink">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>BrutalAssessAI™ Telemetry</span>
              </span>
              <span
                className={clsx(
                  "rounded-full text-[10px] font-bold px-2 py-0.5",
                  hardwareState.isOnline ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800",
                )}
              >
                {hardwareState.isOnline ? "PORT MONITOR 4899" : "WEB TELEMETRY"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-white p-2 border border-line">
                <span className="text-[10px] text-ink-muted uppercase block font-medium">External Ports</span>
                <strong className="text-ink text-xs block mt-0.5">{hardwareState.usbCount} USB Devices</strong>
              </div>
              <div className="rounded-lg bg-white p-2 border border-line">
                <span className="text-[10px] text-ink-muted uppercase block font-medium">Active Displays</span>
                <strong className="text-ink text-xs block mt-0.5">{hardwareState.displaysCount} Monitored</strong>
              </div>
              <div className="rounded-lg bg-white p-2 border border-line">
                <span className="text-[10px] text-ink-muted uppercase block font-medium">Power Source</span>
                <strong className="text-emerald-700 text-xs block mt-0.5">{hardwareState.power}</strong>
              </div>
              <div className="rounded-lg bg-white p-2 border border-line">
                <span className="text-[10px] text-ink-muted uppercase block font-medium">Integrity Limit</span>
                <strong className={clsx("text-xs block mt-0.5 font-bold", violationReports.length >= 4 ? "text-rose-700" : "text-amber-700")}>
                  {violationReports.length} of 5 Violations
                </strong>
              </div>
            </div>

            <div className="rounded-xl border border-line bg-white p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-ink">
                <Shield size={14} className="text-brand" /> Live Proctoring Feed
              </div>
              {violationReports.length === 0 ? (
                <p className="text-[11px] text-emerald-700">No integrity violations recorded. Session clean.</p>
              ) : (
                <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                  {violationReports.map((rep) => (
                    <li key={rep.id} className="rounded-lg bg-rose-50 border border-rose-200 p-2 text-[11px]">
                      <span className="font-bold text-rose-800">#{rep.incidentNumber} {rep.eventType}</span>
                      <p className="text-rose-700">{rep.description}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
