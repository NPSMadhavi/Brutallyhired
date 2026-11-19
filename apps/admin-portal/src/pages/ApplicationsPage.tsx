import { useState } from "react";
import { useAdminApplications, useChangeApplicationStage } from "@/api/adminApi";
import { useTenant } from "@/components/layout/TenantContext";
import { Button } from "@/components/ui/Button";
import { Card, Fact, Pill, SectionTitle } from "@/components/ui/Card";
import { Modal, PageLoader } from "@/components/ui/feedback";
import {
  Alert,
  Arrow,
  CheckCircle,
  Clock,
  Filter,
  Search,
  Shield,
  Sparkle,
  User,
  Users,
} from "@/components/ui/icons";
import { Avatar, ScoreBadge, StagePill } from "@/components/ui/misc";
import { formatDate, formatRelative } from "@/lib/format";
import type { AdminApplication } from "@/api/mockData";

const STAGES = [
  "ALL",
  "SUBMITTED",
  "IN_REVIEW",
  "ASSESSMENT",
  "INTERVIEW",
  "OFFER",
  "ONBOARDING",
  "HIRED",
  "NOT_SELECTED",
];

export function ApplicationsPage() {
  const { tenant } = useTenant();
  const [selectedStage, setSelectedStage] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeApp, setActiveApp] = useState<AdminApplication | null>(null);
  const [stageChangeNote, setStageChangeNote] = useState("");

  const { data, isLoading } = useAdminApplications(tenant.slug);
  const changeStageMutation = useChangeApplicationStage(tenant.slug);

  if (isLoading) {
    return <PageLoader text="Loading candidate pipeline..." />;
  }

  const applications = data?.items || [];

  const filtered = applications.filter((app) => {
    const matchesSearch =
      app.user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.job.title.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (selectedStage === "ALL") return true;
    return app.stage === selectedStage;
  });

  const handleAdvance = (nextStage: string) => {
    if (!activeApp) return;
    changeStageMutation.mutate(
      { id: activeApp.id, stage: nextStage, note: stageChangeNote },
      {
        onSuccess: () => {
          setActiveApp((prev) => (prev ? { ...prev, stage: nextStage } : null));
          setStageChangeNote("");
        },
      },
    );
  };

  return (
    <div className="page space-y-6">
      {/* Page Title */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink md:text-3xl">
            Candidate Pipeline
          </h1>
          <p className="text-sm text-ink-muted">
            Track candidates across hiring stages, review automated resume scores, and schedule evaluations.
          </p>
        </div>
      </div>

      {/* Stage Tabs */}
      <div className="flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-line bg-white p-1.5 shadow-sm">
        {STAGES.map((st) => {
          const count =
            st === "ALL"
              ? applications.length
              : applications.filter((a) => a.stage === st).length;

          return (
            <button
              key={st}
              type="button"
              onClick={() => setSelectedStage(st)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                selectedStage === st
                  ? "bg-brand text-brand-fg shadow-sm"
                  : "text-ink-2 hover:bg-canvas hover:text-ink"
              }`}
            >
              <span>{st.replace(/_/g, " ")}</span>
              <span
                className={`rounded-full px-1.5 text-[10px] font-bold ${
                  selectedStage === st ? "bg-white/20 text-white" : "bg-line-soft text-ink-muted"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search Bar & List */}
      <Card className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              type="text"
              placeholder="Filter by candidate email, name, or job title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 w-full rounded-xl border border-line-2 bg-white pl-9 pr-4 text-xs text-ink placeholder:text-ink-muted focus:border-brand focus:outline-none"
            />
          </div>

          <div className="text-xs text-ink-muted">
            Showing <strong className="text-ink">{filtered.length}</strong> candidates
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                <th className="pb-3 pl-2">Candidate</th>
                <th className="pb-3">Applied Role</th>
                <th className="pb-3">Score & Rubric</th>
                <th className="pb-3">Stage</th>
                <th className="pb-3">Applied</th>
                <th className="pb-3 pr-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-ink-muted">
                    No candidates found for the selected stage filter.
                  </td>
                </tr>
              ) : (
                filtered.map((app) => {
                  const score = app.scores?.[0]?.total;
                  return (
                    <tr key={app.id} className="group hover:bg-canvas/50">
                      <td className="py-3.5 pl-2">
                        <div className="flex items-center gap-3">
                          <Avatar name={app.user.email} size={34} />
                          <div>
                            <span className="font-semibold text-ink block">{app.user.email}</span>
                            <span className="text-[11px] text-ink-muted">ID: {app.id}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 font-medium text-ink-2">{app.job.title}</td>
                      <td className="py-3.5">
                        <ScoreBadge score={score} threshold={tenant.eligibilityThreshold ?? 60} />
                      </td>
                      <td className="py-3.5">
                        <StagePill stage={app.stage} />
                      </td>
                      <td className="py-3.5 text-xs text-ink-muted">{formatDate(app.submittedAt)}</td>
                      <td className="py-3.5 pr-2 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setActiveApp(app)}
                        >
                          Review & Advance
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Review Candidate Modal */}
      <Modal
        open={Boolean(activeApp)}
        onClose={() => setActiveApp(null)}
        title="Candidate Application Review"
        subtitle={activeApp ? `${activeApp.user.email} • ${activeApp.job.title}` : ""}
        maxWidth="max-w-2xl"
      >
        {activeApp && (
          <div className="space-y-6">
            {/* Candidate Details & Score Breakdown */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-line bg-canvas p-3">
                <span className="text-[11px] font-semibold text-ink-muted block uppercase">Current Stage</span>
                <span className="mt-1 block">
                  <StagePill stage={activeApp.stage} />
                </span>
              </div>

              <div className="rounded-xl border border-line bg-canvas p-3">
                <span className="text-[11px] font-semibold text-ink-muted block uppercase">Overall Score</span>
                <span className="mt-1 block text-lg font-bold text-ink">
                  {activeApp.scores?.[0]?.total ?? "—"}/100
                </span>
              </div>

              <div className="rounded-xl border border-line bg-canvas p-3">
                <span className="text-[11px] font-semibold text-ink-muted block uppercase">Applied On</span>
                <span className="mt-1 block text-xs font-medium text-ink-2">
                  {formatDate(activeApp.submittedAt)}
                </span>
              </div>
            </div>

            {/* Rubric Evaluation Note */}
            {activeApp.scores?.[0]?.notes && (
              <div className="rounded-xl border border-line bg-ok-soft/30 p-3.5">
                <div className="flex items-center gap-2 text-xs font-bold text-ink mb-1">
                  <Sparkle size={15} className="text-brand" />
                  <span>Automated AI Screening Summary</span>
                </div>
                <p className="text-xs leading-relaxed text-ink-2">
                  {activeApp.scores[0].notes}
                </p>
                <div className="mt-2 flex items-center gap-4 text-[11px] text-ink-muted">
                  <span>Hard Requirements: <strong>{activeApp.scores[0].hardScore} pts</strong></span>
                  <span>Preferred Criteria: <strong>{activeApp.scores[0].preferredScore} pts</strong></span>
                </div>
              </div>
            )}

            {/* Stage Transition Control */}
            <div className="space-y-3 border-t border-line pt-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                Advance Candidate Stage
              </h4>

              <div className="flex flex-wrap gap-2">
                {[
                  { target: "IN_REVIEW", label: "Move to Review" },
                  { target: "ASSESSMENT", label: "Send Assessment" },
                  { target: "INTERVIEW", label: "Invite to Interview" },
                  { target: "OFFER", label: "Prepare Offer" },
                  { target: "ONBOARDING", label: "Start Onboarding" },
                  { target: "HIRED", label: "Mark as Hired" },
                  { target: "NOT_SELECTED", label: "Not Selected" },
                ].map((s) => (
                  <button
                    key={s.target}
                    type="button"
                    disabled={activeApp.stage === s.target || changeStageMutation.isPending}
                    onClick={() => handleAdvance(s.target)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                      activeApp.stage === s.target
                        ? "bg-brand/10 text-brand ring-1 ring-brand cursor-default"
                        : "border border-line-2 bg-white text-ink-2 hover:bg-canvas hover:border-brand"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <div className="pt-2">
                <input
                  type="text"
                  placeholder="Optional internal note for stage update..."
                  value={stageChangeNote}
                  onChange={(e) => setStageChangeNote(e.target.value)}
                  className="h-9 w-full rounded-lg border border-line-2 px-3 text-xs text-ink placeholder:text-ink-muted focus:border-brand focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end border-t border-line pt-4">
              <Button variant="ghost" onClick={() => setActiveApp(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
