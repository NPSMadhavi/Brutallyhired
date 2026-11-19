import { useState } from "react";
import { Link } from "react-router-dom";
import { useAdminApplications, useAdminInterviews, useAdminJobs } from "@/api/adminApi";
import { useTenant } from "@/components/layout/TenantContext";
import { Button } from "@/components/ui/Button";
import { Card, Fact, Pill, SectionTitle } from "@/components/ui/Card";
import { PageLoader } from "@/components/ui/feedback";
import {
  Alert,
  Arrow,
  Briefcase,
  Calendar,
  CheckCircle,
  ExternalLink,
  Filter,
  Plus,
  Search,
  Sparkle,
  Users,
  Video,
} from "@/components/ui/icons";
import { Avatar, ScoreBadge, StagePill } from "@/components/ui/misc";
import { formatDate, formatRelative } from "@/lib/format";

export function DashboardPage() {
  const { tenant } = useTenant();
  const { data: jobsData, isLoading: jobsLoading } = useAdminJobs(tenant.slug);
  const { data: appsData, isLoading: appsLoading } = useAdminApplications(tenant.slug);
  const { data: interviewsData } = useAdminInterviews(tenant.slug);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterStage, setFilterStage] = useState<string>("ALL");

  if (jobsLoading || appsLoading) {
    return <PageLoader text="Loading your recruitment dashboard..." />;
  }

  const jobs = jobsData?.items || [];
  const applications = appsData?.items || [];
  const interviews = interviewsData?.items || [];

  const totalApps = applications.length;
  const inReviewApps = applications.filter((a) => a.stage === "IN_REVIEW" || a.stage === "SUBMITTED").length;
  const interviewingApps = applications.filter((a) => a.stage === "INTERVIEW").length;
  const hiredApps = applications.filter((a) => a.stage === "HIRED" || a.stage === "OFFER").length;
  const lowScoreApps = applications.filter((a) => (a.scores?.[0]?.total ?? 100) < (tenant.eligibilityThreshold ?? 60));

  const filteredApps = applications.filter((app) => {
    const matchesSearch =
      app.user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.job.title.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (filterStage === "ALL") return true;
    if (filterStage === "LOW_SCORE") return (app.scores?.[0]?.total ?? 100) < (tenant.eligibilityThreshold ?? 60);
    return app.stage === filterStage;
  });

  return (
    <div className="page space-y-8">
      {/* Welcome Banner */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-ink md:text-3xl">
              Recruitment Dashboard
            </h1>
            <span className="rounded-full bg-ok-soft px-2.5 py-0.5 text-xs font-semibold text-ok-ink">
              System Online
            </span>
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            Overview of applicant funnel, automated scoring, and scheduled interview rooms for{" "}
            <span className="font-semibold text-ink-2">{tenant.name}</span>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            to={`/${tenant.slug}/jobs`}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-brand-fg no-underline hover:brightness-95 shadow-sm"
          >
            <Plus size={18} />
            Post New Job
          </Link>
          <Link
            to={`/${tenant.slug}/applications`}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-line-2 bg-white px-4 text-sm font-semibold text-ink no-underline hover:bg-canvas"
          >
            <Users size={18} />
            Manage Pipeline
          </Link>
        </div>
      </div>

      {/* KPI Stats Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Fact
          label="Total Applications"
          value={totalApps}
          sub={`${hiredApps} offered / hired`}
          trend="up"
          icon={<Users size={20} />}
        />
        <Fact
          label="In Active Review"
          value={inReviewApps}
          sub={`${lowScoreApps.length} score below ${tenant.eligibilityThreshold ?? 60} bar`}
          trend="neutral"
          icon={<Alert size={20} />}
        />
        <Fact
          label="Active Job Openings"
          value={jobs.filter((j) => j.status === "OPEN").length}
          sub={`${jobs.length} total requisitions`}
          trend="up"
          icon={<Briefcase size={20} />}
        />
        <Fact
          label="Scheduled Interviews"
          value={interviews.length}
          sub="LiveKit video rooms active"
          trend="up"
          icon={<Video size={20} />}
        />
      </div>

      {/* Pipeline Stages Funnel */}
      <Card className="space-y-4">
        <SectionTitle
          subtitle="Real-time distribution of candidates along the hiring journey"
          action={
            <Link
              to={`/${tenant.slug}/applications`}
              className="text-xs font-semibold text-brand no-underline hover:underline flex items-center gap-1"
            >
              Full Pipeline View <Arrow size={14} />
            </Link>
          }
        >
          Hiring Pipeline Funnel
        </SectionTitle>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7 pt-2">
          {[
            { label: "Submitted", count: applications.filter((a) => a.stage === "SUBMITTED").length, tone: "bg-blue-50 text-blue-700 border-blue-200" },
            { label: "In Review", count: applications.filter((a) => a.stage === "IN_REVIEW").length, tone: "bg-amber-50 text-amber-700 border-amber-200" },
            { label: "Assessment", count: applications.filter((a) => a.stage === "ASSESSMENT").length, tone: "bg-purple-50 text-purple-700 border-purple-200" },
            { label: "Interview", count: applications.filter((a) => a.stage === "INTERVIEW").length, tone: "bg-indigo-50 text-indigo-700 border-indigo-200" },
            { label: "Offer", count: applications.filter((a) => a.stage === "OFFER").length, tone: "bg-teal-50 text-teal-700 border-teal-200" },
            { label: "Onboarding", count: applications.filter((a) => a.stage === "ONBOARDING").length, tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
            { label: "Hired", count: applications.filter((a) => a.stage === "HIRED").length, tone: "bg-green-100 text-green-800 border-green-300" },
          ].map((stage, idx) => (
            <div
              key={stage.label}
              className={`flex flex-col items-center justify-center rounded-xl border p-3 text-center transition-all hover:shadow-sm ${stage.tone}`}
            >
              <span className="text-[11px] font-semibold uppercase tracking-wider">{stage.label}</span>
              <strong className="mt-1 text-2xl font-bold">{stage.count}</strong>
            </div>
          ))}
        </div>
      </Card>

      {/* Main Split Content: Left Table & Right Widgets */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left Column: Recent Applications Table */}
        <div className="space-y-4 lg:col-span-2">
          <Card className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-[19px] font-bold text-ink">Recent Candidates</h3>
                <p className="text-xs text-ink-muted">Applicants scored against job requirements</p>
              </div>

              {/* Filters & Search */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                  <input
                    type="text"
                    placeholder="Search candidate or job..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-9 w-48 rounded-lg border border-line-2 bg-white pl-8 pr-3 text-xs text-ink placeholder:text-ink-muted focus:border-brand focus:outline-none"
                  />
                </div>

                <select
                  value={filterStage}
                  onChange={(e) => setFilterStage(e.target.value)}
                  className="h-9 rounded-lg border border-line-2 bg-white px-2.5 text-xs text-ink focus:border-brand focus:outline-none"
                >
                  <option value="ALL">All Stages</option>
                  <option value="IN_REVIEW">In Review</option>
                  <option value="INTERVIEW">Interview</option>
                  <option value="ASSESSMENT">Assessment</option>
                  <option value="LOW_SCORE">Below Threshold (&lt;{tenant.eligibilityThreshold ?? 60})</option>
                </select>
              </div>
            </div>

            {/* Applications List */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                    <th className="pb-3 pl-2">Candidate</th>
                    <th className="pb-3">Target Role</th>
                    <th className="pb-3">AI Score</th>
                    <th className="pb-3">Stage</th>
                    <th className="pb-3">Applied</th>
                    <th className="pb-3 pr-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {filteredApps.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-sm text-ink-muted">
                        No candidates match the filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredApps.map((app) => {
                      const score = app.scores?.[0]?.total;
                      const isLow = score !== undefined && score < (tenant.eligibilityThreshold ?? 60);

                      return (
                        <tr key={app.id} className="group hover:bg-canvas/60">
                          <td className="py-3.5 pl-2">
                            <div className="flex items-center gap-3">
                              <Avatar name={app.user.email} size={32} />
                              <div>
                                <span className="font-semibold text-ink block">{app.user.email}</span>
                                <span className="text-[11px] text-ink-muted">ID: {app.id}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 text-ink-2 font-medium">{app.job.title}</td>
                          <td className="py-3.5">
                            <div className="flex items-center gap-1.5">
                              <ScoreBadge score={score} threshold={tenant.eligibilityThreshold ?? 60} />
                              {isLow && (
                                <span title="Score requires documented human sign-off" className="text-warn">
                                  <Alert size={14} />
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5">
                            <StagePill stage={app.stage} />
                          </td>
                          <td className="py-3.5 text-xs text-ink-muted">{formatRelative(app.submittedAt)}</td>
                          <td className="py-3.5 pr-2 text-right">
                            <Link
                              to={`/${tenant.slug}/applications`}
                              className="inline-flex items-center gap-1 rounded-lg border border-line-2 bg-white px-2.5 py-1 text-xs font-semibold text-ink-2 no-underline hover:border-brand hover:text-brand"
                            >
                              Review
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* AI Rubric & Automated Screening Banner */}
          <div className="flex items-center justify-between rounded-xl2 border border-line bg-gradient-to-r from-ok-soft/60 via-white to-info-soft/40 p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-fg">
                <Sparkle size={20} />
              </span>
              <div>
                <h4 className="text-sm font-bold text-ink">AI Scoring & Screening Rubric v1</h4>
                <p className="text-xs text-ink-muted">
                  Automatic evaluation parses CV keywords, hard criteria, and candidate responses. Cutoff threshold is currently set to{" "}
                  <strong className="text-ink font-semibold">{tenant.eligibilityThreshold ?? 60}%</strong>.
                </p>
              </div>
            </div>
            <Link
              to={`/${tenant.slug}/settings`}
              className="text-xs font-semibold text-brand no-underline hover:underline whitespace-nowrap ml-4"
            >
              Configure Threshold →
            </Link>
          </div>
        </div>

        {/* Right Column: Widgets */}
        <div className="space-y-6">
          {/* Upcoming Interviews Card */}
          <Card className="space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="text-base font-bold text-ink">Upcoming Interviews</h3>
                <p className="text-xs text-ink-muted">LiveKit video room schedules</p>
              </div>
              <span className="flex h-6 items-center rounded-full bg-info-soft px-2 text-[11px] font-bold text-info-ink">
                {interviews.length} Booked
              </span>
            </div>

            <div className="space-y-3">
              {interviews.length === 0 ? (
                <p className="py-4 text-center text-xs text-ink-muted">No interviews scheduled yet.</p>
              ) : (
                interviews.map((int) => (
                  <div
                    key={int.id}
                    className="flex flex-col gap-2 rounded-xl border border-line-soft bg-[#F9FAFC] p-3.5 transition-all hover:border-line"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold text-ink">{int.roundName}</span>
                      <span className="text-[11px] font-semibold text-ok flex items-center gap-1">
                        <Video size={13} /> LiveKit
                      </span>
                    </div>

                    <div className="text-xs text-ink-2">
                      <span className="font-semibold">{int.candidateName}</span> ({int.jobTitle})
                    </div>

                    <div className="flex items-center justify-between pt-1 text-[11px] text-ink-muted border-t border-line/50">
                      <span className="flex items-center gap-1">
                        <Calendar size={13} /> {formatDate(int.scheduledAt)}
                      </span>
                      <span>{int.interviewerName}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Active Job Openings Summary */}
          <Card className="space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="text-base font-bold text-ink">Active Job Openings</h3>
                <p className="text-xs text-ink-muted">{jobs.filter((j) => j.status === "OPEN").length} positions receiving candidates</p>
              </div>
              <Link
                to={`/${tenant.slug}/jobs`}
                className="text-xs font-semibold text-brand no-underline hover:underline"
              >
                View all
              </Link>
            </div>

            <div className="space-y-3">
              {jobs.slice(0, 3).map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between rounded-xl border border-line-soft p-3 hover:bg-canvas/50"
                >
                  <div className="min-w-0 pr-2">
                    <span className="font-semibold text-xs text-ink truncate block">{job.title}</span>
                    <span className="text-[11px] text-ink-muted">
                      {job.department} • {job.location}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-bold text-brand block">
                      {job._count?.applications ?? 0}
                    </span>
                    <span className="text-[10px] text-ink-muted">applicants</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
