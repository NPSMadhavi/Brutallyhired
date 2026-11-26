import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMe, useOverview } from "@/api/hooks";
import { useTenantCtx } from "@/components/layout/TenantContext";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Card";
import { Check, Clipboard } from "@/components/ui/icons";
import {
  getStandardGlobalScreeningQuestions,
  type ScreeningQuestion,
} from "@/pages/admin/BrutallyScoreModule";

export interface SubmittedScreeningAnswer {
  questionId: string;
  prompt: string;
  type: string;
  category?: string;
  points: number;
  earnedPoints: number;
  answer: string;
  isCorrect?: boolean;
}

function loadQuestionsForApplication(appId: string): ScreeningQuestion[] {
  try {
    const rawInvites = localStorage.getItem("bh_screening_invites");
    if (rawInvites) {
      const invites = JSON.parse(rawInvites);
      if (Array.isArray(invites)) {
        const found = invites.find((inv: any) => inv.appId === appId);
        if (found?.questions && Array.isArray(found.questions) && found.questions.length > 0) {
          return found.questions;
        }
      }
    }
  } catch {}

  try {
    const rawGlobal = localStorage.getItem("bh_global_screening_questions");
    if (rawGlobal) {
      const parsed = JSON.parse(rawGlobal);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}

  return getStandardGlobalScreeningQuestions();
}

export function ScreeningTestPage() {
  const { appId = "" } = useParams();
  const tenant = useTenantCtx();
  const navigate = useNavigate();
  const me = useMe();
  const overview = useOverview(tenant.slug, appId);

  const questions = loadQuestionsForApplication(appId);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [evalResult, setEvalResult] = useState<{ decision: "SHORTLISTED" | "ON_HOLD"; score: number; reason: string } | null>(null);
  const [submitted, setSubmitted] = useState<boolean>(() => {
    try {
      const rawApps = localStorage.getItem("bh_admin_applications");
      if (rawApps) {
        const apps = JSON.parse(rawApps);
        const match = Array.isArray(apps) ? apps.find((a: any) => a.id === appId) : null;
        if (match?.screeningTestSubmitted) return true;
        return false;
      }
    } catch {}
    return false;
  });

  useEffect(() => {
    const syncState = () => {
      try {
        const rawApps = localStorage.getItem("bh_admin_applications");
        if (rawApps) {
          const apps = JSON.parse(rawApps);
          const match = Array.isArray(apps) ? apps.find((a: any) => a.id === appId) : null;
          setSubmitted(Boolean(match?.screeningTestSubmitted));
        }
      } catch {}
    };
    window.addEventListener("storage", syncState);
    window.addEventListener("bh_application_updated", syncState);
    return () => {
      window.removeEventListener("storage", syncState);
      window.removeEventListener("bh_application_updated", syncState);
    };
  }, [appId]);

  const isExpired = (() => {
    try {
      const rawApps = localStorage.getItem("bh_admin_applications");
      if (rawApps) {
        const apps = JSON.parse(rawApps);
        const match = Array.isArray(apps) ? apps.find((a: any) => a.id === appId) : null;
        if (match?.screeningExpiresAt && !match?.screeningTestSubmitted) {
          return Date.now() >= new Date(match.screeningExpiresAt).getTime();
        }
      }
    } catch {}
    return false;
  })();

  if (isExpired && !submitted) {
    return (
      <section className="card mx-auto max-w-2xl flex flex-col items-center gap-4 p-8 text-center">
        <h1 className="text-2xl font-bold text-ink">Screening Test Link Expired</h1>
        <p className="text-sm text-ink-muted max-w-md">
          This screening test link has expired because it was not submitted before the deadline. Your application has been placed on hold.
        </p>
        <ButtonLink to={`/${tenant.slug}/applications/${appId}`} variant="primary">
          Back to Application Overview →
        </ButtonLink>
      </section>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    for (const q of questions) {
      if (q.required && !(answers[q.id] || "").trim()) {
        setError(`Please answer: "${q.prompt}"`);
        return;
      }
    }
    setError(null);
    setEvaluating(true);

    let totalPoints = 0;
    let earnedPoints = 0;
    const detailedAnswers = questions.map((q) => {
      const pts = Number(q.points) || 10;
      totalPoints += pts;
      const rawAns = (answers[q.id] || "").trim();

      let earned = 0;
      let isCorrect: boolean | undefined = undefined;

      if ((q.type === "MCQ" || q.type === "YES_NO") && q.correctOptionIndex !== undefined) {
        const opts = q.type === "YES_NO" && (!q.options || q.options.length === 0) ? ["Yes", "No"] : q.options;
        const selectedIdx = opts.findIndex((o) => o === rawAns);
        isCorrect = selectedIdx === q.correctOptionIndex;
        earned = isCorrect ? pts : 0;
      } else {
        isCorrect = rawAns.length > 0;
        earned = rawAns.length > 0 ? pts : 0;
      }

      earnedPoints += earned;
      return {
        questionId: q.id,
        prompt: q.prompt,
        type: q.type,
        category: q.category,
        points: pts,
        earnedPoints: earned,
        answer: rawAns || "—",
        isCorrect,
        correctOptionIndex: q.correctOptionIndex,
        options: q.options,
      };
    });

    let finalDecision: "SHORTLISTED" | "ON_HOLD" = "SHORTLISTED";
    let finalScore = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 100;
    let finalReason = "Screening responses validated and shortlisted automatically.";

    try {
      const res = await fetch(`/api/t/${encodeURIComponent(tenant.slug)}/workflow/applications/${encodeURIComponent(appId)}/screening/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-verity-csrf": "1" },
        body: JSON.stringify({ answers: detailedAnswers }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.evaluation) {
          finalDecision = data.evaluation.decision === "ON_HOLD" ? "ON_HOLD" : "SHORTLISTED";
          finalScore = typeof data.evaluation.score === "number" ? data.evaluation.score : finalScore;
          finalReason = String(data.evaluation.reason || finalReason);
        }
      }
    } catch {}

    setEvalResult({ decision: finalDecision, score: finalScore, reason: finalReason });
    const nowIso = new Date().toISOString();
    const userEmail = me.data?.email?.toLowerCase();

    try {
      const rawApps = localStorage.getItem("bh_admin_applications");
      if (rawApps) {
        const apps = JSON.parse(rawApps);
        if (Array.isArray(apps)) {
          const updated = apps.map((a: any) => {
            const matches =
              a.id === appId ||
              (userEmail && a.email?.toLowerCase() === userEmail && (!overview.data?.job?.title || a.jobTitle === overview.data.job.title));
            if (!matches) return a;
            return {
              ...a,
              stage: finalDecision,
              screeningTestSubmitted: true,
              screeningScore: finalScore,
              screeningAiReason: finalReason,
              holdReason: finalDecision === "ON_HOLD" ? finalReason : undefined,
              notes: finalDecision === "ON_HOLD" ? `On Hold: ${finalReason}` : `Shortlisted automatically (${finalScore}/100). Slot booking link emailed.`,
              screeningAnswers: detailedAnswers,
              screeningSubmittedAt: nowIso,
            };
          });
          localStorage.setItem("bh_admin_applications", JSON.stringify(updated));
        }
      }
    } catch {}

    try {
      const rawInvites = localStorage.getItem("bh_screening_invites");
      const invites = rawInvites ? JSON.parse(rawInvites) : [];
      if (Array.isArray(invites)) {
        const nextInvites = invites.map((inv: any) =>
          inv.appId === appId
            ? { ...inv, status: "SUBMITTED", score: finalScore, decision: finalDecision, reason: finalReason, answers: detailedAnswers, submittedAt: nowIso }
            : inv
        );
        localStorage.setItem("bh_screening_invites", JSON.stringify(nextInvites));
      }
    } catch {}

    try {
      const rawEv = localStorage.getItem("bh_application_events");
      const list = rawEv ? JSON.parse(rawEv) : [];
      const next = [
        {
          appId,
          email: me.data?.email,
          jobTitle: overview.data?.job?.title,
          event: {
            id: `ev-screening-sub-${appId}-${Date.now()}`,
            type: finalDecision === "ON_HOLD" ? "on_hold" : "shortlisted",
            createdAt: nowIso,
            data: { score: String(finalScore), reason: finalReason },
          },
        },
        ...(Array.isArray(list) ? list : []),
      ];
      localStorage.setItem("bh_application_events", JSON.stringify(next));
    } catch {}

    window.dispatchEvent(new Event("storage"));
    window.dispatchEvent(new CustomEvent("bh_application_updated", { detail: { appId, stage: finalDecision, screeningTestSubmitted: true } }));
    setEvaluating(false);
    setSubmitted(true);
  };

  if (submitted) {
    const isHold = evalResult?.decision === "ON_HOLD";
    return (
      <section className="card mx-auto max-w-2xl flex flex-col items-center gap-4 p-8 text-center">
        <span className={`flex h-12 w-12 items-center justify-center rounded-full ${isHold ? "bg-amber-100 text-amber-700" : "bg-teal-100 text-teal-700"}`}>
          <Check size={24} />
        </span>
        <h1 className="text-2xl font-bold text-ink">
          {isHold ? "Application Placed On Hold" : "Shortlisted! Screening Cleared"}
        </h1>
        <p className="text-sm text-ink-muted max-w-md">
          {evalResult?.reason ||
            "Thank you for completing the screening test. Our AI & hiring team have processed your responses."}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          {!isHold && (
            <ButtonLink to={`/${tenant.slug}/applications/${appId}/interviews`} variant="primary">
              Select Round 1 Time Slot →
            </ButtonLink>
          )}
          <ButtonLink to={`/${tenant.slug}/applications/${appId}`} variant={isHold ? "primary" : "ghost"}>
            Back to Application Overview →
          </ButtonLink>
        </div>
      </section>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-6">
      <div className="card flex flex-wrap items-center justify-between gap-4 p-6">
        <div className="flex items-center gap-3.5">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-700 border border-teal-200">
            <Clipboard size={22} />
          </span>
          <div>
            <h1 className="text-xl font-bold text-ink">Candidate Screening Test</h1>
            <p className="text-xs text-ink-muted">
              {overview.data?.job?.title || "Position"} • {questions.length} Questions configured by Hiring Team
            </p>
          </div>
        </div>
        <Pill tone="blue">{questions.length} Questions</Pill>
      </div>

      <div className="space-y-4">
        {questions.map((q, idx) => {
          const opts =
            q.type === "YES_NO" && (!q.options || q.options.length === 0)
              ? ["Yes", "No"]
              : q.options || [];

          return (
            <div key={q.id || idx} className="card p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <label className="text-sm font-semibold text-ink">
                  {idx + 1}. {q.prompt}
                  {q.required && <span className="text-rose-600 ml-1">*</span>}
                </label>
                <div className="flex items-center gap-2 shrink-0">
                  {q.category && (
                    <span className="rounded-md bg-canvas border border-line px-2 py-0.5 text-[11px] font-medium text-ink-muted">
                      {q.category}
                    </span>
                  )}
                  <span className="rounded-md bg-teal-50 border border-teal-200 px-2 py-0.5 text-[11px] font-bold text-teal-800">
                    {q.points} pts
                  </span>
                </div>
              </div>

              {q.type === "MCQ" || q.type === "YES_NO" ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {opts.map((opt, oIdx) => {
                    const selected = answers[q.id] === opt;
                    return (
                      <button
                        key={oIdx}
                        type="button"
                        onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                        className={`rounded-xl border px-3.5 py-2.5 text-left text-xs font-medium transition-all cursor-pointer ${
                          selected
                            ? "border-brand bg-brand/5 text-brand font-bold ring-2 ring-brand/15"
                            : "border-line bg-white text-ink hover:bg-canvas"
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              ) : q.type === "NUMBER" ? (
                <input
                  type="number"
                  step="any"
                  value={answers[q.id] || ""}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                  placeholder={q.placeholder || "Enter a number..."}
                  className="w-full rounded-xl border border-line-2 bg-white px-3.5 py-2.5 text-sm text-ink focus:border-brand focus:outline-none"
                />
              ) : (
                <textarea
                  rows={3}
                  value={answers[q.id] || ""}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                  placeholder={q.placeholder || "Write your answer..."}
                  className="w-full rounded-xl border border-line-2 bg-white px-3.5 py-2.5 text-sm text-ink focus:border-brand focus:outline-none"
                />
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <Button type="button" variant="ghost" onClick={() => navigate(`/${tenant.slug}/applications/${appId}`)}>
          ← Back
        </Button>
        <Button type="submit" variant="primary" size="lg" loading={evaluating}>
          {evaluating ? "AI Evaluating Responses..." : "Submit Screening Test →"}
        </Button>
      </div>
    </form>
  );
}
