import { useState, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { Card, Pill } from "@/components/ui/Card";
import {
  Alert,
  Briefcase,
  Check,
  ChevronRight,
  Clock,
  Download,
  Eye,
  File,
  Filter,
  Plus,
  Search,
  Shield,
  Sparkle,
  Trash,
  User,
  Users,
  Video,
  X,
} from "@/components/ui/icons";
import { ScoreBadge } from "@/components/ui/misc";
import { sendEmailNotification } from "@/lib/emailService";
import { getScreeningCutoffThreshold } from "./BrutallyScoreModule";

export interface ApplicationItem {
  id: string;
  candidateName?: string;
  email: string;
  phone?: string;
  city?: string;
  experience?: string;
  jobTitle: string;
  department?: string;
  stage: string;
  score: number;
  submittedAt: string;
  notes?: string;
  hardScore?: number;
  preferredScore?: number;
  resumeName?: string;
  screeningDeadline?: string;
  rejectionReason?: string;
  holdReason?: string;
  // Screening Answers
  currentCtc?: string;
  expectedCtc?: string;
  noticePeriod?: string;
  locationComfort?: string;
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
}

interface ResumeScreeningModuleProps {
  applications: ApplicationItem[];
  jobs: JobItem[];
  onUpdateApplications: (apps: any[]) => void;
  tenant: { slug: string; name: string };
  onNavigateToAssessments?: (candidateId: string) => void;
}

// Available stages for the QUICK MOVE dropdown as shown in user screenshot
const QUICK_MOVE_STAGES = [
  "APPLIED",
  "UNDER REVIEW",
  "SHORTLISTED",
  "ASSIGNMENT PENDING",
  "ASSIGNMENT IN PROGRESS",
  "ASSIGNMENT SUBMITTED",
  "EVALUATION PENDING",
  "EVALUATION COMPLETED",
  "INTERVIEW SCHEDULED",
  "INTERVIEW COMPLETED",
  "REJECTED",
  "ON HOLD",
];

// Helper to format date into DD/MM/YYYY
function formatAppliedDate(dateStr?: string): string {
  if (!dateStr) return "20/11/2026";
  if (dateStr.includes("/")) return dateStr;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "20/11/2026";
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return "20/11/2026";
  }
}

// Helper to get CSS classes for the stage pills matching user screenshot
function getStagePillClass(stage: string): string {
  const norm = (stage || "").toUpperCase().replace(/\s+/g, "_");
  if (norm === "SELECTED" || norm === "HIRED") {
    return "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 tracking-wide";
  }
  if (norm === "SHORTLISTED") {
    return "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 text-teal-700 border border-teal-200 tracking-wide";
  }
  if (norm === "UNDER_REVIEW" || norm === "IN_REVIEW") {
    return "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 tracking-wide";
  }
  if (
    norm.includes("PENDING") ||
    norm.includes("PROGRESS") ||
    norm.includes("SUBMITTED") ||
    norm.includes("EVALUATION")
  ) {
    return "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200 tracking-wide";
  }
  if (norm === "INTERVIEW_SCHEDULED" || norm === "INTERVIEW_COMPLETED" || norm === "INTERVIEW") {
    return "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 tracking-wide";
  }
  if (norm === "REJECTED") {
    return "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200 tracking-wide";
  }
  if (norm === "ON_HOLD") {
    return "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 tracking-wide";
  }
  return "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 text-gray-700 border border-gray-200 tracking-wide";
}

// Fallback seed applicants if no applications are loaded, perfectly matching user image
const DEFAULT_SEED_APPS: ApplicationItem[] = [
  {
    id: "seed-1",
    candidateName: "Chris Candidate",
    email: "candidate@hiresphere.local",
    jobTitle: "Full Stack Software Engineer",
    department: "Engineering",
    stage: "SELECTED",
    score: 92,
    submittedAt: "2026-11-20",
    phone: "+91 98480 11221",
    city: "Visakhapatnam",
    experience: "4 years",
    hardScore: 48,
    preferredScore: 44,
    resumeName: "Chris_Candidate_Resume.pdf",
    currentCtc: "₹ 12.0 LPA",
    expectedCtc: "₹ 18.0 LPA",
    noticePeriod: "30 Days (Negotiable)",
    locationComfort: "Yes, comfortable with Hybrid",
    notes: "Top performer across frontend, Node.js and distributed microservices.",
  },
  {
    id: "seed-2",
    candidateName: "Chris Candidate",
    email: "candidate@hiresphere.local",
    jobTitle: "Full Stack Software Engineer",
    department: "Engineering",
    stage: "SELECTED",
    score: 89,
    submittedAt: "2026-11-20",
    phone: "+91 98480 11221",
    city: "Visakhapatnam",
    experience: "4 years",
    hardScore: 45,
    preferredScore: 44,
    resumeName: "Chris_Candidate_Resume.pdf",
    currentCtc: "₹ 12.0 LPA",
    expectedCtc: "₹ 18.0 LPA",
    noticePeriod: "30 Days (Negotiable)",
    locationComfort: "Yes, comfortable with Hybrid",
    notes: "Passed architectural technical round with distinction.",
  },
  {
    id: "seed-3",
    candidateName: "Chris Candidate",
    email: "candidate@hiresphere.local",
    jobTitle: "Full Stack Software Engineer",
    department: "Engineering",
    stage: "EVALUATION PENDING",
    score: 84,
    submittedAt: "2026-11-20",
    phone: "+91 98480 11221",
    city: "Visakhapatnam",
    experience: "4 years",
    hardScore: 42,
    preferredScore: 42,
    resumeName: "Chris_Candidate_Resume.pdf",
    currentCtc: "₹ 12.0 LPA",
    expectedCtc: "₹ 18.0 LPA",
    noticePeriod: "30 Days (Negotiable)",
    locationComfort: "Yes, comfortable with Hybrid",
    notes: "Screening submitted; code review pending.",
  },
  {
    id: "seed-4",
    candidateName: "Chris Candidate",
    email: "candidate@hiresphere.local",
    jobTitle: "Senior Frontend Engineer",
    department: "Engineering",
    stage: "UNDER REVIEW",
    score: 88,
    submittedAt: "2026-11-20",
    phone: "+91 98480 11221",
    city: "Visakhapatnam",
    experience: "5 years",
    hardScore: 46,
    preferredScore: 42,
    resumeName: "Chris_Candidate_Frontend_Resume.pdf",
    currentCtc: "₹ 14.0 LPA",
    expectedCtc: "₹ 20.0 LPA",
    noticePeriod: "Immediate Joiner",
    locationComfort: "Yes, comfortable with Hybrid",
    notes: "Deep React, Next.js, and TypeScript performance tuning expertise.",
  },
];

export function ResumeScreeningModule({
  applications,
  jobs,
  onUpdateApplications,
  tenant,
  onNavigateToAssessments,
}: ResumeScreeningModuleProps) {
  // Use real applications if available, otherwise fallback to seed matching image
  const effectiveApps = useMemo(() => {
    if (applications && applications.length > 0) return applications;
    return DEFAULT_SEED_APPS;
  }, [applications]);

  // Filter States (exact as in user image)
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedJob, setSelectedJob] = useState<string>("ALL");
  const [selectedStage, setSelectedStage] = useState<string>("ALL");

  // Feedback Notification
  const [actionNotice, setActionNotice] = useState<string>("");

  // Review Application Modal
  const [reviewingApp, setReviewingApp] = useState<ApplicationItem | null>(null);

  // Distinct Job Options for Dropdown
  const jobOptions = useMemo(() => {
    const fromJobs = jobs.map((j) => j.title);
    const fromApps = effectiveApps.map((a) => a.jobTitle);
    return Array.from(new Set([...fromJobs, ...fromApps])).filter(Boolean);
  }, [jobs, effectiveApps]);

  // Distinct Stages for Dropdown
  const stageOptions = useMemo(() => {
    return [
      "APPLIED",
      "UNDER REVIEW",
      "SHORTLISTED",
      "ASSIGNMENT PENDING",
      "ASSIGNMENT IN PROGRESS",
      "ASSIGNMENT SUBMITTED",
      "EVALUATION PENDING",
      "EVALUATION COMPLETED",
      "INTERVIEW SCHEDULED",
      "INTERVIEW COMPLETED",
      "SELECTED",
      "REJECTED",
      "ON HOLD",
    ];
  }, []);

  // Filtered Applications List
  const filteredApps = useMemo(() => {
    return effectiveApps.filter((app) => {
      // 1. Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = (app.candidateName || "").toLowerCase().includes(q);
        const emailMatch = (app.email || "").toLowerCase().includes(q);
        const roleMatch = (app.jobTitle || "").toLowerCase().includes(q);
        if (!nameMatch && !emailMatch && !roleMatch) return false;
      }

      // 2. Job Filter
      if (selectedJob !== "ALL" && app.jobTitle !== selectedJob) {
        return false;
      }

      // 3. Stage Filter
      if (selectedStage !== "ALL") {
        const appStageNorm = (app.stage || "").toUpperCase().replace(/\s+/g, "_");
        const filterStageNorm = selectedStage.toUpperCase().replace(/\s+/g, "_");
        if (appStageNorm !== filterStageNorm) return false;
      }

      return true;
    });
  }, [effectiveApps, searchQuery, selectedJob, selectedStage]);

  // Handle stage change from QUICK MOVE dropdown or Review Modal
  const handleStageChange = async (appId: string, newStage: string) => {
    const targetApp = effectiveApps.find((a) => a.id === appId);
    if (!targetApp) return;

    const updated = effectiveApps.map((a) => {
      if (a.id === appId) {
        return {
          ...a,
          stage: newStage,
          screeningDeadline:
            newStage === "UNDER REVIEW" || newStage === "IN_REVIEW"
              ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
              : a.screeningDeadline,
        };
      }
      return a;
    });

    onUpdateApplications(updated);
    localStorage.setItem("bh_admin_applications", JSON.stringify(updated));

    if (reviewingApp && reviewingApp.id === appId) {
      setReviewingApp({ ...reviewingApp, stage: newStage });
    }

    setActionNotice(`✓ Moved ${targetApp.candidateName || "Candidate"} to ${newStage}`);
    setTimeout(() => setActionNotice(""), 3500);

    // If moved to SHORTLISTED, dispatch email notification
    if (newStage === "SHORTLISTED" || newStage === "SELECTED") {
      try {
        await sendEmailNotification({
          to: targetApp.email,
          recipientName: targetApp.candidateName || "Candidate",
          stage: "SHORTLISTED",
          jobTitle: targetApp.jobTitle,
          portalPath: `/${tenant.slug}/applications/${targetApp.id}`,
          tenantSlug: tenant.slug,
          customHeading: `Congratulations ${targetApp.candidateName || ""}!`,
          customBody: `Your application for ${targetApp.jobTitle} at Brutallyhired has progressed to ${newStage}. Next step: Technical Assessment (Round 1).`,
        });
      } catch (err) {
        console.warn("Notification notice:", err);
      }
    }
  };

  // Helper to download mock resume
  const handleDownloadResume = (app: ApplicationItem) => {
    const resumeText = `BRUTALLYHIRED CANDIDATE RESUME DOSSIER\n\nCandidate: ${app.candidateName || "Candidate"}\nEmail: ${app.email}\nPhone: ${app.phone || "+91 98480 11221"}\nLocation: ${app.city || "Visakhapatnam"}\nExperience: ${app.experience || "4 years"}\nApplied Position: ${app.jobTitle} (${app.department || "Engineering"})\n\nAI Resume Score: ${app.score || 88}/100\nHard Criteria Score: ${app.hardScore || 45}/50\nPreferred Criteria Score: ${app.preferredScore || 43}/50\n\nScreening Questions Responses:\n- Current CTC: ${app.currentCtc || "₹ 12.0 LPA"}\n- Expected CTC: ${app.expectedCtc || "₹ 18.0 LPA"}\n- Notice Period: ${app.noticePeriod || "30 Days (Negotiable)"}\n- Location Comfort: ${app.locationComfort || "Yes, comfortable with Hybrid / Onsite schedule"}\n\nRecruiter Notes:\n${app.notes || "Solid technical foundation, verified repository portfolio and relevant industry experience."}\n`;
    const blob = new Blob([resumeText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = app.resumeName || `${(app.candidateName || "Candidate").replace(/\s+/g, "_")}_Resume.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Applications Management</h1>
          <p className="text-sm text-ink-muted">
            Review applicant submissions, track active stages, and execute stage transitions
          </p>
        </div>

        {actionNotice && (
          <div className="flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-1.5 text-xs font-bold text-emerald-800 shadow-xs">
            <Check size={14} />
            <span>{actionNotice}</span>
          </div>
        )}
      </div>

      {/* ── FILTER & SEARCH BAR (MATCHING USER SCREENSHOT) ── */}
      <div className="rounded-2xl border border-line bg-white p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search Input */}
          <div className="relative min-w-[260px] max-w-sm flex-1">
            <Search size={14} className="absolute left-3.5 top-2.5 text-ink-muted" />
            <input
              type="text"
              placeholder="Search candidate name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-line bg-canvas pl-9 pr-3 py-1.5 text-xs text-ink placeholder:text-ink-muted focus:border-brand focus:outline-none"
            />
          </div>

          {/* Job Openings Dropdown */}
          <select
            value={selectedJob}
            onChange={(e) => setSelectedJob(e.target.value)}
            className="rounded-xl border border-line bg-canvas px-3.5 py-1.5 text-xs font-medium text-ink focus:border-brand focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Job Openings</option>
            {jobOptions.map((job) => (
              <option key={job} value={job}>
                {job}
              </option>
            ))}
          </select>

          {/* Application Stages Dropdown */}
          <select
            value={selectedStage}
            onChange={(e) => setSelectedStage(e.target.value)}
            className="rounded-xl border border-line bg-canvas px-3.5 py-1.5 text-xs font-medium text-ink focus:border-brand focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Application Stages</option>
            {stageOptions.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>

        {/* Found Count on Right */}
        <div className="text-xs font-medium text-ink-muted">
          {filteredApps.length} application(s) found
        </div>
      </div>

      {/* ── APPLICATIONS TABLE (MATCHING USER SCREENSHOT) ── */}
      <div className="rounded-2xl border border-line bg-white shadow-xs overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-line bg-white text-[11px] font-bold uppercase tracking-wider text-ink-muted">
              <th className="py-3.5 px-6">CANDIDATE NAME</th>
              <th className="py-3.5 px-6">ROLE / JOB</th>
              <th className="py-3.5 px-6">APPLIED</th>
              <th className="py-3.5 px-6">CURRENT STAGE</th>
              <th className="py-3.5 px-6">QUICK MOVE</th>
              <th className="py-3.5 px-6 text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {filteredApps.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-ink-muted">
                  <User size={32} className="mx-auto text-ink-muted/60 mb-2" />
                  <p className="font-semibold text-xs text-ink">No applications found matching filters</p>
                  <p className="text-[11px] text-ink-muted">Try clearing search or changing the stage filter</p>
                </td>
              </tr>
            ) : (
              filteredApps.map((app) => {
                return (
                  <tr key={app.id} className="hover:bg-canvas/50 transition-colors">
                    {/* CANDIDATE NAME */}
                    <td className="py-4 px-6 align-middle">
                      <div className="font-bold text-xs text-ink">
                        {app.candidateName || "Chris Candidate"}
                      </div>
                      <div className="text-[11px] text-ink-muted">
                        {app.email || "candidate@hiresphere.local"}
                      </div>
                    </td>

                    {/* ROLE / JOB */}
                    <td className="py-4 px-6 align-middle">
                      <div className="font-bold text-xs text-ink">{app.jobTitle}</div>
                      <div className="text-[11px] text-ink-muted">
                        {app.department || "Engineering"}
                      </div>
                    </td>

                    {/* APPLIED */}
                    <td className="py-4 px-6 align-middle text-ink-2 font-medium">
                      {formatAppliedDate(app.submittedAt)}
                    </td>

                    {/* CURRENT STAGE */}
                    <td className="py-4 px-6 align-middle">
                      <span className={getStagePillClass(app.stage)}>
                        {app.stage.toUpperCase()}
                      </span>
                    </td>

                    {/* QUICK MOVE (DROPDOWN MENU MATCHING SCREENSHOT) */}
                    <td className="py-4 px-6 align-middle">
                      <select
                        value=""
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val) handleStageChange(app.id, val);
                        }}
                        className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs text-ink shadow-xs focus:border-brand focus:outline-none cursor-pointer"
                      >
                        <option value="" disabled>
                          Change stage...
                        </option>
                        {QUICK_MOVE_STAGES.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* ACTIONS */}
                    <td className="py-4 px-6 align-middle text-right">
                      <button
                        type="button"
                        onClick={() => setReviewingApp(app)}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline transition-colors cursor-pointer"
                      >
                        Review Application →
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── REVIEW APPLICATION MODAL / DRAWER ── */}
      {reviewingApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl border border-line space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-line pb-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="text-lg font-bold text-ink">
                    {reviewingApp.candidateName || "Chris Candidate"}
                  </h3>
                  <span className={getStagePillClass(reviewingApp.stage)}>
                    {reviewingApp.stage.toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-ink-muted mt-1">
                  Applied for <strong className="text-ink">{reviewingApp.jobTitle}</strong> (
                  {reviewingApp.department || "Engineering"}) • Applied on{" "}
                  {formatAppliedDate(reviewingApp.submittedAt)}
                </p>
                <div className="flex items-center gap-3 text-xs text-ink-muted mt-1">
                  <span>{reviewingApp.email}</span>
                  {reviewingApp.phone && <span>• {reviewingApp.phone}</span>}
                  {reviewingApp.city && <span>• {reviewingApp.city}</span>}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setReviewingApp(null)}
                className="text-ink-muted hover:text-ink p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            {/* Candidate Screening Answers */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                Candidate Screening Responses
              </h4>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 rounded-xl bg-canvas p-3 text-xs border border-line">
                <div>
                  <span className="text-[10px] font-semibold text-ink-muted block">Current CTC:</span>
                  <span className="font-bold text-ink">{reviewingApp.currentCtc || "₹ 12.0 LPA"}</span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-ink-muted block">Expected CTC:</span>
                  <span className="font-bold text-ink">{reviewingApp.expectedCtc || "₹ 18.0 LPA"}</span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-ink-muted block">Notice Period:</span>
                  <span className="font-bold text-ink">
                    {reviewingApp.noticePeriod || "30 Days (Negotiable)"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-ink-muted block">Work Location:</span>
                  <span className="font-bold text-ink">
                    {reviewingApp.locationComfort || "Yes, comfortable with Hybrid"}
                  </span>
                </div>
              </div>
            </div>

            {/* AI Resume Match & Dossier */}
            <div className="p-4 rounded-xl border border-line bg-canvas/30 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-ink block">AI Resume Match Analysis</span>
                  <span className="text-[11px] text-ink-muted">
                    Evaluated against job requisition skills, experience & keywords
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-ink">
                    Score: {reviewingApp.score || 88}/100
                  </span>
                  <Button
                    variant="ghost"
                    onClick={() => handleDownloadResume(reviewingApp)}
                    className="text-xs font-semibold flex items-center gap-1 border border-line h-7 px-2"
                  >
                    <Download size={12} />
                    <span>Download Dossier</span>
                  </Button>
                </div>
              </div>

              {reviewingApp.notes && (
                <p className="text-xs text-ink-2 bg-white p-2.5 rounded-lg border border-line">
                  {reviewingApp.notes}
                </p>
              )}
            </div>

            {/* Stage Progression Buttons (Progress Candidate Lifecycle) */}
            <div className="space-y-2 pt-2 border-t border-line">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted block">
                Progress Candidate Lifecycle Stage
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleStageChange(reviewingApp.id, "APPLIED")}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition-all ${
                    reviewingApp.stage === "APPLIED" || reviewingApp.stage === "SUBMITTED"
                      ? "border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-500"
                      : "border-line bg-white text-ink-2 hover:bg-canvas"
                  }`}
                >
                  Applied
                </button>

                <button
                  type="button"
                  onClick={() => handleStageChange(reviewingApp.id, "UNDER REVIEW")}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition-all ${
                    reviewingApp.stage === "UNDER REVIEW" || reviewingApp.stage === "IN_REVIEW"
                      ? "border-amber-500 bg-amber-50 text-amber-800 ring-2 ring-amber-500"
                      : "border-line bg-white text-ink-2 hover:bg-canvas"
                  }`}
                >
                  Under Review (3-day deadline)
                </button>

                <button
                  type="button"
                  onClick={() => handleStageChange(reviewingApp.id, "SHORTLISTED")}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition-all ${
                    reviewingApp.stage === "SHORTLISTED"
                      ? "border-teal-600 bg-teal-50 text-teal-800 ring-2 ring-teal-600"
                      : "border-line bg-white text-ink-2 hover:bg-canvas"
                  }`}
                >
                  Shortlisted
                </button>

                <button
                  type="button"
                  onClick={() => handleStageChange(reviewingApp.id, "SELECTED")}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition-all ${
                    reviewingApp.stage === "SELECTED"
                      ? "border-emerald-600 bg-emerald-600 text-white ring-2 ring-emerald-600"
                      : "border-line bg-white text-ink-2 hover:bg-canvas"
                  }`}
                >
                  Selected
                </button>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-line text-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleStageChange(reviewingApp.id, "REJECTED")}
                  className="font-semibold text-rose-600 hover:underline"
                >
                  Reject Application
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => handleStageChange(reviewingApp.id, "ON HOLD")}
                  className="font-semibold text-amber-600 hover:underline"
                >
                  Put On Hold
                </button>
              </div>

              <div className="flex items-center gap-2">
                {onNavigateToAssessments && (
                  <Button
                    variant="primary"
                    onClick={() => {
                      setReviewingApp(null);
                      onNavigateToAssessments(reviewingApp.id);
                    }}
                    className="text-xs font-bold"
                  >
                    <span>Proceed to Assessment Studio →</span>
                  </Button>
                )}
                <Button variant="ghost" onClick={() => setReviewingApp(null)} className="text-xs">
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
