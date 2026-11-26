import { useCallback, useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";
import { Button } from "@/components/ui/Button";
import { Alert, Check, Clock, Mail, Shield, Sparkle, User, Video } from "@/components/ui/icons";

interface WorkflowProps {
  tenantSlug: string;
  adminEmail?: string;
  onFeedback?: (msg: string) => void;
}

export function RecruitmentWorkflowModule({ tenantSlug, adminEmail = "admin@brutallyhired.com", onFeedback }: WorkflowProps) {
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState<any[]>([]);
  const [emailLogs, setEmailLogs] = useState<any[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [activeSubView, setActiveSubView] = useState<"PIPELINE" | "EMAILS">("PIPELINE");
  const [activeRoundTab, setActiveRoundTab] = useState<"R1" | "R2" | "R3">("R1");

  // Filters
  const [filterJob, setFilterJob] = useState("ALL");
  const [filterRound, setFilterRound] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDate, setFilterDate] = useState("");

  // Action states
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [r1Duration, setR1Duration] = useState(45);
  const [r1SlotStart, setR1SlotStart] = useState("");
  const [r1Comments, setR1Comments] = useState("");

  const [r2Difficulty, setR2Difficulty] = useState<"EASY" | "MEDIUM" | "HARD">("MEDIUM");
  const [r2Duration, setR2Duration] = useState(90);
  const [r2SlotStart, setR2SlotStart] = useState("");
  const [r2EditTitle, setR2EditTitle] = useState("");
  const [r2EditProblem, setR2EditProblem] = useState("");
  const [r2EditReqs, setR2EditReqs] = useState("");
  const [r2Comments, setR2Comments] = useState("");

  const [r3SlotStart, setR3SlotStart] = useState("");
  const [r3Panelist, setR3Panelist] = useState("Tanuja HR");
  const [r3Feedback, setR3Feedback] = useState("");
  const [r3Score, setR3Score] = useState(88);
  const [r3Recommendation, setR3Recommendation] = useState<"HIRE" | "NO_HIRE" | "HOLD">("HIRE");

  const notify = (msg: string) => {
    if (onFeedback) onFeedback(msg);
  };

  const fetchPipeline = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/t/${encodeURIComponent(tenantSlug)}/workflow/applications`);
      if (res.ok) {
        const data = await res.json();
        setApplications(Array.isArray(data.applications) ? data.applications : []);
        setEmailLogs(Array.isArray(data.emailLogs) ? data.emailLogs : []);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [tenantSlug]);

  useEffect(() => {
    void fetchPipeline();
  }, [fetchPipeline]);

  const selectedApp = useMemo(
    () => applications.find((a) => a.id === selectedAppId) || null,
    [applications, selectedAppId],
  );

  // Sync Round 2 edit fields when selecting a candidate
  useEffect(() => {
    if (!selectedApp) return;
    const spec = selectedApp.technicalProject?.taskSpec;
    if (spec) {
      setR2EditTitle(spec.title || "");
      setR2EditProblem(spec.problemStatement || spec.description || "");
      setR2EditReqs(Array.isArray(spec.functionalRequirements) ? spec.functionalRequirements.join("\n") : "");
      setR2Duration(selectedApp.technicalProject?.durationMinutes || 90);
    }
    const r3 = selectedApp.interviewRounds?.find((r: any) => r.sequence === 3);
    if (r3) {
      setR3Feedback(r3.hrFeedback || "");
      if (typeof r3.hrScore === "number") setR3Score(r3.hrScore);
    }
  }, [selectedApp]);

  const uniqueJobs = useMemo(() => {
    const map = new Map<string, string>();
    applications.forEach((a) => {
      if (a.job?.id && a.job?.title) map.set(a.job.id, a.job.title);
    });
    return Array.from(map.entries());
  }, [applications]);

  const filteredApps = useMemo(() => {
    return applications.filter((a) => {
      if (filterJob !== "ALL" && a.jobId !== filterJob) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const hay = `${a.user?.displayName || ""} ${a.user?.email || ""} ${a.job?.title || ""} ${a.reference || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filterDate) {
        const d = (a.submittedAt || a.createdAt || "").slice(0, 10);
        if (d !== filterDate) return false;
      }
      const r1 = a.assessmentInvites?.[0];
      const r2 = a.technicalProject;
      const r3 = a.interviewRounds?.find((r: any) => r.sequence === 3);
      if (filterRound === "R1" && !r1 && a.stage !== "ASSESSMENT") return false;
      if (filterRound === "R2" && !r2) return false;
      if (filterRound === "R3" && !r3) return false;
      if (filterStatus === "PENDING_HR") {
        const r1Pending = (r1?.status === "SUBMITTED" && r1?.hrReviewStatus === "PENDING") || a.stage === "ROUND1_PENDING_HR_APPROVAL";
        const r2Pending = (r2?.status === "AI_EVALUATION_COMPLETED" && r2?.hrDecision === "PENDING") || a.stage === "ROUND2_PENDING_HR_APPROVAL";
        const r3Pending = (r3 && r3.hrDecision !== "HIRED" && r3.hrDecision !== "REJECTED") || a.stage === "ROUND3_PENDING_FINAL_HR_APPROVAL";
        if (!r1Pending && !r2Pending && !r3Pending) return false;
      } else if (filterStatus !== "ALL" && a.stage !== filterStatus) {
        return false;
      }
      return true;
    });
  }, [applications, filterDate, filterJob, filterRound, filterStatus, searchQuery]);

  const callApi = async (url: string, method: string, body?: any, successMsg?: string) => {
    setBusyAction(url);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", "x-verity-csrf": "1" },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Operation failed");
      if (successMsg) notify(successMsg);
      await fetchPipeline();
      return data;
    } catch (err: any) {
      notify(`Error: ${err?.message || "Request failed"}`);
      return null;
    } finally {
      setBusyAction(null);
    }
  };

  // Metrics
  const pendingApprovalsCount = applications.filter((a) => {
    const r1 = a.assessmentInvites?.[0];
    const r2 = a.technicalProject;
    return (
      (r1?.status === "SUBMITTED" && r1?.hrReviewStatus === "PENDING") ||
      (r2?.status === "AI_EVALUATION_COMPLETED" && r2?.hrDecision === "PENDING")
    );
  }).length;

  const r1Invite = selectedApp?.assessmentInvites?.[0];
  const r2Proj = selectedApp?.technicalProject;
  const r3Round = selectedApp?.interviewRounds?.find((r: any) => r.sequence === 3);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
            <Sparkle size={22} className="text-brand" />
            End-to-End 3-Round AI Recruitment Workflow
          </h1>
          <p className="text-sm text-ink-muted mt-0.5">
            PostgreSQL-backed pipeline: Round 1 Proctored Exam → Round 2 Qwen AI Technical Project → Round 3 Proctored HR Interview
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={activeSubView === "PIPELINE" ? "primary" : "ghost"}
            size="sm"
            onClick={() => setActiveSubView("PIPELINE")}
          >
            Recruitment Pipeline ({applications.length})
          </Button>
          <Button
            variant={activeSubView === "EMAILS" ? "primary" : "ghost"}
            size="sm"
            onClick={() => setActiveSubView("EMAILS")}
          >
            <Mail size={14} /> Email History ({emailLogs.length})
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void fetchPipeline()} loading={loading}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <span className="text-xs font-semibold text-ink-muted uppercase">Total Candidates</span>
          <strong className="text-2xl font-bold text-ink block mt-1">{applications.length}</strong>
        </div>
        <div className="card p-4 border-amber-200 bg-amber-50/40">
          <span className="text-xs font-semibold text-amber-800 uppercase">Pending HR Approval</span>
          <strong className="text-2xl font-bold text-amber-900 block mt-1">{pendingApprovalsCount}</strong>
        </div>
        <div className="card p-4 border-blue-200 bg-blue-50/40">
          <span className="text-xs font-semibold text-blue-800 uppercase">Round 2 AI Projects</span>
          <strong className="text-2xl font-bold text-blue-900 block mt-1">
            {applications.filter((a) => Boolean(a.technicalProject)).length}
          </strong>
        </div>
        <div className="card p-4 border-emerald-200 bg-emerald-50/40">
          <span className="text-xs font-semibold text-emerald-800 uppercase">Hired / Round 3</span>
          <strong className="text-2xl font-bold text-emerald-900 block mt-1">
            {applications.filter((a) => a.stage === "HIRED" || a.interviewRounds?.some((r: any) => r.sequence === 3)).length}
          </strong>
        </div>
      </div>

      {activeSubView === "EMAILS" ? (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-line flex items-center justify-between">
            <h2 className="font-bold text-base text-ink">Automated Email Delivery & Notification History</h2>
            <span className="text-xs text-ink-muted">Deduplicated via EmailLog</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-canvas text-ink-muted uppercase">
                <tr>
                  <th className="p-3">Sent At</th>
                  <th className="p-3">Recipient</th>
                  <th className="p-3">Template</th>
                  <th className="p-3">Subject</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {emailLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-ink-muted">No automated emails logged yet.</td>
                  </tr>
                ) : (
                  emailLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-canvas/50">
                      <td className="p-3 whitespace-nowrap text-ink-muted">{new Date(log.sentAt).toLocaleString()}</td>
                      <td className="p-3 font-medium text-ink">{log.recipient}</td>
                      <td className="p-3 font-mono text-[11px]">{log.template}</td>
                      <td className="p-3 text-ink-2">{log.subject}</td>
                      <td className="p-3">
                        <span className={clsx("rounded-full px-2 py-0.5 text-[10px] font-bold", log.status === "SENT" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800")}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <>
          {/* Filters Bar */}
          <div className="card p-4 flex flex-wrap items-center gap-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search candidate, email, ref..."
              className="h-9 flex-1 min-w-[180px] rounded-xl border border-line px-3 text-xs"
            />
            <select value={filterJob} onChange={(e) => setFilterJob(e.target.value)} className="h-9 rounded-xl border border-line px-3 text-xs bg-white">
              <option value="ALL">All Jobs</option>
              {uniqueJobs.map(([id, title]) => (
                <option key={id} value={id}>{title}</option>
              ))}
            </select>
            <select value={filterRound} onChange={(e) => setFilterRound(e.target.value)} className="h-9 rounded-xl border border-line px-3 text-xs bg-white">
              <option value="ALL">All Rounds</option>
              <option value="R1">Round 1 (Proctored Exam)</option>
              <option value="R2">Round 2 (AI Project)</option>
              <option value="R3">Round 3 (HR Interview)</option>
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="h-9 rounded-xl border border-line px-3 text-xs bg-white">
              <option value="ALL">All Statuses</option>
              <option value="PENDING_HR">Pending HR Approval</option>
              <option value="IN_REVIEW">In Review</option>
              <option value="ON_HOLD">On Hold</option>
              <option value="SHORTLISTED">Shortlisted</option>
              <option value="ASSESSMENT">In Assessment</option>
              <option value="ROUND1_PENDING_HR_APPROVAL">Round 1 Pending HR Approval</option>
              <option value="ROUND2_PENDING_HR_APPROVAL">Round 2 Pending HR Approval</option>
              <option value="INTERVIEW">Round 3 Interview</option>
              <option value="ROUND3_PENDING_FINAL_HR_APPROVAL">Round 3 Pending Final HR Approval</option>
              <option value="HIRED">Hired</option>
              <option value="REJECTED">Rejected</option>
            </select>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="h-9 rounded-xl border border-line px-3 text-xs"
            />
          </div>

          {/* Pipeline Table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-canvas text-ink-muted uppercase">
                  <tr>
                    <th className="p-3">Candidate</th>
                    <th className="p-3">Job Role</th>
                    <th className="p-3">Round 1 Status & Score</th>
                    <th className="p-3">Round 2 AI Project & Score</th>
                    <th className="p-3">Round 3 HR Interview</th>
                    <th className="p-3">Overall Stage</th>
                    <th className="p-3 text-right">Manage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {filteredApps.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-ink-muted">
                        No applications match the current filters. Candidates will appear here as soon as they apply.
                      </td>
                    </tr>
                  ) : (
                    filteredApps.map((a) => {
                      const r1 = a.assessmentInvites?.[0];
                      const r2 = a.technicalProject;
                      const r3 = a.interviewRounds?.find((r: any) => r.sequence === 3);
                      const isSelected = a.id === selectedAppId;
                      return (
                        <tr
                          key={a.id}
                          onClick={() => setSelectedAppId(a.id)}
                          className={clsx("cursor-pointer transition-colors", isSelected ? "bg-brand-soft/40" : "hover:bg-canvas/70")}
                        >
                          <td className="p-3">
                            <p className="font-bold text-ink">{a.user?.displayName || a.user?.email}</p>
                            <p className="text-[11px] text-ink-muted">{a.user?.email} · {a.reference}</p>
                          </td>
                          <td className="p-3 font-medium text-ink">{a.job?.title}</td>
                          <td className="p-3">
                            {r1 ? (
                              <div>
                                <span className="font-semibold text-ink">{r1.status}</span>
                                {typeof r1.attempt?.autoScore === "number" && (
                                  <span className="ml-1.5 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-800">
                                    {Math.round(r1.attempt.autoScore)}/100
                                  </span>
                                )}
                                <p className="text-[10px] text-ink-muted">HR: {r1.hrReviewStatus}</p>
                              </div>
                            ) : (
                              <span className="text-ink-muted">Not Configured</span>
                            )}
                          </td>
                          <td className="p-3">
                            {r2 ? (
                              <div>
                                <span className="font-semibold text-ink">{r2.status}</span>
                                {r2.aiReport?.overallScore !== undefined && (
                                  <span className="ml-1.5 rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-bold text-purple-800">
                                    AI: {r2.aiReport.overallScore}/100
                                  </span>
                                )}
                                <p className="text-[10px] text-ink-muted">HR: {r2.hrDecision}</p>
                              </div>
                            ) : (
                              <span className="text-ink-muted">Locked</span>
                            )}
                          </td>
                          <td className="p-3">
                            {r3 ? (
                              <div>
                                <span className="font-semibold text-ink">{r3.status}</span>
                                {typeof r3.hrScore === "number" && (
                                  <span className="ml-1.5 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                                    {r3.hrScore}/100
                                  </span>
                                )}
                                <p className="text-[10px] text-ink-muted">Decision: {r3.hrDecision || "PENDING"}</p>
                              </div>
                            ) : (
                              <span className="text-ink-muted">Locked</span>
                            )}
                          </td>
                          <td className="p-3">
                            <span className="rounded-full bg-line-soft px-2.5 py-0.5 text-[11px] font-bold text-ink">{a.stage}</span>
                          </td>
                          <td className="p-3 text-right">
                            <Button size="sm" variant={isSelected ? "primary" : "ghost"} onClick={() => setSelectedAppId(a.id)}>
                              {isSelected ? "Inspecting" : "Manage Rounds →"}
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Selected Candidate 3-Round Inspector */}
          {selectedApp && (
            <div className="card p-6 space-y-6 border-2 border-brand/20">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <User size={18} className="text-brand" />
                    <h2 className="text-xl font-bold text-ink">
                      {selectedApp.user?.displayName || selectedApp.user?.email} — {selectedApp.job?.title}
                    </h2>
                    <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-bold text-brand">{selectedApp.stage}</span>
                  </div>
                  <p className="text-xs text-ink-muted mt-1">
                    Resume Skills: {(selectedApp.resumeSummary?.skills || []).slice(0, 10).join(", ") || "Not parsed"} · Experience: {selectedApp.resumeSummary?.totalExperience || "N/A"}
                  </p>
                </div>

                {/* Round Tabs */}
                <div className="flex rounded-xl bg-line-soft p-1 gap-1">
                  {[
                    { id: "R1", label: "Round 1: Proctored Exam" },
                    { id: "R2", label: "Round 2: AI Technical Project" },
                    { id: "R3", label: "Round 3: Proctored HR Interview" },
                  ].map((rt) => (
                    <button
                      key={rt.id}
                      type="button"
                      onClick={() => setActiveRoundTab(rt.id as any)}
                      className={clsx(
                        "rounded-lg px-3 py-1.5 text-xs font-bold transition-all",
                        activeRoundTab === rt.id ? "bg-white text-ink shadow-xs" : "text-ink-muted hover:text-ink",
                      )}
                    >
                      {rt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ROUND 1 PANEL */}
              {activeRoundTab === "R1" && (
                <div className="space-y-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-line bg-canvas p-4 space-y-3">
                      <h3 className="font-bold text-sm text-ink flex items-center gap-2">
                        <Clock size={15} className="text-brand" /> Configure & Dispatch Round 1
                      </h3>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="font-semibold text-ink-muted block mb-1">Duration (mins)</label>
                          <input
                            type="number"
                            value={r1Duration}
                            onChange={(e) => setR1Duration(Number(e.target.value) || 45)}
                            className="h-9 w-full rounded-lg border border-line px-2.5 bg-white"
                          />
                        </div>
                        <div>
                          <label className="font-semibold text-ink-muted block mb-1">Slot Start (Optional)</label>
                          <input
                            type="datetime-local"
                            value={r1SlotStart}
                            onChange={(e) => setR1SlotStart(e.target.value)}
                            className="h-9 w-full rounded-lg border border-line px-2.5 bg-white"
                          />
                        </div>
                      </div>
                      <Button
                        size="sm"
                        loading={busyAction?.includes("round1/configure")}
                        onClick={() =>
                          void callApi(
                            `/api/t/${tenantSlug}/workflow/applications/${selectedApp.id}/round1/configure`,
                            "POST",
                            {
                              title: `Round 1: ${selectedApp.job?.title} Technical Assessment`,
                              durationMinutes: r1Duration,
                              scheduledSlotStart: r1SlotStart || undefined,
                              sendEmail: true,
                              questions: [
                                {
                                  prompt: `In ${selectedApp.job?.title}, which pattern best prevents duplicate processing in distributed event consumers?`,
                                  options: [
                                    "Idempotent Consumer with atomic deduplication key",
                                    "Unbounded retry loop without backoff",
                                    "Client-side localStorage lock",
                                    "Disabling database transactions",
                                  ],
                                  correctOptionIndex: 0,
                                  points: 25,
                                },
                                {
                                  prompt: "What HTTP status code should be returned when an authenticated user lacks role permissions?",
                                  options: ["401 Unauthorized", "403 Forbidden", "404 Not Found", "500 Server Error"],
                                  correctOptionIndex: 1,
                                  points: 25,
                                },
                                {
                                  prompt: "Which PostgreSQL strategy best optimizes frequent multi-column filter queries?",
                                  options: ["Composite B-Tree Indexing", "Removing all primary keys", "Storing JSON strings without indexes", "Running VACUUM FULL per request"],
                                  correctOptionIndex: 0,
                                  points: 25,
                                },
                                {
                                  prompt: "How should sensitive credentials be handled in backend microservices?",
                                  options: ["Hardcoded in source control", "Injected via environment secrets / vault", "Logged in plaintext error responses", "Passed in URL query parameters"],
                                  correctOptionIndex: 1,
                                  points: 25,
                                },
                              ],
                            },
                            "Round 1 Assessment configured & invitation email sent!",
                          )
                        }
                      >
                        Create Round 1 Assessment & Email Candidate
                      </Button>
                    </div>

                    <div className="rounded-xl border border-line bg-canvas p-4 space-y-2 text-xs">
                      <h3 className="font-bold text-sm text-ink flex items-center gap-2">
                        <Shield size={15} className="text-brand" /> Round 1 Results & Proctoring Logs
                      </h3>
                      {r1Invite ? (
                        <div className="space-y-2">
                          <p>Status: <strong>{r1Invite.status}</strong> · Score: <strong>{r1Invite.attempt?.autoScore ?? "Pending"}/100</strong></p>
                          <p>HR Review: <strong>{r1Invite.hrReviewStatus}</strong></p>
                          <p>Proctoring Events Logged (Reviewable Evidence): <strong>{r1Invite.attempt?.events?.length || 0}</strong></p>
                          {r1Invite.attempt?.round1Report && (
                            <div className="rounded-lg bg-white p-2.5 border border-line-soft space-y-1">
                              <strong className="text-ink block">AI Evaluation Report ({r1Invite.attempt.round1Report.evaluatedModel})</strong>
                              <p className="text-ink-2">{r1Invite.attempt.round1Report.summary}</p>
                            </div>
                          )}
                          {r1Invite.attempt?.events?.length > 0 && (
                            <ul className="max-h-24 overflow-y-auto space-y-1 bg-white p-2 rounded-lg border border-line-soft">
                              {r1Invite.attempt.events.map((ev: any) => (
                                <li key={ev.id} className="text-[11px] text-rose-700">
                                  {ev.type} · {new Date(ev.at).toLocaleTimeString()}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ) : (
                        <p className="text-ink-muted">No Round 1 invite created yet.</p>
                      )}
                    </div>
                  </div>

                  {/* HR Round 1 Approval Controls */}
                  <div className="rounded-xl border border-brand/20 bg-brand-soft/30 p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h4 className="font-bold text-sm text-ink">HR Round 1 Decision & Auto-Generate Round 2 AI Project</h4>
                        <p className="text-xs text-ink-muted">
                          Approving Round 1 automatically invokes local Qwen AI ({`qwen3.5:9b`}) using the Job Description & Candidate Resume to build a personalized Round 2 technical project.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <select value={r2Difficulty} onChange={(e) => setR2Difficulty(e.target.value as any)} className="h-9 rounded-lg border border-line px-2 text-xs bg-white">
                          <option value="EASY">R2 Difficulty: Easy</option>
                          <option value="MEDIUM">R2 Difficulty: Medium</option>
                          <option value="HARD">R2 Difficulty: Hard</option>
                        </select>
                        <Button
                          size="sm"
                          loading={busyAction?.includes("round1/review")}
                          onClick={() =>
                            void callApi(
                              `/api/t/${tenantSlug}/workflow/applications/${selectedApp.id}/round1/review`,
                              "POST",
                              { decision: "APPROVED", comments: r1Comments, reviewedBy: adminEmail, difficulty: r2Difficulty, durationMinutes: r2Duration },
                              "Round 1 Approved & Round 2 AI Technical Project generated!",
                            ).then((res) => {
                              if (res) setActiveRoundTab("R2");
                            })
                          }
                        >
                          <Check size={14} /> Approve Round 1 & Generate Round 2 AI Project
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          loading={busyAction?.includes("round1/review")}
                          onClick={() =>
                            void callApi(
                              `/api/t/${tenantSlug}/workflow/applications/${selectedApp.id}/round1/review`,
                              "POST",
                              { decision: "REJECTED", comments: r1Comments, reviewedBy: adminEmail },
                              "Round 1 Rejected & rejection email sent.",
                            )
                          }
                        >
                          Reject Candidate
                        </Button>
                      </div>
                    </div>
                    <input
                      type="text"
                      value={r1Comments}
                      onChange={(e) => setR1Comments(e.target.value)}
                      placeholder="Optional HR review comments..."
                      className="h-9 w-full rounded-lg border border-line px-3 text-xs bg-white"
                    />
                  </div>
                </div>
              )}

              {/* ROUND 2 PANEL */}
              {activeRoundTab === "R2" && (
                <div className="space-y-5">
                  {!r2Proj ? (
                    <div className="rounded-xl border border-line bg-canvas p-6 text-center space-y-3">
                      <p className="text-sm font-semibold text-ink">Round 2 AI Technical Project has not been generated yet.</p>
                      <Button
                        loading={busyAction?.includes("round2/generate")}
                        onClick={() =>
                          void callApi(
                            `/api/t/${tenantSlug}/workflow/applications/${selectedApp.id}/round2/generate`,
                            "POST",
                            { difficulty: r2Difficulty, durationMinutes: r2Duration },
                            "Personalized Round 2 AI Technical Project generated!",
                          )
                        }
                      >
                        <Sparkle size={14} /> Generate Personalized Round 2 Project with Qwen AI
                      </Button>
                    </div>
                  ) : (
                    <>
                      {/* Task Preview, Edit & Scheduling */}
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-xl border border-line bg-canvas p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="font-bold text-sm text-ink">AI-Generated Project Spec ({r2Proj.status})</h3>
                            <Button
                              size="sm"
                              variant="ghost"
                              loading={busyAction?.includes("round2/generate")}
                              onClick={() =>
                                void callApi(
                                  `/api/t/${tenantSlug}/workflow/applications/${selectedApp.id}/round2/generate`,
                                  "POST",
                                  { difficulty: r2Difficulty, durationMinutes: r2Duration },
                                  "Round 2 Project regenerated with AI!",
                                )
                              }
                            >
                              Regenerate AI Task
                            </Button>
                          </div>
                          <input
                            type="text"
                            value={r2EditTitle}
                            onChange={(e) => setR2EditTitle(e.target.value)}
                            className="h-9 w-full rounded-lg border border-line px-3 text-xs font-bold bg-white"
                          />
                          <textarea
                            rows={3}
                            value={r2EditProblem}
                            onChange={(e) => setR2EditProblem(e.target.value)}
                            className="w-full rounded-lg border border-line p-2.5 text-xs bg-white"
                          />
                          <textarea
                            rows={4}
                            value={r2EditReqs}
                            onChange={(e) => setR2EditReqs(e.target.value)}
                            className="w-full rounded-lg border border-line p-2.5 text-xs bg-white font-mono"
                          />
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={r2Duration}
                              onChange={(e) => setR2Duration(Number(e.target.value) || 90)}
                              className="h-9 w-24 rounded-lg border border-line px-2 text-xs bg-white"
                            />
                            <span className="text-xs text-ink-muted">mins</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              loading={busyAction?.includes("round2/task")}
                              onClick={() =>
                                void callApi(
                                  `/api/t/${tenantSlug}/workflow/applications/${selectedApp.id}/round2/task`,
                                  "PUT",
                                  {
                                    durationMinutes: r2Duration,
                                    approveTask: true,
                                    reviewedBy: adminEmail,
                                    taskSpec: {
                                      ...r2Proj.taskSpec,
                                      title: r2EditTitle,
                                      problemStatement: r2EditProblem,
                                      functionalRequirements: r2EditReqs.split("\n").filter(Boolean),
                                    },
                                  },
                                  "Round 2 task saved & approved by HR!",
                                )
                              }
                            >
                              Save & Approve Task
                            </Button>
                          </div>
                        </div>

                        <div className="rounded-xl border border-line bg-canvas p-4 space-y-3">
                          <h3 className="font-bold text-sm text-ink">Schedule Round 2 Slot & Send Invite Email</h3>
                          <input
                            type="datetime-local"
                            value={r2SlotStart}
                            onChange={(e) => setR2SlotStart(e.target.value)}
                            className="h-9 w-full rounded-lg border border-line px-3 text-xs bg-white"
                          />
                          <Button
                            size="sm"
                            loading={busyAction?.includes("round2/schedule")}
                            onClick={() =>
                              void callApi(
                                `/api/t/${tenantSlug}/workflow/applications/${selectedApp.id}/round2/schedule`,
                                "POST",
                                { scheduledSlotStart: r2SlotStart || undefined, durationMinutes: r2Duration },
                                "Round 2 Scheduled & Invitation Email sent to candidate!",
                              )
                            }
                          >
                            <Mail size={14} /> Schedule Round 2 & Email Candidate
                          </Button>

                          {r2Proj.submissionFiles && (
                            <div className="pt-3 border-t border-line-soft space-y-2 text-xs">
                              <h4 className="font-bold text-ink">Candidate Submission ({r2Proj.submissionFiles.length} file(s))</h4>
                              <p className="text-ink-muted">Submitted: {r2Proj.submittedAt ? new Date(r2Proj.submittedAt).toLocaleString() : "N/A"}</p>
                              {r2Proj.repoUrl && <p>Repo: <a href={r2Proj.repoUrl} target="_blank" rel="noreferrer" className="text-brand underline">{r2Proj.repoUrl}</a></p>}
                              <div className="max-h-32 overflow-y-auto rounded-lg bg-slate-950 p-2.5 text-[11px] font-mono text-slate-100">
                                {(r2Proj.submissionFiles as any[]).map((f) => `// === ${f.filename} ===\n${f.content}`).join("\n\n")}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* AI Evaluation Report */}
                      {r2Proj.aiReport && (
                        <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-5 space-y-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <h3 className="font-bold text-base text-ink flex items-center gap-2">
                                <Sparkle size={16} className="text-purple-700" /> AI Technical Evaluation Report
                              </h3>
                              <p className="text-xs text-ink-muted">Model: {r2Proj.aiReport.evaluatedModel} · Confidence: {Math.round((r2Proj.aiReport.confidence || 0.85) * 100)}%</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="rounded-xl bg-white border border-purple-200 px-3 py-1.5 text-sm font-bold text-purple-900">
                                {r2Proj.aiReport.overallScore} / {r2Proj.aiReport.maxScore} ({r2Proj.aiReport.percentage}%)
                              </span>
                              <span className={clsx("rounded-full px-3 py-1 text-xs font-bold", r2Proj.aiReport.recommendation === "PASS" ? "bg-emerald-100 text-emerald-800" : r2Proj.aiReport.recommendation === "FAIL" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800")}>
                                AI Recommendation: {r2Proj.aiReport.recommendation}
                              </span>
                            </div>
                          </div>

                          <p className="text-xs text-ink-2 bg-white rounded-lg p-3 border border-purple-100">{r2Proj.aiReport.summary}</p>

                          <div className="grid gap-3 md:grid-cols-2 text-xs">
                            <div className="bg-white rounded-lg p-3 border border-line-soft space-y-1.5">
                              <strong className="text-ink block">Criteria Breakdown</strong>
                              {(r2Proj.aiReport.criteriaScores || []).map((c: any, idx: number) => (
                                <div key={idx} className="flex justify-between border-b border-line-soft pb-1">
                                  <span>{c.criterion}</span>
                                  <strong>{c.score}/{c.maxScore}</strong>
                                </div>
                              ))}
                            </div>
                            <div className="bg-white rounded-lg p-3 border border-line-soft space-y-1.5">
                              <strong className="text-ink block">Skills & Code Analysis</strong>
                              <p><span className="text-emerald-700 font-semibold">Demonstrated:</span> {(r2Proj.aiReport.skillsDemonstrated || []).join(", ") || "None"}</p>
                              <p><span className="text-rose-700 font-semibold">Missing:</span> {(r2Proj.aiReport.skillsMissing || []).join(", ") || "None"}</p>
                              <p className="text-ink-muted">{r2Proj.aiReport.codeQualityAnalysis}</p>
                              <p className="text-[11px] text-ink-muted italic">Limitations: {r2Proj.aiReport.evaluationLimitations}</p>
                            </div>
                          </div>

                          {/* HR Final Round 2 Decision */}
                          <div className="border-t border-purple-200 pt-4 space-y-3">
                            <h4 className="font-bold text-sm text-ink">HR Final Decision (Round 2) — Mandatory Human Gate</h4>
                            <input
                              type="text"
                              value={r2Comments}
                              onChange={(e) => setR2Comments(e.target.value)}
                              placeholder="Record HR decision comments..."
                              className="h-9 w-full rounded-lg border border-line px-3 text-xs bg-white"
                            />
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                loading={busyAction?.includes("round2/decision")}
                                onClick={() =>
                                  void callApi(
                                    `/api/t/${tenantSlug}/workflow/applications/${selectedApp.id}/round2/decision`,
                                    "POST",
                                    { decision: "APPROVED", comments: r2Comments, decidedBy: adminEmail },
                                    "Round 2 Approved! Congratulations email sent & Round 3 unlocked.",
                                  ).then((res) => {
                                    if (res) setActiveRoundTab("R3");
                                  })
                                }
                              >
                                <Check size={14} /> Approve Round 2 & Unlock Round 3 (Auto-Email)
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                loading={busyAction?.includes("round2/decision")}
                                onClick={() =>
                                  void callApi(
                                    `/api/t/${tenantSlug}/workflow/applications/${selectedApp.id}/round2/decision`,
                                    "POST",
                                    { decision: "FURTHER_REVIEW", comments: r2Comments, decidedBy: adminEmail },
                                    "Marked for Further Review.",
                                  )
                                }
                              >
                                Request Further Review
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                loading={busyAction?.includes("round2/decision")}
                                onClick={() =>
                                  void callApi(
                                    `/api/t/${tenantSlug}/workflow/applications/${selectedApp.id}/round2/decision`,
                                    "POST",
                                    { decision: "REJECTED", comments: r2Comments, decidedBy: adminEmail },
                                    "Round 2 Rejected & rejection email sent.",
                                  )
                                }
                              >
                                Reject Candidate (Auto-Email)
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* ROUND 3 PANEL */}
              {activeRoundTab === "R3" && (
                <div className="space-y-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-line bg-canvas p-4 space-y-3">
                      <h3 className="font-bold text-sm text-ink flex items-center gap-2">
                        <Video size={15} className="text-brand" /> Schedule Round 3 HR Interview (Proctored)
                      </h3>
                      <div className="space-y-2 text-xs">
                        <input
                          type="datetime-local"
                          value={r3SlotStart}
                          onChange={(e) => setR3SlotStart(e.target.value)}
                          className="h-9 w-full rounded-lg border border-line px-3 bg-white"
                        />
                        <input
                          type="text"
                          value={r3Panelist}
                          onChange={(e) => setR3Panelist(e.target.value)}
                          placeholder="HR Panelist Name"
                          className="h-9 w-full rounded-lg border border-line px-3 bg-white"
                        />
                      </div>
                      <Button
                        size="sm"
                        loading={busyAction?.includes("round3/schedule")}
                        onClick={() =>
                          void callApi(
                            `/api/t/${tenantSlug}/workflow/applications/${selectedApp.id}/round3/schedule`,
                            "POST",
                            { scheduledStart: r3SlotStart || undefined, panelistName: r3Panelist },
                            "Round 3 HR Interview scheduled & invitation email sent!",
                          )
                        }
                      >
                        <Mail size={14} /> Schedule Round 3 & Email Candidate
                      </Button>
                    </div>

                    <div className="rounded-xl border border-line bg-canvas p-4 space-y-2 text-xs">
                      <h3 className="font-bold text-sm text-ink flex items-center gap-2">
                        <Shield size={15} className="text-brand" /> Round 3 Attendance & Proctoring Logs
                      </h3>
                      {r3Round ? (
                        <div className="space-y-1.5">
                          <p>Status: <strong>{r3Round.status}</strong> · Room: <span className="font-mono">{r3Round.roomName}</span></p>
                          <p>Joined At: <strong>{r3Round.attendanceJoinedAt ? new Date(r3Round.attendanceJoinedAt).toLocaleString() : "Not joined yet"}</strong></p>
                          <p>Left At: <strong>{r3Round.attendanceLeftAt ? new Date(r3Round.attendanceLeftAt).toLocaleString() : "—"}</strong></p>
                          <p>Proctoring Focus/Integrity Events: <strong>{r3Round.proctoringSummary?.violationCount || 0}</strong></p>
                        </div>
                      ) : (
                        <p className="text-ink-muted">Round 3 will unlock upon Round 2 HR approval or manual schedule.</p>
                      )}
                    </div>
                  </div>

                  {/* Round 3 Feedback & Final Hiring Decision */}
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3">
                    <h4 className="font-bold text-sm text-ink">HR Interview Feedback & Final Selection Decision</h4>
                    <div className="grid gap-3 md:grid-cols-2 text-xs">
                      <div>
                        <label className="font-semibold text-ink-muted block mb-1">Interview Score (0-100)</label>
                        <input
                          type="number"
                          value={r3Score}
                          onChange={(e) => setR3Score(Number(e.target.value) || 0)}
                          className="h-9 w-full rounded-lg border border-line px-3 bg-white"
                        />
                      </div>
                      <div>
                        <label className="font-semibold text-ink-muted block mb-1">Recommendation</label>
                        <select value={r3Recommendation} onChange={(e) => setR3Recommendation(e.target.value as any)} className="h-9 w-full rounded-lg border border-line px-3 bg-white">
                          <option value="HIRE">HIRE</option>
                          <option value="HOLD">HOLD</option>
                          <option value="NO_HIRE">NO_HIRE</option>
                        </select>
                      </div>
                    </div>
                    <textarea
                      rows={3}
                      value={r3Feedback}
                      onChange={(e) => setR3Feedback(e.target.value)}
                      placeholder="Record HR interview notes, culture fit, communication, and final rationale..."
                      className="w-full rounded-lg border border-line p-3 text-xs bg-white"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={busyAction?.includes("round3/feedback")}
                        onClick={() =>
                          void callApi(
                            `/api/t/${tenantSlug}/workflow/applications/${selectedApp.id}/round3/feedback`,
                            "POST",
                            { feedback: r3Feedback, score: r3Score, recommendation: r3Recommendation },
                            "Feedback saved! Status updated to ROUND3_PENDING_FINAL_HR_APPROVAL.",
                          )
                        }
                      >
                        Save Feedback (Pending Final Approval)
                      </Button>
                      <Button
                        size="sm"
                        loading={busyAction?.includes("round3/decision")}
                        onClick={() =>
                          void callApi(
                            `/api/t/${tenantSlug}/workflow/applications/${selectedApp.id}/round3/decision`,
                            "POST",
                            { feedback: r3Feedback, score: r3Score, recommendation: r3Recommendation, decision: "HIRED", decidedBy: adminEmail },
                            "Candidate HIRED! Welcome email dispatched automatically.",
                          )
                        }
                      >
                        <Check size={14} /> Final Decision: HIRE Candidate (Auto-Email)
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        loading={busyAction?.includes("round3/decision")}
                        onClick={() =>
                          void callApi(
                            `/api/t/${tenantSlug}/workflow/applications/${selectedApp.id}/round3/decision`,
                            "POST",
                            { feedback: r3Feedback, score: r3Score, recommendation: "NO_HIRE", decision: "REJECTED", decidedBy: adminEmail },
                            "Candidate Rejected & notification email dispatched.",
                          )
                        }
                      >
                        <Alert size={14} /> Final Decision: Reject Candidate (Auto-Email)
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
