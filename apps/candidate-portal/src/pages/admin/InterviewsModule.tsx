import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/feedback";
import { Field, Input, Select } from "@/components/ui/form";
import {
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Search,
  Shield,
  Users,
  Video,
} from "@/components/ui/icons";
import { Avatar } from "@/components/ui/misc";
import {
  getSavedAssessmentRounds,
  type AssessmentRoundItem,
} from "./AssessmentRoundsStudio";

export interface InterviewItem {
  id: string;
  roundName: string;
  candidateName: string;
  candidateEmail?: string;
  jobTitle: string;
  department?: string;
  scheduledAt: string;
  interviewerName: string;
  roundNumber?: number; // 1, 2, 3...
  status?: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "SCHEDULED";
  meetingUrl?: string;
  candidateId?: string;
  updatedOn?: string;
}

interface InterviewsModuleProps {
  jobs: any[];
  applications: any[];
  onUpdateApplications?: (apps: any[]) => void;
  tenant: { slug: string; name: string };
  onNavigateToOffer?: (candidateId: string) => void;
}

export function InterviewsModule({
  jobs,
  applications,
  tenant,
  onNavigateToOffer,
}: InterviewsModuleProps) {
  // 1. DYNAMIC ASSESSMENT ROUNDS FROM ASSESSMENT MODULE
  const assessmentRounds: AssessmentRoundItem[] = useMemo(() => {
    return getSavedAssessmentRounds();
  }, []);

  // 2. INTERVIEWS STATE (Persisted via existing bh_admin_interviews key)
  const [interviews, setInterviews] = useState<InterviewItem[]>(() => {
    const saved = localStorage.getItem("bh_admin_interviews");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    // Initialize based on existing candidates and assessment rounds
    return [
      {
        id: "int-1",
        roundName: assessmentRounds[0]?.name
          ? `Round 1: ${assessmentRounds[0].name}`
          : "Round 1: Technical Assessment",
        candidateName: "Priya Nair",
        candidateEmail: "priya.nair@example.com",
        jobTitle: "Software Developer",
        scheduledAt: "Today at 3:00 PM",
        interviewerName: "Arun K. (Principal Arch)",
        roundNumber: 1,
        status: "COMPLETED",
        updatedOn: "20 mins ago",
      },
      {
        id: "int-2",
        roundName: assessmentRounds[1]?.name
          ? `Round 2: ${assessmentRounds[1].name}`
          : "Round 2: Practical Assessment Task",
        candidateName: "Rahul Sharma",
        candidateEmail: "rahul.sharma@example.com",
        jobTitle: "Software Developer",
        scheduledAt: "Tomorrow at 11:30 AM",
        interviewerName: "Chandra S. (Lead Eng)",
        roundNumber: 2,
        status: "IN_PROGRESS",
        updatedOn: "1 hour ago",
      },
      {
        id: "int-3",
        roundName: assessmentRounds[2]?.name
          ? `Round 3: ${assessmentRounds[2].name}`
          : "Round 3: Manager Round",
        candidateName: "Aditya Kumar",
        candidateEmail: "aditya.k@example.com",
        jobTitle: "Software Developer",
        scheduledAt: "Friday at 4:00 PM",
        interviewerName: "Tanuja M. (Head of Product)",
        roundNumber: 3,
        status: "SCHEDULED",
        meetingUrl: "https://meet.livekit.io/bh-manager-fullstack-r3",
        updatedOn: "Just now",
      },
    ];
  });

  // Save changes to localStorage whenever interviews change
  useEffect(() => {
    try {
      localStorage.setItem("bh_admin_interviews", JSON.stringify(interviews));
    } catch {}
  }, [interviews]);

  // 3. FILTERS STATE
  const [selectedRoundFilter, setSelectedRoundFilter] = useState<number | "ALL">("ALL");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  // Real-time round counts for filter pills (dynamically generated per assessment round)
  const roundCounts = useMemo(() => {
    const counts: Record<number | string, number> = { ALL: interviews.length };
    assessmentRounds.forEach((r) => {
      counts[r.roundNumber] = interviews.filter((int) => {
        if (int.roundNumber) return int.roundNumber === r.roundNumber;
        return (
          int.roundName.toLowerCase().includes(`round ${r.roundNumber}`) ||
          int.roundName.toLowerCase().includes(r.name.toLowerCase())
        );
      }).length;
    });
    return counts;
  }, [interviews, assessmentRounds]);

  // 4. FILTERED INTERVIEWS
  const filteredInterviews = useMemo(() => {
    return interviews.filter((item) => {
      // Round Filter
      if (selectedRoundFilter !== "ALL") {
        const itemRoundNum = item.roundNumber || (item.roundName.includes("Round 1") ? 1 : item.roundName.includes("Round 2") ? 2 : item.roundName.includes("Round 3") ? 3 : 0);
        if (itemRoundNum !== selectedRoundFilter) return false;
      }

      // Status Filter
      if (selectedStatusFilter !== "ALL") {
        const itemStatus = item.status || "SCHEDULED";
        if (itemStatus !== selectedStatusFilter) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.candidateName.toLowerCase().includes(q);
        const matchesJob = item.jobTitle.toLowerCase().includes(q);
        const matchesRound = item.roundName.toLowerCase().includes(q);
        const matchesPanelist = item.interviewerName.toLowerCase().includes(q);
        if (!matchesName && !matchesJob && !matchesRound && !matchesPanelist) {
          return false;
        }
      }

      return true;
    });
  }, [interviews, selectedRoundFilter, selectedStatusFilter, searchQuery]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedRoundFilter, selectedStatusFilter, searchQuery]);

  // 5. PAGINATION SLICE (10 records per page)
  const totalRecords = filteredInterviews.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedInterviews = useMemo(() => {
    const start = (safeCurrentPage - 1) * PAGE_SIZE;
    return filteredInterviews.slice(start, start + PAGE_SIZE);
  }, [filteredInterviews, safeCurrentPage, PAGE_SIZE]);

  // 6. SCHEDULE NEW INTERVIEW MODAL
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleCandidateName, setScheduleCandidateName] = useState("");
  const [scheduleJobTitle, setScheduleJobTitle] = useState("");
  const [scheduleSelectedRoundNum, setScheduleSelectedRoundNum] = useState<number>(
    assessmentRounds[0]?.roundNumber || 1
  );
  const [scheduleInterviewer, setScheduleInterviewer] = useState("Arun K. (Principal Architect)");
  const [scheduleDateTime, setScheduleDateTime] = useState("Tomorrow at 10:00 AM");
  const [scheduleStatus, setScheduleStatus] = useState<"PENDING" | "IN_PROGRESS" | "COMPLETED" | "SCHEDULED">("SCHEDULED");
  const [notice, setNotice] = useState("");

  const handleOpenScheduleModal = () => {
    const firstCandidate = applications[0];
    if (firstCandidate) {
      setScheduleCandidateName(firstCandidate.candidateName || "Candidate");
      setScheduleJobTitle(firstCandidate.jobTitle || "Software Developer");
    } else {
      setScheduleCandidateName("Candidate");
      setScheduleJobTitle("Software Developer");
    }
    setScheduleSelectedRoundNum(assessmentRounds[0]?.roundNumber || 1);
    setScheduleInterviewer("Arun K. (Principal Architect)");
    setScheduleDateTime("Tomorrow at 10:00 AM");
    setScheduleStatus("SCHEDULED");
    setScheduleModalOpen(true);
  };

  const handleConfirmScheduleInterview = () => {
    if (!scheduleCandidateName.trim()) return;

    const roundDef = assessmentRounds.find((r) => r.roundNumber === scheduleSelectedRoundNum);
    const roundTitle = roundDef
      ? `Round ${roundDef.roundNumber}: ${roundDef.name}`
      : `Round ${scheduleSelectedRoundNum}: Technical Round`;

    const isManagerRound = roundDef?.type === "MANAGERIAL" || scheduleSelectedRoundNum === 3;
    const meetingUrl = isManagerRound
      ? roundDef?.livekitRoom?.roomUrl || `https://meet.livekit.io/bh-manager-${Math.random().toString(36).slice(2, 7)}`
      : undefined;

    const newInterview: InterviewItem = {
      id: `int-${Date.now()}`,
      roundName: roundTitle,
      candidateName: scheduleCandidateName.trim(),
      jobTitle: scheduleJobTitle.trim() || "Software Developer",
      scheduledAt: scheduleDateTime.trim() || "Upcoming",
      interviewerName: scheduleInterviewer.trim() || "Technical Panel",
      roundNumber: scheduleSelectedRoundNum,
      status: scheduleStatus,
      meetingUrl,
      updatedOn: "Just now",
    };

    const updated = [newInterview, ...interviews];
    setInterviews(updated);
    setScheduleModalOpen(false);
    setNotice(`✓ Interview scheduled for ${newInterview.candidateName}!`);
    setTimeout(() => setNotice(""), 3500);
  };

  // Quick Status Update
  const handleUpdateStatus = (id: string, newStatus: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "SCHEDULED") => {
    setInterviews((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status: newStatus, updatedOn: "Just now" } : item
      )
    );
  };

  return (
    <div className="space-y-6">
      {/* HEADER (LIKE BEFORE) */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Technical Interviews & LiveKit RTC</h1>
          <p className="text-sm text-ink-muted">
            Configurable interview rounds, live WebRTC video rooms, panel evaluations, and stage progression.
          </p>
        </div>
        <Button
          icon={<Plus size={18} />}
          onClick={handleOpenScheduleModal}
        >
          Schedule New Interview
        </Button>
      </div>

      {notice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center justify-between">
          <span>{notice}</span>
          <button onClick={() => setNotice("")} className="text-emerald-700 hover:underline">
            ✕
          </button>
        </div>
      )}

      {/* QUICK METRICS (LIKE BEFORE) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="flex items-center gap-4 p-5">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-brand">
            <Video size={24} />
          </span>
          <div>
            <span className="text-xs font-semibold text-ink-muted block uppercase tracking-wider">Scheduled Rounds</span>
            <span className="font-display text-2xl font-bold text-ink">{interviews.length}</span>
          </div>
        </Card>
        <Card className="flex items-center gap-4 p-5">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
            <Shield size={24} />
          </span>
          <div>
            <span className="text-xs font-semibold text-ink-muted block uppercase tracking-wider">SFU Audio/Video Engine</span>
            <span className="font-display text-base font-bold text-teal-800">LiveKit Cloud (Active)</span>
          </div>
        </Card>
        <Card className="flex items-center gap-4 p-5">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
            <Users size={24} />
          </span>
          <div>
            <span className="text-xs font-semibold text-ink-muted block uppercase tracking-wider">Hiring Panels</span>
            <span className="font-display text-base font-bold text-ink">Arun K. & Chandra S.</span>
          </div>
        </Card>
      </div>

      {/* FILTERS BAR (KEPT AS REQUESTED, ROUNDS DYNAMICALLY FROM ASSESSMENT MODULE, NO FINAL ROUND) */}
      <Card className="p-3.5 bg-surface/90 border-line">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Filter by Round Status (Dynamic Pills from Assessment Studio) */}
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-ink-muted block uppercase tracking-wider">
              Filter by Round Status
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {/* All Rounds */}
              <button
                type="button"
                onClick={() => setSelectedRoundFilter("ALL")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 border ${
                  selectedRoundFilter === "ALL"
                    ? "bg-blue-50 border-brand text-brand font-bold shadow-xs"
                    : "bg-surface border-line/80 text-ink-2 hover:bg-canvas"
                }`}
              >
                <span>All Rounds</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    selectedRoundFilter === "ALL" ? "bg-brand text-white" : "bg-canvas text-ink-muted"
                  }`}
                >
                  {roundCounts.ALL || 0}
                </span>
              </button>

              {/* Dynamic Assessment Rounds (Round 1, Round 2, Round 3...) */}
              {assessmentRounds.map((round) => {
                const isActive = selectedRoundFilter === round.roundNumber;
                const count = roundCounts[round.roundNumber] || 0;

                return (
                  <button
                    key={round.id}
                    type="button"
                    onClick={() => setSelectedRoundFilter(round.roundNumber)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 border ${
                      isActive
                        ? "bg-blue-50 border-brand text-brand font-bold shadow-xs"
                        : "bg-surface border-line/80 text-ink-2 hover:bg-canvas"
                    }`}
                  >
                    <span>Round {round.roundNumber}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                        isActive ? "bg-brand text-white" : "bg-canvas text-ink-muted"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Side: Assessment Round Dropdown, Status Dropdown, Search Input */}
          <div className="flex flex-wrap items-end gap-2.5">
            {/* Assessment Round Dropdown */}
            <div className="space-y-1 min-w-[170px]">
              <label className="text-[11px] font-bold text-ink-muted block uppercase tracking-wider">
                Assessment Round
              </label>
              <select
                value={selectedRoundFilter}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedRoundFilter(val === "ALL" ? "ALL" : Number(val));
                }}
                className="w-full text-xs font-medium rounded-xl border border-line bg-surface px-3 py-1.5 text-ink focus:outline-none focus:border-brand shadow-xs"
              >
                <option value="ALL">All Rounds</option>
                {assessmentRounds.map((round) => (
                  <option key={round.id} value={round.roundNumber}>
                    Round {round.roundNumber}: {round.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Assessment Status Dropdown */}
            <div className="space-y-1 min-w-[140px]">
              <label className="text-[11px] font-bold text-ink-muted block uppercase tracking-wider">
                Assessment Status
              </label>
              <select
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                className="w-full text-xs font-medium rounded-xl border border-line bg-surface px-3 py-1.5 text-ink focus:outline-none focus:border-brand shadow-xs"
              >
                <option value="ALL">All Status</option>
                <option value="PENDING">Pending</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="SCHEDULED">Scheduled</option>
              </select>
            </div>

            {/* Candidate Search Box */}
            <div className="space-y-1 min-w-[190px]">
              <label className="text-[11px] font-bold text-ink-muted block uppercase tracking-wider">
                Search
              </label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search candidate..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-line bg-surface text-ink placeholder:text-ink-muted focus:outline-none focus:border-brand shadow-xs"
                />
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* SCHEDULED INTERVIEWS TABLE (EXACT TABLE LAYOUT & STYLING LIKE BEFORE) */}
      <Card className="space-y-4">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
              <th className="pb-3 pl-4">Candidate & Job</th>
              <th className="pb-3">Round Details</th>
              <th className="pb-3">Scheduled Time</th>
              <th className="pb-3">Panelists</th>
              <th className="pb-3 pr-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {paginatedInterviews.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-xs text-ink-muted">
                  No interviews found matching your filter criteria.
                </td>
              </tr>
            ) : (
              paginatedInterviews.map((int) => {
                const status = int.status || "SCHEDULED";
                const isCompleted = status === "COMPLETED";
                const isInProgress = status === "IN_PROGRESS";
                const isScheduled = status === "SCHEDULED";

                return (
                  <tr key={int.id} className="hover:bg-canvas/50 transition-colors">
                    {/* Candidate & Job */}
                    <td className="py-3.5 pl-4 flex items-center gap-3">
                      <Avatar name={int.candidateName} size={34} />
                      <div>
                        <span className="font-bold text-xs text-ink block">{int.candidateName}</span>
                        <span className="text-[11px] text-ink-muted">{int.jobTitle}</span>
                      </div>
                    </td>

                    {/* Round Details */}
                    <td className="py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-ink block">{int.roundName}</span>
                        {/* Status badge pill */}
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isCompleted
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              : isInProgress
                              ? "bg-blue-50 text-blue-800 border border-blue-200"
                              : isScheduled
                              ? "bg-purple-50 text-purple-800 border border-purple-200"
                              : "bg-amber-50 text-amber-800 border border-amber-200"
                          }`}
                        >
                          {status}
                        </span>
                      </div>
                      <span className="text-[11px] text-ink-muted block mt-0.5">
                        {int.roundName.toLowerCase().includes("manager") || int.roundNumber === 3
                          ? "LiveKit Video & Audio Enabled"
                          : "Proctored Assessment & Automated Evaluation"}
                      </span>
                    </td>

                    {/* Scheduled Time */}
                    <td className="py-3.5 text-xs font-medium text-brand">
                      {int.scheduledAt}
                    </td>

                    {/* Panelists */}
                    <td className="py-3.5 text-xs text-ink-2">
                      <div>{int.interviewerName}</div>
                      {/* Quick status dropdown */}
                      <select
                        value={status}
                        onChange={(e) =>
                          handleUpdateStatus(
                            int.id,
                            e.target.value as "PENDING" | "IN_PROGRESS" | "COMPLETED" | "SCHEDULED"
                          )
                        }
                        className="mt-1 text-[10px] font-medium rounded border border-line bg-surface px-1.5 py-0.5 text-ink-muted hover:border-brand cursor-pointer"
                      >
                        <option value="SCHEDULED">Scheduled</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="PENDING">Pending</option>
                      </select>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 pr-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Direct Video Call / Join link */}
                        <Link
                          to={int.meetingUrl || `/${tenant.slug}/applications/app-101/interviews/round-1/join`}
                          target="_blank"
                          className="rounded-lg bg-brand hover:bg-brand-hover text-white text-xs font-bold px-3 py-1.5 transition-colors no-underline inline-flex items-center gap-1 shadow-xs"
                        >
                          <span>Join Video Call</span> ↗
                        </Link>

                        {/* Pass -> Issue Offer */}
                        <button
                          type="button"
                          onClick={() => {
                            if (onNavigateToOffer) {
                              onNavigateToOffer(int.candidateName);
                            }
                          }}
                          className="rounded-lg bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-800 text-xs font-bold px-2.5 py-1.5 transition-colors"
                        >
                          Pass → Issue Offer
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* PAGINATION (AFTER 10 RECORDS) */}
        {totalRecords > PAGE_SIZE && (
          <div className="flex flex-wrap items-center justify-between border-t border-line pt-3 px-2 text-xs text-ink-muted">
            <div>
              Showing{" "}
              <strong className="text-ink">
                {(safeCurrentPage - 1) * PAGE_SIZE + 1}
              </strong>{" "}
              to{" "}
              <strong className="text-ink">
                {Math.min(safeCurrentPage * PAGE_SIZE, totalRecords)}
              </strong>{" "}
              of <strong className="text-ink">{totalRecords}</strong> interviews
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={safeCurrentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-line bg-surface hover:bg-canvas disabled:opacity-40 disabled:cursor-not-allowed text-ink"
              >
                <ChevronLeft size={14} />
              </button>

              {Array.from({ length: totalPages }).map((_, idx) => {
                const pageNum = idx + 1;
                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setCurrentPage(pageNum)}
                    className={`min-w-[28px] h-7 px-2 rounded-lg text-xs font-bold transition-colors ${
                      safeCurrentPage === pageNum
                        ? "bg-brand text-white"
                        : "bg-surface border border-line hover:bg-canvas text-ink-2"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                type="button"
                disabled={safeCurrentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-line bg-surface hover:bg-canvas disabled:opacity-40 disabled:cursor-not-allowed text-ink"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* SCHEDULE INTERVIEW MODAL (USES DYNAMIC ROUNDS FROM ASSESSMENT MODULE) */}
      <Modal
        open={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        title="Schedule Interview Round"
        subtitle="Schedule a candidate for an assessment round configured in Assessment Studio."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleConfirmScheduleInterview();
          }}
          className="space-y-4"
        >
          {/* Candidate Selector */}
          <Field label="Candidate">
            <select
              value={scheduleCandidateName}
              onChange={(e) => {
                const candName = e.target.value;
                setScheduleCandidateName(candName);
                const matchingApp = applications.find((a) => a.candidateName === candName);
                if (matchingApp?.jobTitle) setScheduleJobTitle(matchingApp.jobTitle);
              }}
              className="w-full text-xs rounded-xl border border-line bg-surface px-3 py-2 text-ink focus:outline-none focus:border-brand"
            >
              {applications.map((app) => (
                <option key={app.id} value={app.candidateName || "Candidate"}>
                  {app.candidateName} — {app.jobTitle}
                </option>
              ))}
            </select>
          </Field>

          {/* Assessment Round (Dynamically fetched from Assessment Module, NO FINAL ROUND) */}
          <Field label="Assessment Round">
            <select
              value={scheduleSelectedRoundNum}
              onChange={(e) => setScheduleSelectedRoundNum(Number(e.target.value))}
              className="w-full text-xs rounded-xl border border-line bg-surface px-3 py-2 text-ink focus:outline-none focus:border-brand font-semibold text-brand"
            >
              {assessmentRounds.map((round) => (
                <option key={round.id} value={round.roundNumber}>
                  Round {round.roundNumber}: {round.name} ({round.type === "MANAGERIAL" ? "LiveKit Video Call" : round.type})
                </option>
              ))}
            </select>
          </Field>

          {/* Interviewer */}
          <Field label="Interview Panelist / Lead">
            <Input
              value={scheduleInterviewer}
              onChange={(e) => setScheduleInterviewer(e.target.value)}
              placeholder="e.g. Arun K. (Principal Architect)"
            />
          </Field>

          {/* Scheduled Date & Time */}
          <Field label="Scheduled Date & Time">
            <Input
              value={scheduleDateTime}
              onChange={(e) => setScheduleDateTime(e.target.value)}
              placeholder="e.g. Tomorrow at 11:00 AM"
            />
          </Field>

          {/* Initial Status */}
          <Field label="Initial Round Status">
            <select
              value={scheduleStatus}
              onChange={(e) =>
                setScheduleStatus(e.target.value as "PENDING" | "IN_PROGRESS" | "COMPLETED" | "SCHEDULED")
              }
              className="w-full text-xs rounded-xl border border-line bg-surface px-3 py-2 text-ink focus:outline-none focus:border-brand"
            >
              <option value="SCHEDULED">Scheduled</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="PENDING">Pending</option>
            </select>
          </Field>

          <div className="flex justify-end gap-2 border-t border-line pt-3">
            <Button variant="ghost" onClick={() => setScheduleModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Schedule Round</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
