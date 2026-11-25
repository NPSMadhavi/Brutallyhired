import { saveAnswers, useSubmitAttempt } from "@/api/hooks";
import { useTenantCtx } from "@/components/layout/TenantContext";
import { Button } from "@/components/ui/Button";
import { InlineError, Notice } from "@/components/ui/feedback";
import { Alert, Check, ChevronLeft, Shield } from "@/components/ui/icons";
import type { useProctoring } from "@/hooks/useProctoring";
import { sendEmailNotification } from "@/lib/emailService";
import type { AttemptDto } from "@verity/shared";
import { clsx } from "clsx";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

export interface ProctoringViolationReport {
  id: string;
  incidentNumber: number;
  eventType: string;
  description: string;
  timestamp: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  source: "PORT_MONITOR" | "BROWSER_FOCUS" | "VISION_AI" | "DISPLAY_GUARD";
}

/** The timed, proctored question runner with live 5-violation auto-rejection rule. */
export function AssessmentRunner({
  attempt,
  onDone,
  proctor,
  candidateId = "cmwssnj7e0003vnvsanhlfhqg",
  candidateName = "praveen Nobi",
  candidateEmail = "netopsysai@gmail.com",
  jobTitle = "Ai Ml",
  portMonitorOnline = false,
}: {
  attempt: AttemptDto;
  onDone: () => void;
  proctor: ReturnType<typeof useProctoring>;
  candidateId?: string;
  candidateName?: string;
  candidateEmail?: string;
  jobTitle?: string;
  portMonitorOnline?: boolean;
}) {
  const tenant = useTenantCtx();
  const { t } = useTranslation();
  const submit = useSubmitAttempt(tenant.slug, attempt.id);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState(attempt.answers);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);
  
  // Calculate remaining seconds reliably:
  // attempt.serverNow might be missing or out of sync; compare deadline to Date.now()
  // Ensure default duration of at least 45 minutes if deadline is invalid or past
  const [left, setLeft] = useState(() => {
    try {
      const now = Date.now();
      const dl = attempt.deadlineAt ? new Date(attempt.deadlineAt).getTime() : NaN;
      if (!isNaN(dl) && dl > now) {
        return Math.max(0, Math.floor((dl - now) / 1000));
      }
    } catch {}
    return 45 * 60; // 45 minutes default in seconds
  });
  const pending = useRef<Record<string, number[] | string>>({});
  const saveTimer = useRef<number>();
  const finished = useRef(false);

  // Proctoring Telemetry State
  const [violationReports, setViolationReports] = useState<ProctoringViolationReport[]>(() => {
    try {
      const saved = localStorage.getItem(`bh_proctoring_reports_${candidateId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });
  const [isDisqualified, setIsDisqualified] = useState(() => violationReports.length >= 5);
  const [hardwareState, setHardwareState] = useState<{
    power: string;
    usbCount: number;
    displaysCount: number;
    isOnline: boolean;
  }>({
    power: "AC Power Connected",
    usbCount: 0,
    displaysCount: 1,
    isOnline: portMonitorOnline,
  });

  const lastViolationTime = useRef<number>(0);

  // Core Violation Recorder & 5-Report Auto-Rejection Rule
  const recordViolation = useCallback(
    async (
      eventType: string,
      description: string,
      severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "HIGH",
      source: ProctoringViolationReport["source"] = "BROWSER_FOCUS"
    ) => {
      if (finished.current) return;

      // Throttle rapid repeated triggers (at least 1.5s between incident logs)
      const now = Date.now();
      if (now - lastViolationTime.current < 1500) return;
      lastViolationTime.current = now;

      setViolationReports((prev) => {
        if (prev.length >= 5) return prev;
        const newIncidentNum = prev.length + 1;
        const newReport: ProctoringViolationReport = {
          id: `rep-${newIncidentNum}-${Date.now()}`,
          incidentNumber: newIncidentNum,
          eventType,
          description,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          severity: newIncidentNum >= 5 ? "CRITICAL" : severity,
          source,
        };

        const updated = [...prev, newReport];
        localStorage.setItem(`bh_proctoring_reports_${candidateId}`, JSON.stringify(updated));

        // Sync with interviewer's assessment queue session in localStorage
        try {
          const raw = localStorage.getItem("bh_assessment_sessions");
          let sessions: any[] = raw ? JSON.parse(raw) : [];
          let target = sessions.find((s) => s.candidateId === candidateId || s.candidateName === candidateName);
          const auditEvent = {
            time: newReport.timestamp,
            event: `[BrutalAssessAI Alert #${newIncidentNum}] ${description} (${source})`,
            tone: (newIncidentNum >= 5 ? "danger" : "warn") as any,
          };
          if (target) {
            target.auditTrail = [...(target.auditTrail || []), auditEvent];
            target.riskScore = Math.min(100, (target.riskScore || 10) + 18);
            target.riskLevel = newIncidentNum >= 3 ? "HIGH" : "LOW";
            if (newIncidentNum >= 5) {
              target.status = "FLAGGED_REVIEW";
              target.adjudication = "FAIL";
            }
          } else {
            sessions.unshift({
              id: `assess-${Date.now()}`,
              candidateId,
              candidateName,
              jobTitle,
              assessmentTitle: "Technical Assessment (Proctored)",
              mode: "HIGHER_ASSURANCE",
              invitedAt: "Just now",
              expiresIn: "48 hours remaining",
              systemTest: { consent: true, webcam: true, screenShare: true, audio: true, networkLatency: "24ms" },
              durationMins: 45,
              autosaveCheckpoints: 1,
              status: newIncidentNum >= 5 ? "FLAGGED_REVIEW" : "IN_PROGRESS",
              adjudication: newIncidentNum >= 5 ? "FAIL" : undefined,
              aiSignals: {
                faceVisibilityPct: Math.max(50, 95 - newIncidentNum * 9),
                extraPersonsCount: 0,
                phoneDetected: false,
                monitorCount: 1,
                focusLossCount: newIncidentNum,
                interruptionsCount: newIncidentNum,
              },
              riskScore: Math.min(100, newIncidentNum * 20),
              riskLevel: newIncidentNum >= 3 ? "HIGH" : "LOW",
              auditTrail: [auditEvent],
            });
          }
          localStorage.setItem("bh_assessment_sessions", JSON.stringify(sessions));
        } catch (e) {
          console.warn("Session sync note:", e);
        }

        // Post telemetry to backend
        void fetch(`/api/t/${tenant.slug}/proctoring/telemetry`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-verity-csrf": "1" },
          body: JSON.stringify({
            candidateId,
            candidateName,
            candidateEmail,
            jobTitle,
            eventType,
            description,
            severity: newIncidentNum >= 5 ? "CRITICAL" : severity,
            violationCount: newIncidentNum,
            hardwareSnapshot: hardwareState,
            evidenceData: { incidentNumber: newIncidentNum, source, timestamp: newReport.timestamp },
          }),
        }).catch(() => undefined);

        // 5-VIOLATION AUTO-REJECTION RULE
        if (newIncidentNum >= 5) {
          finished.current = true;
          setIsDisqualified(true);
          if (document.fullscreenElement) {
            void document.exitFullscreen().catch(() => undefined);
          }

          // Disqualify candidate in localStorage bh_admin_applications
          try {
            const rawApps = localStorage.getItem("bh_admin_applications");
            if (rawApps) {
              const apps = JSON.parse(rawApps);
              const updatedApps = apps.map((a: any) => {
                if (a.id === candidateId || a.candidateName === candidateName || a.email === candidateEmail) {
                  return {
                    ...a,
                    stage: "REJECTED",
                    rejectionReason:
                      "Automatic Disqualification: 5 Critical Examination Proctoring Integrity Violations Recorded",
                  };
                }
                return a;
              });
              localStorage.setItem("bh_admin_applications", JSON.stringify(updatedApps));
            }
          } catch {}

          // Send disqualification notice email
          void sendEmailNotification({
            to: candidateEmail,
            recipientName: candidateName,
            stage: "REJECTED",
            jobTitle,
            portalPath: `/${tenant.slug}/applications/${candidateId}`,
            tenantSlug: tenant.slug,
            customHeading: "BrutalAssessAI™ Notice: Assessment Terminated & Disqualified",
            customBody: `Your proctored examination for ${jobTitle} has been automatically terminated due to reaching the maximum threshold of 5 security and proctoring violations. BrutalAssessAI™ verified multiple unauthorized events during your session. As per exam integrity regulations, your candidacy has been marked as Disqualified.`,
          });
        }

        return updated;
      });
    },
    [candidateEmail, candidateId, candidateName, hardwareState, jobTitle, tenant.slug]
  );

  // Poll Python Port Monitor on Port 4899
  useEffect(() => {
    let active = true;
    const checkPortMonitor = async () => {
      try {
        const res = await fetch("http://127.0.0.1:4899/status");
        if (res.ok && active) {
          const data = await res.json();
          setHardwareState({
            power: data.power?.label || "AC Power Connected",
            usbCount: data.usb?.count || 0,
            displaysCount: data.displays?.count || 1,
            isOnline: true,
          });

          // Check if port monitor detected hardware violations
          if (data.displays?.multiDisplayDetected) {
            void recordViolation(
              "multi_display_detected",
              "Secondary display / HDMI connection detected by OS port monitor",
              "CRITICAL",
              "DISPLAY_GUARD"
            );
          }
        }
      } catch {
        if (active) {
          setHardwareState((prev) => ({ ...prev, isOnline: false }));
        }
      }
    };

    checkPortMonitor();
    const interval = setInterval(checkPortMonitor, 3000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [recordViolation]);

  // Window Focus & Browser Tab Tracking
  useEffect(() => {
    const handleBlur = () => {
      if (!finished.current && !isDisqualified) {
        void recordViolation(
          "window_blur",
          "Window focus lost: Candidate switched to another application or window",
          "HIGH",
          "BROWSER_FOCUS"
        );
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "hidden" && !finished.current && !isDisqualified) {
        void recordViolation(
          "tab_hidden",
          "Browser tab hidden: Candidate switched browser tab or minimized examination window",
          "HIGH",
          "BROWSER_FOCUS"
        );
      }
    };

    window.addEventListener("blur", handleBlur);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [isDisqualified, recordViolation]);

  const flushAnswers = useCallback(async () => {
    const batch = pending.current;
    pending.current = {};
    if (Object.keys(batch).length === 0) return;
    setSaving(true);
    await saveAnswers(tenant.slug, attempt.id, batch).catch(() => Object.assign(pending.current, batch));
    setSaving(false);
  }, [attempt.id, tenant.slug]);

  const finish = useCallback(async () => {
    if (finished.current) return;
    finished.current = true;
    await flushAnswers();
    await proctor.stop();
    await submit.mutateAsync().catch(() => undefined);
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
    onDone();
  }, [flushAnswers, onDone, proctor, submit]);

  useEffect(() => {
    if (isDisqualified) return;
    const id = window.setInterval(() => {
      setLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(id);
          void finish();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [finish, isDisqualified]);

  const set = (qid: string, v: number[] | string) => {
    if (isDisqualified) return;
    setAnswers((a) => ({ ...a, [qid]: v }));
    pending.current[qid] = v;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void flushAnswers(), 800);
  };

  // DISQUALIFICATION VIEW (Figure 4 Examination Architecture - Rejection upon 5 Reports)
  if (isDisqualified || violationReports.length >= 5) {
    return (
      <div className="card flex flex-col items-center gap-6 py-12 px-6 text-center max-w-3xl mx-auto border-2 border-rose-300 bg-rose-50/30 shadow-lg animate-in fade-in duration-300">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-rose-100 text-rose-700 shadow-sm">
          <Alert size={44} />
        </span>
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-rose-100 px-3.5 py-1 text-xs font-bold text-rose-800">
            <Shield size={14} />
            <span>EXAMINATION TERMINATED · AUTOMATIC DISQUALIFICATION</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight">
            Assessment Disqualified by BrutalAssessAI™
          </h1>
          <p className="text-ink-muted text-sm max-w-xl mx-auto leading-relaxed">
            Your examination was terminated because <strong>5 security integrity violations</strong> were recorded by
            the proctoring engine. Candidate <strong>{candidateName}</strong> for <strong>{jobTitle}</strong> has been
            marked as <strong>REJECTED</strong>.
          </p>
        </div>

        {/* 5 Incident Reports Table */}
        <div className="w-full text-left rounded-2xl border border-rose-200 bg-white overflow-hidden shadow-xs">
          <div className="bg-rose-100/60 px-4 py-2.5 border-b border-rose-200 flex items-center justify-between">
            <span className="font-bold text-xs uppercase tracking-wider text-rose-900">
              Audit Evidence: 5 Incident Reports Recorded
            </span>
            <span className="text-[11px] font-mono text-rose-800 font-bold">5 / 5 Limit Exceeded</span>
          </div>
          <div className="divide-y divide-rose-100">
            {violationReports.slice(0, 5).map((rep) => (
              <div key={rep.id} className="p-3.5 flex items-start justify-between gap-3 text-xs">
                <div className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-600 text-white font-bold text-[11px]">
                    {rep.incidentNumber}
                  </span>
                  <div>
                    <span className="font-bold text-ink block">{rep.description}</span>
                    <span className="text-ink-muted text-[11px] font-mono">
                      Event: {rep.eventType} · Source: {rep.source}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-mono text-ink-muted text-[11px] block">{rep.timestamp}</span>
                  <span className="rounded bg-rose-100 text-rose-800 font-bold text-[10px] px-1.5 py-0.5">
                    {rep.severity}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-900 leading-relaxed text-left w-full">
          ✉️ A disqualification notice has been dispatched to <strong>{candidateEmail}</strong>. All responses and
          audit logs have been sealed for compliance verification by the hiring committee.
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Link
            to={`/${tenant.slug}/applications/${candidateId}`}
            className="rounded-xl bg-ink text-white font-bold px-6 py-3 hover:bg-ink-2 transition-colors shadow-sm no-underline text-sm"
          >
            ← Return to Candidate Portal
          </Link>
        </div>
      </div>
    );
  }

  const q = attempt.questions[i]!;
  const unanswered = attempt.questions.filter(
    (x) => answers[x.id] === undefined || (Array.isArray(answers[x.id]) ? (answers[x.id] as number[]).length === 0 : answers[x.id] === "")
  ).length;
  const mm = Math.max(0, Math.floor(left / 60));
  const ss = Math.max(0, Math.floor(left % 60));
  const value = answers[q.id];

  return (
    <div className="flex flex-col gap-5">
      {/* Sticky Proctoring & Timer Header Bar */}
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-ink px-5 py-3 text-white shadow-md">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#E5484D]" />
            <span className="font-semibold">Proctoring Telemetry Active</span>
          </span>
          <span className="text-white/40">|</span>
          <span className="text-xs text-white/80">{saving ? t("assessment.saving") : t("assessment.saved")}</span>
        </div>

        {/* Live Violation Meter Banner */}
        <div className="flex items-center gap-3">
          <div
            className={clsx(
              "flex items-center gap-2 px-3 py-1 rounded-xl text-xs font-bold transition-all",
              violationReports.length === 0
                ? "bg-teal-500/20 text-teal-300 border border-teal-500/40"
                : violationReports.length >= 4
                ? "bg-rose-500/30 text-rose-200 border border-rose-500 animate-pulse"
                : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
            )}
          >
            <Shield size={14} />
            <span>
              {violationReports.length === 0
                ? "Integrity: Clean (0 / 5 Reports)"
                : `Warning: ${violationReports.length} / 5 Incident Reports`}
            </span>
          </div>

          <span
            className="font-display text-xl font-bold tabular-nums text-white"
            aria-live="off"
            aria-label={t("assessment.timeLeft")}
          >
            {`${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`}
          </span>
        </div>
      </div>

      {!document.fullscreenElement && (
        <Button
          variant="ghost"
          className="self-start text-xs"
          onClick={() => void document.documentElement.requestFullscreen().catch(() => undefined)}
        >
          {t("assessment.returnFullscreen")}
        </Button>
      )}

      {proctor.screenWarning && <Notice tone="warn">{t("assessment.shareWholeScreen")}</Notice>}

      <div className="flex flex-wrap items-start gap-6">
        {/* Main Question Panel */}
        <section className="card flex min-w-0 flex-[999_1_560px] flex-col gap-5 md:p-8" aria-labelledby="q-h">
          <div className="flex items-center justify-between border-b border-line-soft pb-3">
            <span className="label-caps">{t("assessment.questionN", { n: i + 1, total: attempt.questions.length })}</span>
            <span className="text-xs text-ink-muted">Single Answer Required</span>
          </div>

          <h2 id="q-h" className="whitespace-pre-line font-sans text-lg font-semibold leading-relaxed tracking-normal">
            {q.prompt}
          </h2>

          {q.type === "TEXT" ? (
            <textarea
              aria-labelledby="q-h"
              rows={8}
              className="rounded-xl border border-line-2 p-3.5 text-[15px] leading-relaxed focus:border-brand focus:outline-none"
              placeholder={t("assessment.typeAnswer")}
              value={typeof value === "string" ? value : ""}
              onChange={(e) => set(q.id, e.target.value)}
            />
          ) : (
            <fieldset className="flex flex-col gap-2.5">
              <legend className="mb-1 text-[13px] text-ink-muted">
                {q.type === "SINGLE_CHOICE" ? t("assessment.chooseOne") : t("assessment.chooseMany")}
              </legend>
              {q.options.map((opt, idx) => {
                const chosen = Array.isArray(value) && value.includes(idx);
                return (
                  <label
                    key={idx}
                    className={clsx(
                      "flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl border px-4 text-[15px] transition-all",
                      chosen ? "border-brand bg-brand-soft ring-1 ring-brand" : "border-line-2 hover:bg-canvas"
                    )}
                  >
                    <input
                      type={q.type === "SINGLE_CHOICE" ? "radio" : "checkbox"}
                      name={q.id}
                      className="h-4 w-4 accent-[rgb(var(--brand))]"
                      checked={chosen}
                      onChange={() => {
                        const cur = Array.isArray(value) ? value : [];
                        set(q.id, q.type === "SINGLE_CHOICE" ? [idx] : chosen ? cur.filter((x) => x !== idx) : [...cur, idx]);
                      }}
                    />
                    <span className="leading-snug">{opt}</span>
                  </label>
                );
              })}
            </fieldset>
          )}

          <div className="flex flex-wrap justify-between gap-3 border-t border-line-soft pt-5">
            <Button variant="ghost" disabled={i === 0} onClick={() => setI(i - 1)}>
              {t("assessment.prev")}
            </Button>
            {i < attempt.questions.length - 1 ? (
              <Button onClick={() => setI(i + 1)}>{t("assessment.next")}</Button>
            ) : (
              <Button onClick={() => setConfirm(true)}>{t("assessment.submit")}</Button>
            )}
          </div>

          {confirm && (
            <div className="flex flex-col gap-3 rounded-2xl border border-line bg-[#F7F9FC] p-4">
              <p className="text-sm font-semibold">{t("assessment.submitConfirm")}</p>
              {unanswered > 0 && <p className="text-[13px] text-warn-ink">{t("assessment.unanswered", { count: unanswered })}</p>}
              <div className="flex gap-2">
                <Button loading={submit.isPending} onClick={() => void finish()}>
                  {t("assessment.submit")}
                </Button>
                <Button variant="ghost" onClick={() => setConfirm(false)}>
                  {t("common.cancel")}
                </Button>
              </div>
              <InlineError error={submit.error} />
            </div>
          )}
        </section>

        {/* Sidebar: Navigation + BrutalAssessAI™ Real-Time Telemetry */}
        <aside className="flex flex-[1_1_280px] flex-col gap-4">
          <nav className="card flex flex-col gap-3" aria-label={t("assessment.questionNav")}>
            <div className="flex items-center justify-between">
              <span className="label-caps">{t("assessment.questionNav")}</span>
              <span className="text-xs text-ink-muted">
                {attempt.questions.length - unanswered} / {attempt.questions.length} Answered
              </span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {attempt.questions.map((x, idx) => {
                const a = answers[x.id];
                const done = a !== undefined && (Array.isArray(a) ? a.length > 0 : a !== "");
                return (
                  <button
                    key={x.id}
                    type="button"
                    onClick={() => setI(idx)}
                    aria-current={idx === i ? "step" : undefined}
                    className={clsx(
                      "h-10 rounded-lg text-sm font-semibold transition-all",
                      idx === i ? "bg-ink text-white shadow-xs" : done ? "bg-ok-soft text-ok-ink" : "bg-line-soft text-ink-3 hover:bg-line"
                    )}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </nav>

          {/* AI Proctoring Telemetry & Hardware Port Monitor */}
          <section className="card flex flex-col gap-3 p-4 bg-gradient-to-br from-white to-blue-50/40 border border-blue-100 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-bold text-xs text-ink">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>BrutalAssessAI™ Telemetry</span>
              </span>
              <span
                className={clsx(
                  "rounded-full text-[10px] font-bold px-2 py-0.5",
                  hardwareState.isOnline ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"
                )}
              >
                {hardwareState.isOnline ? "PORT MONITOR 4899" : "WEB TELEMETRY"}
              </span>
            </div>

            {/* Hardware & Port Telemetry Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-white p-2 border border-line">
                <span className="text-[10px] text-ink-muted uppercase block font-medium">External Ports</span>
                <strong className="text-ink text-xs block mt-0.5">
                  {hardwareState.usbCount} USB / Bus Devices
                </strong>
              </div>
              <div className="rounded-lg bg-white p-2 border border-line">
                <span className="text-[10px] text-ink-muted uppercase block font-medium">Active Displays</span>
                <strong className="text-ink text-xs block mt-0.5">
                  {hardwareState.displaysCount} Screen Monitored
                </strong>
              </div>
              <div className="rounded-lg bg-white p-2 border border-line">
                <span className="text-[10px] text-ink-muted uppercase block font-medium">Power Source</span>
                <strong className="text-emerald-700 text-xs block mt-0.5">{hardwareState.power}</strong>
              </div>
              <div className="rounded-lg bg-white p-2 border border-line">
                <span className="text-[10px] text-ink-muted uppercase block font-medium">AI Rejection Limit</span>
                <strong
                  className={clsx(
                    "text-xs block mt-0.5 font-bold",
                    violationReports.length >= 4 ? "text-rose-700" : "text-amber-700"
                  )}
                >
                  {violationReports.length} of 5 Violations
                </strong>
              </div>
            </div>

            {/* Live Progress Bar towards 5 Rejection Reports */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-ink-muted">Policy Threshold:</span>
                <span className="font-bold text-rose-700">5 Reports = Auto Reject</span>
              </div>
              <div className="h-2 w-full bg-line-soft rounded-full overflow-hidden">
                <div
                  className={clsx(
                    "h-full transition-all duration-300",
                    violationReports.length >= 4 ? "bg-rose-600" : violationReports.length > 0 ? "bg-amber-500" : "bg-teal-500"
                  )}
                  style={{ width: `${Math.min(100, (violationReports.length / 5) * 100)}%` }}
                />
              </div>
            </div>

            {/* Audit Trail List */}
            <div className="rounded-lg bg-white p-2.5 border border-line space-y-1.5 max-h-40 overflow-y-auto">
              <span className="text-[10px] text-ink-muted uppercase block font-semibold">
                Live Incident Audit Log
              </span>
              {violationReports.length === 0 ? (
                <div className="text-[11px] text-teal-800 font-mono flex items-center gap-1.5">
                  <Check size={12} className="text-teal-600" />
                  <span>No violations detected. Session clean.</span>
                </div>
              ) : (
                <div className="space-y-1 font-mono text-[10px]">
                  {violationReports.map((rep) => (
                    <div key={rep.id} className="text-rose-700 flex items-start gap-1">
                      <span className="font-bold">[{rep.timestamp}]</span>
                      <span>#{rep.incidentNumber}: {rep.eventType}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Interactive Violation Simulation Tools (For Testing & Verification) */}
            <div className="pt-1 border-t border-blue-100 flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider">
                Proctoring Test Triggers (Demo & Verification)
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    void recordViolation(
                      "window_blur",
                      "Candidate switched away or moved focus outside active examination window",
                      "HIGH",
                      "BROWSER_FOCUS"
                    )
                  }
                  className="rounded-lg border border-line bg-white hover:bg-canvas text-[10px] font-semibold py-1 px-1.5 text-left text-ink"
                >
                  ⚡ Trigger Window Blur
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void recordViolation(
                      "unauthorized_usb_device",
                      "Unauthorized external USB/dongle device plugged in during exam session",
                      "CRITICAL",
                      "PORT_MONITOR"
                    )
                  }
                  className="rounded-lg border border-line bg-white hover:bg-canvas text-[10px] font-semibold py-1 px-1.5 text-left text-ink"
                >
                  ⚡ Trigger USB Connect
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void recordViolation(
                      "multi_display_connected",
                      "Secondary external display (HDMI/DP) connected to candidate workstation",
                      "CRITICAL",
                      "DISPLAY_GUARD"
                    )
                  }
                  className="rounded-lg border border-line bg-white hover:bg-canvas text-[10px] font-semibold py-1 px-1.5 text-left text-ink"
                >
                  ⚡ Trigger 2nd Display
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void recordViolation(
                      "face_absence_or_second_person",
                      "Vision AI alert: Secondary person detected in camera view",
                      "HIGH",
                      "VISION_AI"
                    )
                  }
                  className="rounded-lg border border-line bg-white hover:bg-canvas text-[10px] font-semibold py-1 px-1.5 text-left text-ink"
                >
                  ⚡ Trigger Second Person
                </button>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}