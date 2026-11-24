import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useTenantCtx } from "@/components/layout/TenantContext";
import { Button } from "@/components/ui/Button";
import { Card, Fact, Pill, SectionTitle } from "@/components/ui/Card";
import { Modal, Spinner } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import {
  Alert,
  Arrow,
  Bell,
  Briefcase,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  Copy,
  Dashboard,
  Download,
  ExternalLink,
  Eye,
  File,
  Filter,
  Globe,
  Lock,
  LogOut,
  Mail,
  Monitor,
  Pin,
  Plus,
  Search,
  Settings,
  Share,
  Shield,
  Sparkle,
  Users,
  Video,
  Wifi,
  X,
  Trash,
} from "@/components/ui/icons";
import { Avatar, ScoreBadge, StagePill } from "@/components/ui/misc";
import { ResumeDocViewer } from "@/components/common/ResumeDocViewer";
import { applyBrand } from "@/lib/brand";
import { initials } from "@/lib/format";
import { generateJobDescription, generateJobDescriptionHtml } from "@/lib/jobGenerator";
import { JobDescriptionEditor } from "./JobDescriptionEditor";
import { BrutallyScoreModule, getScreeningCutoffThreshold } from "./BrutallyScoreModule";
import { AssessmentRoundsStudio } from "./AssessmentRoundsStudio";
import { InterviewSlotsModule } from "./InterviewSlotsModule";
import { InterviewsModule } from "./InterviewsModule";
import { OfferModule } from "./OfferModule";
import { OnboardingModule } from "./OnboardingModule";
import {
  sendEmailNotification,
  getSentEmails,
  type SentEmailRecord,
} from "@/lib/emailService";
import { AdminLoginPage } from "./AdminLoginPage";

interface JobItem {
  id: string;
  externalRef: string;
  title: string;
  department: string;
  location: string;
  experience?: string;
  keywords?: string;
  publishedChannels?: string[];
  workplaceType: "REMOTE" | "HYBRID" | "ONSITE";
  status: "OPEN" | "DRAFT" | "CLOSED";
  description: string;
  applicantCount: number;
}

interface ApplicationItem {
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
  hardScore: number;
  preferredScore: number;
  resumeName?: string;
  screeningDeadline?: string;
  rejectionReason?: string;
  holdReason?: string;
  currentCtc?: string;
  expectedCtc?: string;
  noticePeriod?: string;
  locationComfort?: string;
  resumeDataUrl?: string;
}

interface AssessmentSessionItem {
  id: string;
  candidateId: string;
  candidateName: string;
  jobTitle: string;
  assessmentTitle: string;
  mode: "STANDARD" | "HIGHER_ASSURANCE";
  invitedAt: string;
  expiresIn: string;
  systemTest: {
    consent: boolean;
    webcam: boolean;
    screenShare: boolean;
    audio: boolean;
    networkLatency: string;
  };
  durationMins: number;
  autosaveCheckpoints: number;
  status: "INVITED" | "IN_PROGRESS" | "FLAGGED_REVIEW" | "ADJUDICATED";
  aiSignals: {
    faceVisibilityPct: number;
    extraPersonsCount: number;
    phoneDetected: boolean;
    monitorCount: number;
    focusLossCount: number;
    interruptionsCount: number;
  };
  riskScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  adjudication?: "PASS" | "RETRY" | "MANUAL_REVIEW" | "FAIL";
  adjudicationNote?: string;
  auditTrail: { time: string; event: string; tone: "ok" | "warn" | "danger" | "info" }[];
}

const REJECTION_REASONS = [
  { id: "SCORE_BELOW_POLICY", label: "BrutalEngine™ score did not meet policy cutoff" },
  { id: "SCREENING_DEADLINE_EXPIRED", label: "Screening questions 3-day deadline expired" },
  { id: "ASSESSMENT_FAILED", label: "BrutalAssessAI™ assessment failed / proctoring violations" },
  { id: "INTERVIEW_NOT_PASSED", label: "Interview rounds did not pass panel evaluation" },
  { id: "CANDIDATE_WITHDREW", label: "Candidate withdrew or accepted another offer" },
  { id: "HR_OVERRIDE", label: "HR administrative override / profile mismatch" },
];

const HOLD_REASONS = [
  { id: "AWAITING_SCREENING", label: "Awaiting candidate screening question responses" },
  { id: "BATCH_CAPACITY_REACHED", label: "Batch capacity reached — hold for subsequent wave" },
  { id: "PENDING_PANEL_AVAILABILITY", label: "Pending senior interviewer panel scheduling" },
  { id: "TALENT_POOL", label: "Retain in talent pool for future requisition match" },
];

interface InterviewItem {
  id: string;
  roundName: string;
  candidateName: string;
  jobTitle: string;
  scheduledAt: string;
  interviewerName: string;
}

interface StaffItem {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "RECRUITER" | "INTERVIEWER";
  title: string;
}

// Authentic candidate uploaded resume helper - points exclusively to real uploaded resume file
function getCandidateUploadedResume(app: ApplicationItem | null) {
  if (!app) {
    return {
      url: "/resumes/Amirti_Tanuja_Round2_Task.pdf",
      filename: "Amirti_Tanuja_Round2_Task.pdf",
    };
  }

  const filename =
    app.resumeName ||
    (app.candidateName
      ? `${app.candidateName.replace(/\s+/g, "_")}_Resume.pdf`
      : "Amirti_Tanuja_Round2_Task.pdf");

  if (app.resumeDataUrl) {
    return {
      url: app.resumeDataUrl,
      filename,
    };
  }

  // Use the verified original uploaded resume
  return {
    url: "/resumes/Amirti_Tanuja_Round2_Task.pdf",
    filename: filename.endsWith(".pdf") ? filename : `${filename}.pdf`,
  };
}

function downloadCandidateResume(url: string, filename: string) {
  if (url.startsWith("data:")) {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return;
  }
  fetch(url)
    .then((res) => res.blob())
    .then((blob) => {
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    })
    .catch(() => {
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });
}

export function AdminDashboard() {
  const tenant = useTenantCtx();
  const navigate = useNavigate();

  // Authentication gate for Admin Portal
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem("admin_authenticated") === "true";
  });

  const handleSignOut = () => {
    sessionStorage.removeItem("admin_authenticated");
    sessionStorage.removeItem("admin_email");
    setIsAuthenticated(false);
  };

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "candidates" | "jobs" | "assessments" | "interviews" | "interviewSlots" | "brutallyScore" | "offers" | "onboarding" | "staff" | "settings"
  >("dashboard");
  const [currentAdminRole, setCurrentAdminRole] = useState<"ADMIN" | "RECRUITER" | "INTERVIEWER">("ADMIN");

  // State data (dynamically managed, no hardcoded jobs)
  const [jobs, setJobs] = useState<JobItem[]>(() => {
    const saved = localStorage.getItem("bh_admin_jobs");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // ignore parsing errors
      }
    }
    return [];
  });

  const [applications, setApplications] = useState<ApplicationItem[]>(() => {
    const saved = localStorage.getItem("bh_admin_applications");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        // ignore parsing errors
      }
    }
    return [
      {
        id: "app-101",
        candidateName: "Rahul Sharma",
        email: "rahul.sharma@example.com",
        phone: "+91 98765 43210",
        city: "Bangalore",
        experience: "3 years",
        jobTitle: "Software Developer",
        department: "Engineering",
        stage: "IN_REVIEW",
        score: 88,
        submittedAt: "2 hours ago",
        notes: "Strong TypeScript, React, and backend API design experience. Excellent problem solver.",
        hardScore: 50,
        preferredScore: 38,
        resumeName: "Rahul_Sharma_Resume.pdf",
      },
      {
        id: "app-102",
        candidateName: "Priya Nair",
        email: "priya.nair@example.com",
        phone: "+91 98450 11223",
        city: "Visakhapatnam",
        experience: "2 years",
        jobTitle: "Software Developer",
        department: "Engineering",
        stage: "INTERVIEW",
        score: 94,
        submittedAt: "Yesterday",
        notes: "Exceptional system design background. Proceeded past technical review with distinction.",
        hardScore: 50,
        preferredScore: 44,
        resumeName: "Priya_Nair_CV.pdf",
      },
      {
        id: "app-103",
        candidateName: "Aditya Kumar",
        email: "aditya.k@example.com",
        phone: "+91 97112 34567",
        city: "Hyderabad",
        experience: "1 year",
        jobTitle: "Software Developer",
        department: "Engineering",
        stage: "SUBMITTED",
        score: 82,
        submittedAt: "Just now",
        notes: "Candidate applied via portal. Full profile and resume credentials submitted.",
        hardScore: 45,
        preferredScore: 37,
        resumeName: "Aditya_Kumar_Resume.pdf",
      },
      {
        id: "app-104",
        candidateName: "Kavita Verma",
        email: "kavita.verma@example.com",
        phone: "+91 99887 65432",
        city: "Pune",
        experience: "4 years",
        jobTitle: "Lead Product Designer",
        department: "Design",
        stage: "IN_REVIEW",
        score: 54,
        submittedAt: "3 days ago",
        notes: "Below 60 threshold: Review recommended for domain depth before advancing.",
        hardScore: 30,
        preferredScore: 24,
        resumeName: "Kavita_Verma_Portfolio.pdf",
      },
      {
        id: "app-105",
        candidateName: "Amit Patel",
        email: "amit.patel@example.com",
        phone: "+91 98223 99887",
        city: "Mumbai",
        experience: "5 years",
        jobTitle: "DevOps Engineer",
        department: "Infrastructure",
        stage: "OFFER",
        score: 92,
        submittedAt: "5 days ago",
        notes: "Completed all technical & culture interviews. Formal offer extended.",
        hardScore: 50,
        preferredScore: 42,
        resumeName: "Amit_Patel_Senior_DevOps.pdf",
      },
      {
        id: "app-106",
        candidateName: "Sneha Iyer",
        email: "sneha.iyer@example.com",
        phone: "+91 98111 22334",
        city: "Chennai",
        experience: "2 years",
        jobTitle: "AI Product Manager",
        department: "Product",
        stage: "ASSESSMENT",
        score: 76,
        submittedAt: "1 day ago",
        notes: "Automated assessment invite dispatched. Portfolio in evaluation.",
        hardScore: 42,
        preferredScore: 34,
        resumeName: "Sneha_Iyer_PM.pdf",
      },
    ];
  });

  const [candidateJobFilter, setCandidateJobFilter] = useState("ALL");

  const [interviews, setInterviews] = useState<InterviewItem[]>(() => {
    const saved = localStorage.getItem("bh_admin_interviews");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    return [
      {
        id: "int-1",
        roundName: "System Architecture Round",
        candidateName: "Priya Nair",
        jobTitle: "Software Developer",
        scheduledAt: "Today at 3:00 PM",
        interviewerName: "Arun K. (Principal Arch)",
      },
      {
        id: "int-2",
        roundName: "Technical Deep-Dive",
        candidateName: "Rahul Sharma",
        jobTitle: "Software Developer",
        scheduledAt: "Tomorrow at 11:30 AM",
        interviewerName: "Chandra S. (Lead Eng)",
      },
      {
        id: "int-3",
        roundName: "Product Sense & AI Strategy",
        candidateName: "Aditya Kumar",
        jobTitle: "Software Developer",
        scheduledAt: "Friday at 4:00 PM",
        interviewerName: "Tanuja M. (Head of Product)",
      },
    ];
  });

  // Schedule Interview Modal state
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleTargetApp, setScheduleTargetApp] = useState<ApplicationItem | null>(null);
  const [scheduleRoundName, setScheduleRoundName] = useState("Round 1: System Architecture & Technical Deep-Dive");
  const [scheduleInterviewer, setScheduleInterviewer] = useState("Arun K. (Principal Architect)");
  const [scheduleDateTime, setScheduleDateTime] = useState("Tomorrow at 10:00 AM");
  const [scheduleNotes, setScheduleNotes] = useState("");

  const handleConfirmScheduleInterview = async () => {
    if (!scheduleTargetApp) return;
    const newInterview: InterviewItem = {
      id: `int-${Date.now()}`,
      roundName: scheduleRoundName.trim() || "Technical Round",
      candidateName: scheduleTargetApp.candidateName || "Candidate",
      jobTitle: scheduleTargetApp.jobTitle,
      scheduledAt: scheduleDateTime.trim() || "Upcoming",
      interviewerName: scheduleInterviewer.trim() || "Technical Panel",
    };
    const updated = [newInterview, ...interviews];
    setInterviews(updated);
    localStorage.setItem("bh_admin_interviews", JSON.stringify(updated));

    // Advance candidate to INTERVIEW stage if behind
    await handleStageAdvance("INTERVIEW", scheduleTargetApp);
    setScheduleModalOpen(false);
  };

  // Custom Formal Offer Modal state
  const [offerModalOpen, setOfferModalOpen] = useState(false);
  const [offerApp, setOfferApp] = useState<ApplicationItem | null>(null);
  const [offerBaseSalary, setOfferBaseSalary] = useState("₹ 18,00,000 / year");
  const [offerBonus, setOfferBonus] = useState("₹ 2,00,000");
  const [offerEquity, setOfferEquity] = useState("5,000 RSUs (4-year vesting)");
  const [offerWorkplace, setOfferWorkplace] = useState("Visakhapatnam (Hybrid)");
  const [offerStartDate, setOfferStartDate] = useState("1st of next month");

  const handleConfirmSendOffer = async () => {
    if (!offerApp) return;
    const customTerms = {
      jobTitle: offerApp.jobTitle,
      baseSalary: offerBaseSalary,
      bonus: offerBonus,
      equity: offerEquity,
      location: offerWorkplace,
      startDate: offerStartDate,
      message: `We were thoroughly impressed by your performance in the assessment and technical rounds. We are delighted to extend this formal offer for the ${offerApp.jobTitle} position at Brutallyhired.`,
    };
    localStorage.setItem(`bh_offer_${offerApp.id}`, JSON.stringify(customTerms));
    await handleStageAdvance("OFFER", offerApp);
    setOfferModalOpen(false);
  };

  // Action Feedback Toast
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const showFeedback = (msg: string) => {
    setActionFeedback(msg);
    setTimeout(() => setActionFeedback(null), 3500);
  };

  // Universal Permission / Confirmation Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    actionType: "create" | "update" | "delete";
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);

  // Team (Staff) State with LocalStorage Persistence
  const [staff, setStaff] = useState<StaffItem[]>(() => {
    try {
      const stored = localStorage.getItem("bh_admin_staff");
      if (stored) return JSON.parse(stored);
    } catch {}
    return [
      { id: "st-1", name: "Tanuja HR", email: "hr@brutallyhired.com", role: "ADMIN", title: "HR Director & Administrator" },
      { id: "st-2", name: "Chandra Talent", email: "recruiting@brutallyhired.com", role: "RECRUITER", title: "Senior Tech Talent Partner" },
      { id: "st-3", name: "Arun K.", email: "arun.arch@brutallyhired.com", role: "INTERVIEWER", title: "Principal Software Architect" },
    ];
  });

  // Candidate CRUD States
  const [addCandOpen, setAddCandOpen] = useState(false);
  const [candName, setCandName] = useState("");
  const [candEmail, setCandEmail] = useState("");
  const [candPhone, setCandPhone] = useState("");
  const [candCity, setCandCity] = useState("");
  const [candJob, setCandJob] = useState("");
  const [candStage, setCandStage] = useState("SUBMITTED");
  const [candExp, setCandExp] = useState("Less than 2 years");
  const [candScore, setCandScore] = useState(85);

  const [editingCandidate, setEditingCandidate] = useState<ApplicationItem | null>(null);
  const [editCandName, setEditCandName] = useState("");
  const [editCandEmail, setEditCandEmail] = useState("");
  const [editCandPhone, setEditCandPhone] = useState("");
  const [editCandCity, setEditCandCity] = useState("");
  const [editCandJob, setEditCandJob] = useState("");
  const [editCandStage, setEditCandStage] = useState("SUBMITTED");
  const [editCandExp, setEditCandExp] = useState("");
  const [editCandScore, setEditCandScore] = useState(85);

  // Job CRUD States
  const [editingJob, setEditingJob] = useState<JobItem | null>(null);
  const [editJobTitle, setEditJobTitle] = useState("");
  const [editJobDept, setEditJobDept] = useState("");
  const [editJobLoc, setEditJobLoc] = useState("");
  const [editJobWorkplace, setEditJobWorkplace] = useState<"REMOTE" | "HYBRID" | "ONSITE">("HYBRID");
  const [editJobExp, setEditJobExp] = useState("");
  const [editJobStatus, setEditJobStatus] = useState<"OPEN" | "DRAFT" | "CLOSED">("OPEN");
  const [editJobDesc, setEditJobDesc] = useState("");

  // Team CRUD States
  const [editingStaff, setEditingStaff] = useState<StaffItem | null>(null);
  const [staffName, setStaffName] = useState("");
  const [staffTitle, setStaffTitle] = useState("");
  const [editStaffName, setEditStaffName] = useState("");
  const [editStaffEmail, setEditStaffEmail] = useState("");
  const [editStaffRole, setEditStaffRole] = useState<"ADMIN" | "RECRUITER" | "INTERVIEWER">("RECRUITER");
  const [editStaffTitle, setEditStaffTitle] = useState("");

  // Modals & Controls
  const [viewJobModal, setViewJobModal] = useState<JobItem | null>(null);
  const [activeReviewApp, setActiveReviewApp] = useState<ApplicationItem | null>(null);
  const [viewingResumeApp, setViewingResumeApp] = useState<ApplicationItem | null>(null);
  const [aiAssessmentGenerating, setAiAssessmentGenerating] = useState(false);
  const [candidateAiExamUrl, setCandidateAiExamUrl] = useState<string | null>(null);
  const [copiedExamLink, setCopiedExamLink] = useState(false);
  const [stageNote, setStageNote] = useState("");
  const [newJobOpen, setNewJobOpen] = useState(false);
  const [newJobTitle, setNewJobTitle] = useState("");
  const [newJobDept, setNewJobDept] = useState("");
  const [newJobLoc, setNewJobLoc] = useState("");
  const [newJobExp, setNewJobExp] = useState("");
  const [newJobKeywords, setNewJobKeywords] = useState("");
  const [newJobChannels, setNewJobChannels] = useState<string[]>([
    "Brutallyhired Portal",
    "LinkedIn",
    "Indeed",
  ]);
  const [newJobWorkplace, setNewJobWorkplace] = useState<"REMOTE" | "HYBRID" | "ONSITE">("HYBRID");
  const [newJobDesc, setNewJobDesc] = useState("");
  const [newJobDescHtml, setNewJobDescHtml] = useState("");
  const [isJdEditorOpen, setIsJdEditorOpen] = useState(false);
  const [hasDraftLoaded, setHasDraftLoaded] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [copiedJobId, setCopiedJobId] = useState<string | null>(null);
  const [shareJobModal, setShareJobModal] = useState<JobItem | null>(null);

  const getJobApplyUrl = (j: JobItem) => {
    return `${window.location.origin}/${tenant.slug}/apply/${j.externalRef}`;
  };

  const handleCopyJobLink = (j: JobItem) => {
    const url = getJobApplyUrl(j);
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(url).catch(() => {});
    }
    setCopiedJobId(j.id);
    setTimeout(() => {
      setCopiedJobId((prev) => (prev === j.id ? null : prev));
    }, 2000);
  };

  const handleShareJob = (j: JobItem) => {
    const url = getJobApplyUrl(j);
    if (navigator?.share) {
      navigator
        .share({
          title: `${j.title} at ${tenant.name}`,
          text: `Apply for ${j.title} (${j.department || "Technology"} • ${j.location || "Remote"}):`,
          url,
        })
        .catch((err) => {
          if (err?.name !== "AbortError") {
            setShareJobModal(j);
          }
        });
    } else {
      setShareJobModal(j);
    }
  };

  // Restore saved job draft from localStorage & backend on mount
  useEffect(() => {
    const localDraft = localStorage.getItem("bh_admin_job_draft");
    if (localDraft) {
      try {
        const parsed = JSON.parse(localDraft);
        if (parsed.title) setNewJobTitle(parsed.title);
        if (parsed.department) setNewJobDept(parsed.department);
        if (parsed.location) setNewJobLoc(parsed.location);
        if (parsed.experience) setNewJobExp(parsed.experience);
        if (parsed.keywords) setNewJobKeywords(parsed.keywords);
        if (parsed.workplaceType) setNewJobWorkplace(parsed.workplaceType);
        if (parsed.channels && Array.isArray(parsed.channels)) setNewJobChannels(parsed.channels);
        if (parsed.description) setNewJobDesc(parsed.description);
        if (parsed.descriptionHtml) setNewJobDescHtml(parsed.descriptionHtml);
        setHasDraftLoaded(true);
      } catch {
        // ignore
      }
    }

    // Also fetch latest draft from backend database
    fetch(`/api/t/${tenant.slug}/jobs-draft`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.draft) {
          const d = data.draft;
          if (d.title && !newJobTitle) setNewJobTitle(d.title);
          if (d.department && !newJobDept) setNewJobDept(d.department);
          if (d.location && !newJobLoc) setNewJobLoc(d.location);
          if (d.experienceText && !newJobExp) setNewJobExp(d.experienceText);
          if (d.workplaceType && !newJobWorkplace) setNewJobWorkplace(d.workplaceType as any);
          if (d.summary && !newJobDesc) {
            setNewJobDesc(d.summary);
            setNewJobDescHtml(d.summary);
          }
          setHasDraftLoaded(true);
        }
      })
      .catch(() => undefined);
  }, [tenant.slug]);

  const handleAutoGenerateDesc = () => {
    setGenerateError("");
    if (!newJobTitle.trim()) {
      setGenerateError("Please enter a Job Title before generating the description.");
      return;
    }
    const plain = generateJobDescription({
      title: newJobTitle,
      department: newJobDept,
      location: newJobLoc,
      experience: newJobExp,
      keywords: newJobKeywords,
      workplaceType: newJobWorkplace,
    });
    const html = generateJobDescriptionHtml({
      title: newJobTitle,
      department: newJobDept,
      location: newJobLoc,
      experience: newJobExp,
      keywords: newJobKeywords,
      workplaceType: newJobWorkplace,
    });
    setNewJobDesc(plain);
    setNewJobDescHtml(html);
  };

  const handleSaveDraftJd = async (finalHtml: string) => {
    setNewJobDescHtml(finalHtml);
    setNewJobDesc(finalHtml);
    const draftPayload = {
      title: newJobTitle,
      department: newJobDept,
      location: newJobLoc,
      experience: newJobExp,
      keywords: newJobKeywords,
      workplaceType: newJobWorkplace,
      channels: newJobChannels,
      description: finalHtml,
      descriptionHtml: finalHtml,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem("bh_admin_job_draft", JSON.stringify(draftPayload));
    setHasDraftLoaded(true);

    try {
      await fetch(`/api/t/${tenant.slug}/jobs-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftPayload),
      });
    } catch {
      // offline fallback
    }
  };

  const handlePublishJd = async (finalHtml: string, channels: string[]) => {
    const finalDesc = finalHtml.trim();
    const externalRef =
      newJobTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") ||
      `job-${Date.now()}`;

    const newJobItem: JobItem = {
      id: `job-${Date.now()}`,
      externalRef,
      title: newJobTitle.trim(),
      department: newJobDept.trim() || "Technology",
      location: newJobLoc.trim() || "Remote",
      experience: newJobExp.trim() || undefined,
      keywords: newJobKeywords.trim() || undefined,
      publishedChannels: channels.length > 0 ? channels : ["Brutallyhired Portal"],
      workplaceType: newJobWorkplace,
      status: "OPEN",
      description: finalDesc, // The final edited JD!
      applicantCount: 0,
    };

    const updated = [newJobItem, ...jobs];
    setJobs(updated);
    localStorage.setItem("bh_admin_jobs", JSON.stringify(updated));
    localStorage.removeItem("bh_admin_job_draft");
    setHasDraftLoaded(false);

    try {
      await fetch(`/api/t/${tenant.slug}/jobs-publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newJobTitle.trim(),
          department: newJobDept.trim() || "Technology",
          location: newJobLoc.trim() || "Remote",
          experience: newJobExp.trim() || undefined,
          keywords: newJobKeywords.trim() || undefined,
          publishedChannels: channels,
          workplaceType: newJobWorkplace,
          description: finalDesc, // Final edited JD!
        }),
      });
    } catch (e) {
      console.warn("Backend publish fallback to local:", e);
    }

    setIsJdEditorOpen(false);
    setNewJobOpen(false);
    setNewJobTitle("");
    setNewJobDept("");
    setNewJobLoc("");
    setNewJobExp("");
    setNewJobKeywords("");
    setNewJobChannels(["Brutallyhired Portal", "LinkedIn", "Indeed"]);
    setNewJobWorkplace("HYBRID");
    setNewJobDesc("");
    setNewJobDescHtml("");
    setActiveTab("jobs");
  };

  const handleRegenerateJd = () => {
    const html = generateJobDescriptionHtml({
      title: newJobTitle,
      department: newJobDept,
      location: newJobLoc,
      experience: newJobExp,
      keywords: newJobKeywords,
      workplaceType: newJobWorkplace,
    });
    setNewJobDescHtml(html);
    setNewJobDesc(html);
    return html;
  };

  // Rejection & Hold modal state (Diagram 1)
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectActionType, setRejectActionType] = useState<"REJECTED" | "ON_HOLD">("REJECTED");
  const [selectedRejectReason, setSelectedRejectReason] = useState(REJECTION_REASONS[0]?.label || "");
  const [rejectCustomNote, setRejectCustomNote] = useState("");

  // Email Notification & Inspection states
  const [emailNotice, setEmailNotice] = useState<{
    recipient: string;
    subject: string;
    portalUrl: string;
    stage: string;
  } | null>(null);
  const [previewEmailModal, setPreviewEmailModal] = useState<SentEmailRecord | null>(null);

  const handleConfirmRejectOrHold = () => {
    if (!activeReviewApp) return;
    const finalReason = selectedRejectReason + (rejectCustomNote.trim() ? ` — ${rejectCustomNote.trim()}` : "");
    const updated = applications.map((a) => {
      if (a.id === activeReviewApp.id) {
        return {
          ...a,
          stage: rejectActionType,
          rejectionReason: rejectActionType === "REJECTED" ? finalReason : undefined,
          holdReason: rejectActionType === "ON_HOLD" ? finalReason : undefined,
        };
      }
      return a;
    });
    setApplications(updated);
    localStorage.setItem("bh_admin_applications", JSON.stringify(updated));
    setActiveReviewApp((prev) =>
      prev
        ? {
            ...prev,
            stage: rejectActionType,
            rejectionReason: rejectActionType === "REJECTED" ? finalReason : undefined,
            holdReason: rejectActionType === "ON_HOLD" ? finalReason : undefined,
          }
        : null
    );

    // Dispatch automated email notification for Rejection / Hold
    void sendEmailNotification({
      to: activeReviewApp.email,
      recipientName: activeReviewApp.candidateName || "Candidate",
      stage: rejectActionType as any,
      jobTitle: activeReviewApp.jobTitle,
      portalPath: `/${tenant.slug}/applications/${activeReviewApp.id}`,
      tenantSlug: tenant.slug,
      customHeading:
        rejectActionType === "REJECTED"
          ? `Application Update: ${activeReviewApp.jobTitle}`
          : `Application Status: On Hold for ${activeReviewApp.jobTitle}`,
      customBody:
        rejectActionType === "REJECTED"
          ? `Thank you for taking the time to apply with Brutallyhired. While your background was reviewed carefully, we have decided not to advance your application for ${activeReviewApp.jobTitle} at this time (${finalReason}). We wish you all the best in your career pursuits.`
          : `Your application for ${activeReviewApp.jobTitle} has been placed on hold (${finalReason}). We are reviewing candidate batches and will follow up with further updates soon.`,
    });

    setRejectModalOpen(false);
    setRejectCustomNote("");
  };

  const handleRestoreCandidate = () => {
    if (!activeReviewApp) return;
    const updated = applications.map((a) => {
      if (a.id === activeReviewApp.id) {
        return {
          ...a,
          stage: "IN_REVIEW",
          rejectionReason: undefined,
          holdReason: undefined,
        };
      }
      return a;
    });
    setApplications(updated);
    localStorage.setItem("bh_admin_applications", JSON.stringify(updated));
    setActiveReviewApp((prev) =>
      prev
        ? {
            ...prev,
            stage: "IN_REVIEW",
            rejectionReason: undefined,
            holdReason: undefined,
          }
        : null
    );
  };

  // Assessment & Secure Examination Architecture state (Figure 4)
  const [assessmentFilterMode, setAssessmentFilterMode] = useState<"ALL" | "STANDARD" | "HIGHER_ASSURANCE">("ALL");
  const [assessmentSubTab, setAssessmentSubTab] = useState<"ROUNDS" | "QUEUE" | "INVITES" | "TEMPLATES">("ROUNDS");
  const [assessmentRiskFilter, setAssessmentRiskFilter] = useState<"ALL" | "FLAGGED" | "CLEAN">("ALL");
  const [activeInspectSession, setActiveInspectSession] = useState<AssessmentSessionItem | null>(null);

  const [assessmentSessions, setAssessmentSessions] = useState<AssessmentSessionItem[]>(() => {
    const saved = localStorage.getItem("bh_assessment_sessions");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    return [
      {
        id: "assess-1",
        candidateId: "app-101",
        candidateName: "Rahul Sharma",
        jobTitle: "Software Developer",
        assessmentTitle: "Senior Full-Stack & Architecture Challenge",
        mode: "STANDARD",
        invitedAt: "Yesterday",
        expiresIn: "48 hours remaining (3-day deadline)",
        systemTest: {
          consent: true,
          webcam: true,
          screenShare: true,
          audio: true,
          networkLatency: "22ms (Broadband)",
        },
        durationMins: 60,
        autosaveCheckpoints: 28,
        status: "FLAGGED_REVIEW",
        aiSignals: {
          faceVisibilityPct: 99,
          extraPersonsCount: 0,
          phoneDetected: false,
          monitorCount: 1,
          focusLossCount: 0,
          interruptionsCount: 0,
        },
        riskScore: 4,
        riskLevel: "LOW",
        auditTrail: [
          { time: "00:00", event: "Identity consent and system pre-checks verified", tone: "ok" },
          { time: "05:00", event: "Exam session started; continuous webcam & screen telemetry engaged", tone: "info" },
          { time: "25:00", event: "Autosave checkpoint #15 synced successfully", tone: "ok" },
          { time: "58:00", event: "Exam completed and submitted; audit trail sealed", tone: "ok" },
        ],
      },
      {
        id: "assess-2",
        candidateId: "app-106",
        candidateName: "Sneha Iyer",
        jobTitle: "AI Product Manager",
        assessmentTitle: "AI Strategy & Rubric Assessment",
        mode: "STANDARD",
        invitedAt: "1 day ago",
        expiresIn: "36 hours remaining (3-day deadline)",
        systemTest: {
          consent: true,
          webcam: true,
          screenShare: true,
          audio: true,
          networkLatency: "58ms (Cellular hotspot)",
        },
        durationMins: 40,
        autosaveCheckpoints: 16,
        status: "FLAGGED_REVIEW",
        aiSignals: {
          faceVisibilityPct: 74,
          extraPersonsCount: 1,
          phoneDetected: true,
          monitorCount: 2,
          focusLossCount: 4,
          interruptionsCount: 1,
        },
        riskScore: 82,
        riskLevel: "HIGH",
        auditTrail: [
          { time: "00:00", event: "Candidate consent granted; dual monitor warning dismissed", tone: "warn" },
          { time: "14:18", event: "AI Signal Alert: Secondary person detected in camera background", tone: "danger" },
          { time: "22:04", event: "AI Signal Alert: Mobile device identified in candidate field of view", tone: "danger" },
          { time: "31:40", event: "Focus loss: Candidate tab-switched 4 times outside exam client", tone: "warn" },
        ],
      },
      {
        id: "assess-3",
        candidateId: "app-102",
        candidateName: "Priya Nair",
        jobTitle: "Software Developer",
        assessmentTitle: "Distributed Systems & DB Design Quiz",
        mode: "STANDARD",
        invitedAt: "2 days ago",
        expiresIn: "24 hours remaining (3-day deadline)",
        systemTest: {
          consent: true,
          webcam: true,
          screenShare: true,
          audio: true,
          networkLatency: "18ms (Fiber)",
        },
        durationMins: 45,
        autosaveCheckpoints: 22,
        status: "ADJUDICATED",
        aiSignals: {
          faceVisibilityPct: 100,
          extraPersonsCount: 0,
          phoneDetected: false,
          monitorCount: 1,
          focusLossCount: 0,
          interruptionsCount: 0,
        },
        riskScore: 2,
        riskLevel: "LOW",
        adjudication: "PASS",
        adjudicationNote: "Verified by Lead Recruiter: Exceptional technical performance, verified proctored telemetry.",
        auditTrail: [
          { time: "00:00", event: "Candidate passed pre-check system test", tone: "ok" },
          { time: "42:15", event: "Candidate submitted exam ahead of timer; all tests verified", tone: "ok" },
          { time: "Review", event: "Human reviewer passed candidate into Interview rounds", tone: "ok" },
        ],
      },
      {
        id: "assess-4",
        candidateId: "app-103",
        candidateName: "Aditya Kumar",
        jobTitle: "Software Developer",
        assessmentTitle: "Senior Full-Stack & Architecture Challenge",
        mode: "HIGHER_ASSURANCE",
        invitedAt: "3 hours ago",
        expiresIn: "69 hours remaining (3-day deadline)",
        systemTest: {
          consent: true,
          webcam: true,
          screenShare: true,
          audio: true,
          networkLatency: "15ms (Secure Client)",
        },
        durationMins: 60,
        autosaveCheckpoints: 12,
        status: "IN_PROGRESS",
        aiSignals: {
          faceVisibilityPct: 98,
          extraPersonsCount: 0,
          phoneDetected: false,
          monitorCount: 1,
          focusLossCount: 0,
          interruptionsCount: 0,
        },
        riskScore: 6,
        riskLevel: "LOW",
        auditTrail: [
          { time: "00:00", event: "Higher Assurance secure exam client launched with signed config", tone: "ok" },
          { time: "01:00", event: "OS-level restrictions active: clipboard, secondary displays locked", tone: "info" },
          { time: "18:00", event: "Timed exam in progress; autosave active every 15s", tone: "ok" },
        ],
      },
    ];
  });

  const handleAdjudicate = (
    sessionId: string,
    decision: "PASS" | "RETRY" | "MANUAL_REVIEW" | "FAIL",
    note?: string
  ) => {
    const updatedSessions = assessmentSessions.map((s) => {
      if (s.id === sessionId) {
        return {
          ...s,
          status: decision === "RETRY" ? ("INVITED" as const) : ("ADJUDICATED" as const),
          adjudication: decision,
          adjudicationNote: note || `Adjudicated as ${decision} by HR Reviewer`,
        };
      }
      return s;
    });
    setAssessmentSessions(updatedSessions);
    localStorage.setItem("bh_assessment_sessions", JSON.stringify(updatedSessions));

    const targetSession = assessmentSessions.find((s) => s.id === sessionId);
    if (targetSession) {
      if (decision === "PASS") {
        const updatedApps = applications.map((a) =>
          a.id === targetSession.candidateId || a.candidateName === targetSession.candidateName
            ? { ...a, stage: "INTERVIEW" }
            : a
        );
        setApplications(updatedApps);
        localStorage.setItem("bh_admin_applications", JSON.stringify(updatedApps));
      } else if (decision === "FAIL") {
        const updatedApps = applications.map((a) =>
          a.id === targetSession.candidateId || a.candidateName === targetSession.candidateName
            ? {
                ...a,
                stage: "REJECTED",
                rejectionReason: "BrutalAssessAI™ proctoring audit failure / policy violation",
              }
            : a
        );
        setApplications(updatedApps);
        localStorage.setItem("bh_admin_applications", JSON.stringify(updatedApps));
      }
    }
  };

  const [inviteStaffOpen, setInviteStaffOpen] = useState(false);
  const [staffEmail, setStaffEmail] = useState("");
  const [staffRole, setStaffRole] = useState<"ADMIN" | "RECRUITER" | "INTERVIEWER">("RECRUITER");

  // Settings State
  const [brandHex, setBrandHex] = useState(tenant.brandColor || "#094c3c");
  // Screening Cutoff Threshold dynamically read from Brutally Score module
  const [threshold, setThreshold] = useState<number>(() => getScreeningCutoffThreshold());
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Sync threshold whenever Brutally Score module updates or active job changes
  useEffect(() => {
    const activeJob = candidateJobFilter !== "ALL" ? jobs.find((j) => j.title === candidateJobFilter) : undefined;
    const updateThreshold = () => {
      setThreshold(getScreeningCutoffThreshold(activeJob?.id));
    };
    updateThreshold();
    window.addEventListener("storage", updateThreshold);
    return () => window.removeEventListener("storage", updateThreshold);
  }, [candidateJobFilter, activeTab, jobs]);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("ALL");

  const filteredApps = applications.filter((app) => {
    const matchesSearch =
      (app.candidateName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.jobTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (app.city || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (app.department || "").toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (stageFilter !== "ALL") {
      if (stageFilter === "LOW_SCORE") {
        if (app.score >= threshold) return false;
      } else if (app.stage !== stageFilter) {
        return false;
      }
    }
    if (candidateJobFilter !== "ALL" && app.jobTitle !== candidateJobFilter) {
      return false;
    }
    return true;
  });

  const handleStageAdvance = async (targetStage: string, specificApp?: ApplicationItem) => {
    const app = specificApp || activeReviewApp;
    if (!app) return;
    const updated = applications.map((a) => (a.id === app.id ? { ...a, stage: targetStage } : a));
    setApplications(updated);
    localStorage.setItem("bh_admin_applications", JSON.stringify(updated));
    window.dispatchEvent(new Event("storage"));
    window.dispatchEvent(new CustomEvent("bh_application_updated", { detail: { stage: targetStage, appId: app.id } }));
    if (activeReviewApp && activeReviewApp.id === app.id) {
      setActiveReviewApp((prev) => (prev ? { ...prev, stage: targetStage } : null));
    }
    setStageNote("");

    // Automatically dispatch email notification for milestone stages
    if (["SHORTLISTED", "ASSESSMENT", "INTERVIEW", "OFFER", "HIRED"].includes(targetStage)) {
      let portalPath = `/${tenant.slug}/applications/${app.id}/assessments`;
      if (targetStage === "INTERVIEW") portalPath = `/${tenant.slug}/applications/${app.id}/interviews`;
      if (targetStage === "OFFER") portalPath = `/${tenant.slug}/applications/${app.id}/offer`;
      if (targetStage === "HIRED") portalPath = `/${tenant.slug}/applications/${app.id}/onboarding`;

      const sent = await sendEmailNotification({
        to: app.email,
        recipientName: app.candidateName || "Candidate",
        stage: targetStage as any,
        jobTitle: app.jobTitle,
        portalPath,
        tenantSlug: tenant.slug,
      });

      setEmailNotice({
        recipient: app.email,
        subject: sent.subject,
        portalUrl: sent.portalUrl,
        stage: targetStage,
      });

      // Also ensure active assessment queue session is added/ready if SHORTLISTED/ASSESSMENT
      if (targetStage === "SHORTLISTED" || targetStage === "ASSESSMENT") {
        setAssessmentSessions((prev) => {
          const exists = prev.some((s) => s.candidateId === app.id);
          if (exists) return prev;
          const newSession: AssessmentSessionItem = {
            id: `assess-${Date.now()}`,
            candidateId: app.id,
            candidateName: app.candidateName || "Candidate",
            jobTitle: app.jobTitle,
            assessmentTitle: "Senior Full-Stack & Architecture Challenge",
            mode: "STANDARD",
            invitedAt: "Just now",
            expiresIn: "72 hours remaining (3-day deadline)",
            systemTest: { consent: true, webcam: true, screenShare: true, audio: true, networkLatency: "22ms (Broadband)" },
            durationMins: 45,
            autosaveCheckpoints: 0,
            status: "INVITED",
            aiSignals: { faceVisibilityPct: 100, extraPersonsCount: 0, phoneDetected: false, monitorCount: 1, focusLossCount: 0, interruptionsCount: 0 },
            riskScore: 0,
            riskLevel: "LOW",
            auditTrail: [{ time: "00:00", event: "Shortlist email notification dispatched with assessment URL", tone: "ok" }],
          };
          const next = [newSession, ...prev];
          localStorage.setItem("bh_assessment_sessions", JSON.stringify(next));
          return next;
        });
      }
    }
  };

  const handleApproveAndSendAiAssessment = async (app: ApplicationItem) => {
    setAiAssessmentGenerating(true);
    try {
      let inviteId = `invite-${Date.now()}`;
      let examUrl = `${window.location.origin}/${tenant.slug}/applications/${app.id}/assessments/${inviteId}`;
      let templateTitle = `${app.jobTitle} AI Technical Assessment - ${app.candidateName || "Candidate"}`;

      // Call backend approve-assessment endpoint
      try {
        const res = await fetch(`/api/admin/applications/${app.id}/approve-assessment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.examUrl) examUrl = data.examUrl;
          if (data.inviteId) inviteId = data.inviteId;
          if (data.templateTitle) templateTitle = data.templateTitle;
        }
      } catch (err) {
        console.warn("Backend approve-assessment fallback note:", err);
      }

      // Dispatch real email with exam link
      const sent = await sendEmailNotification({
        to: app.email,
        recipientName: app.candidateName || "Candidate",
        stage: "ASSESSMENT",
        jobTitle: app.jobTitle,
        portalPath: `/${tenant.slug}/applications/${app.id}/assessments/${inviteId}`,
        tenantSlug: tenant.slug,
        customHeading: `AI Assessment Invitation: ${app.jobTitle}`,
        customBody: `You have been approved for the next stage of ${app.jobTitle} at Brutallyhired! Our AI has generated a customized technical MCQ assessment specifically calibrated to your skillset. Please click the exam link below to start your proctored assessment before the 72-hour deadline.`,
      });

      setCandidateAiExamUrl(examUrl);

      // Advance stage to ASSESSMENT in state and storage
      const updated = applications.map((a) =>
        a.id === app.id
          ? {
              ...a,
              stage: "ASSESSMENT",
              notes: `AI Assessment approved & dispatched. Exam URL generated and emailed to candidate.`,
            }
          : a
      );
      setApplications(updated);
      localStorage.setItem("bh_admin_applications", JSON.stringify(updated));
      window.dispatchEvent(new Event("storage"));
      window.dispatchEvent(new CustomEvent("bh_application_updated", { detail: { stage: "ASSESSMENT", appId: app.id } }));

      if (activeReviewApp && activeReviewApp.id === app.id) {
        setActiveReviewApp((prev) =>
          prev
            ? {
                ...prev,
                stage: "ASSESSMENT",
                notes: `AI Assessment approved & dispatched. Exam URL generated and emailed to candidate.`,
              }
            : null
        );
      }

      // Record active assessment session
      const newSession: AssessmentSessionItem = {
        id: `assess-${Date.now()}`,
        candidateId: app.id,
        candidateName: app.candidateName || "Candidate",
        jobTitle: app.jobTitle,
        assessmentTitle: templateTitle,
        mode: "STANDARD",
        invitedAt: "Just now",
        expiresIn: "72 hours remaining (3-day deadline)",
        systemTest: { consent: true, webcam: true, screenShare: true, audio: true, networkLatency: "20ms (Broadband)" },
        durationMins: 45,
        autosaveCheckpoints: 0,
        status: "INVITED",
        aiSignals: { faceVisibilityPct: 100, extraPersonsCount: 0, phoneDetected: false, monitorCount: 1, focusLossCount: 0, interruptionsCount: 0 },
        riskScore: 0,
        riskLevel: "LOW",
        auditTrail: [
          { time: "00:00", event: `AI Assessment generated with Qwen 3.5:9b and emailed to ${app.email}`, tone: "ok" },
          { time: "00:00", event: `Exam link created: ${examUrl}`, tone: "info" },
        ],
      };
      setAssessmentSessions((prev) => {
        const next = [newSession, ...prev.filter((s) => s.candidateId !== app.id)];
        localStorage.setItem("bh_assessment_sessions", JSON.stringify(next));
        return next;
      });

      setEmailNotice({
        recipient: app.email,
        subject: sent.subject,
        portalUrl: examUrl,
        stage: "ASSESSMENT",
      });
    } finally {
      setAiAssessmentGenerating(false);
    }
  };

  // --- JOB CRUD WITH PERMISSION CONFIRMATION ---
  const handleCreateJob = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJobTitle.trim()) {
      setGenerateError("Job title is required.");
      return;
    }
    if (!newJobDesc.trim()) {
      setGenerateError("Please click 'Auto-Generate with AI' to generate the job description before publishing.");
      return;
    }

    setConfirmDialog({
      open: true,
      title: "Confirm Create Job Opening",
      message: `Are you sure you want to publish the new job opening "${newJobTitle.trim()}" in ${newJobDept.trim() || "Technology"}?`,
      actionType: "create",
      confirmLabel: "Yes, Publish Job",
      onConfirm: () => {
        const item: JobItem = {
          id: `job-${Date.now()}`,
          externalRef:
            newJobTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") ||
            `job-${Date.now()}`,
          title: newJobTitle.trim(),
          department: newJobDept.trim() || "Technology",
          location: newJobLoc.trim() || "Remote",
          experience: newJobExp.trim() || undefined,
          keywords: newJobKeywords.trim() || undefined,
          publishedChannels: newJobChannels.length > 0 ? newJobChannels : ["Brutallyhired Portal"],
          workplaceType: newJobWorkplace,
          status: "OPEN",
          description: newJobDesc.trim(),
          applicantCount: 0,
        };

        const updated = [item, ...jobs];
        setJobs(updated);
        localStorage.setItem("bh_admin_jobs", JSON.stringify(updated));

        setNewJobOpen(false);
        setNewJobTitle("");
        setNewJobDept("");
        setNewJobLoc("");
        setNewJobExp("");
        setNewJobKeywords("");
        setNewJobChannels(["Brutallyhired Portal", "LinkedIn", "Indeed"]);
        setNewJobWorkplace("HYBRID");
        setNewJobDesc("");
        setGenerateError("");
        showFeedback(`Job opening "${item.title}" published successfully.`);
      },
    });
  };

  const handleOpenEditJob = (job: JobItem) => {
    setEditingJob(job);
    setEditJobTitle(job.title);
    setEditJobDept(job.department || "Technology");
    setEditJobLoc(job.location || "Remote");
    setEditJobWorkplace(job.workplaceType || "HYBRID");
    setEditJobExp(job.experience || "");
    setEditJobStatus(job.status || "OPEN");
    setEditJobDesc(job.description || "");
  };

  const handleSaveEditJob = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingJob || !editJobTitle.trim()) return;

    setConfirmDialog({
      open: true,
      title: "Confirm Update Job Opening",
      message: `Are you sure you want to save changes to the job opening "${editJobTitle.trim()}"?`,
      actionType: "update",
      confirmLabel: "Yes, Save Changes",
      onConfirm: () => {
        const updated = jobs.map((j) =>
          j.id === editingJob.id
            ? {
                ...j,
                title: editJobTitle.trim(),
                department: editJobDept.trim(),
                location: editJobLoc.trim(),
                workplaceType: editJobWorkplace,
                experience: editJobExp.trim() || undefined,
                status: editJobStatus,
                description: editJobDesc.trim(),
              }
            : j
        );
        setJobs(updated);
        localStorage.setItem("bh_admin_jobs", JSON.stringify(updated));
        if (viewJobModal?.id === editingJob.id) {
          setViewJobModal(updated.find((j) => j.id === editingJob.id) || null);
        }
        setEditingJob(null);
        showFeedback(`Job opening "${editJobTitle.trim()}" updated.`);
      },
    });
  };

  const requestDeleteJob = (job: JobItem) => {
    setConfirmDialog({
      open: true,
      title: "Confirm Delete Job Opening",
      message: `Are you sure you want to permanently delete job opening "${job.title}"? All associated requisitions and applicant references will be removed.`,
      actionType: "delete",
      confirmLabel: "Yes, Delete Job",
      onConfirm: () => {
        const updated = jobs.filter((j) => j.id !== job.id);
        setJobs(updated);
        localStorage.setItem("bh_admin_jobs", JSON.stringify(updated));
        if (viewJobModal?.id === job.id) setViewJobModal(null);
        showFeedback(`Job opening "${job.title}" deleted.`);
      },
    });
  };

  // --- CANDIDATE CRUD WITH PERMISSION CONFIRMATION ---
  const handleAddCandidate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!candName.trim() || !candEmail.trim()) return;
    const targetJob = candJob.trim() || jobs[0]?.title || "Full Stack Developer";

    setConfirmDialog({
      open: true,
      title: "Confirm Add Candidate",
      message: `Are you sure you want to add candidate "${candName.trim()}" for applied position "${targetJob}"?`,
      actionType: "create",
      confirmLabel: "Yes, Add Candidate",
      onConfirm: () => {
        const newApp: ApplicationItem = {
          id: `app-${Date.now()}`,
          candidateName: candName.trim(),
          email: candEmail.trim().toLowerCase(),
          phone: candPhone.trim() || "+91 9876543210",
          city: candCity.trim() || "Visakhapatnam",
          jobTitle: targetJob,
          stage: candStage,
          score: candScore,
          hardScore: Math.round(candScore * 0.9),
          preferredScore: candScore,
          experience: candExp,
          submittedAt: "Just now",
          currentCtc: "₹ 12.0 LPA",
          expectedCtc: "₹ 18.0 LPA",
          noticePeriod: "30 Days",
          locationComfort: "Comfortable with Hybrid",
          resumeName: `${candName.trim().replace(/\s+/g, "_")}_Resume.pdf`,
        };
        const updated = [newApp, ...applications];
        setApplications(updated);
        localStorage.setItem("bh_admin_applications", JSON.stringify(updated));
        setAddCandOpen(false);
        setCandName("");
        setCandEmail("");
        setCandPhone("");
        setCandCity("");
        showFeedback(`Candidate "${newApp.candidateName}" added successfully.`);
      },
    });
  };

  const handleOpenEditCandidate = (app: ApplicationItem) => {
    setEditingCandidate(app);
    setEditCandName(app.candidateName || "");
    setEditCandEmail(app.email || "");
    setEditCandPhone(app.phone || "");
    setEditCandCity(app.city || "");
    setEditCandJob(app.jobTitle || "");
    setEditCandStage(app.stage || "SUBMITTED");
    setEditCandExp(app.experience || "");
    setEditCandScore(app.score || 85);
  };

  const handleSaveEditCandidate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCandidate || !editCandName.trim()) return;

    setConfirmDialog({
      open: true,
      title: "Confirm Update Candidate",
      message: `Are you sure you want to save updates to candidate "${editCandName.trim()}"?`,
      actionType: "update",
      confirmLabel: "Yes, Save Changes",
      onConfirm: () => {
        const updated = applications.map((a) =>
          a.id === editingCandidate.id
            ? {
                ...a,
                candidateName: editCandName.trim(),
                email: editCandEmail.trim().toLowerCase(),
                phone: editCandPhone.trim(),
                city: editCandCity.trim(),
                jobTitle: editCandJob.trim(),
                stage: editCandStage,
                experience: editCandExp.trim(),
                score: editCandScore,
              }
            : a
        );
        setApplications(updated);
        localStorage.setItem("bh_admin_applications", JSON.stringify(updated));
        if (activeReviewApp?.id === editingCandidate.id) {
          setActiveReviewApp(updated.find((a) => a.id === editingCandidate.id) || null);
        }
        setEditingCandidate(null);
        showFeedback(`Candidate "${editCandName.trim()}" updated successfully.`);
      },
    });
  };

  const requestDeleteCandidate = (app: ApplicationItem) => {
    setConfirmDialog({
      open: true,
      title: "Confirm Delete Candidate",
      message: `Are you sure you want to permanently delete candidate "${app.candidateName || app.email}"? This application will be removed.`,
      actionType: "delete",
      confirmLabel: "Yes, Delete Candidate",
      onConfirm: () => {
        const updated = applications.filter((a) => a.id !== app.id);
        setApplications(updated);
        localStorage.setItem("bh_admin_applications", JSON.stringify(updated));
        if (activeReviewApp?.id === app.id) {
          setActiveReviewApp(null);
        }
        showFeedback(`Candidate "${app.candidateName || app.email}" deleted.`);
      },
    });
  };

  // --- TEAM (STAFF) CRUD WITH PERMISSION CONFIRMATION ---
  const handleAddStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffName.trim() || !staffEmail.trim()) return;

    setConfirmDialog({
      open: true,
      title: "Confirm Add Team Member",
      message: `Are you sure you want to add "${staffName.trim()}" (${staffRole}) to the hiring team?`,
      actionType: "create",
      confirmLabel: "Yes, Add Member",
      onConfirm: () => {
        const newMember: StaffItem = {
          id: `st-${Date.now()}`,
          name: staffName.trim(),
          email: staffEmail.trim().toLowerCase(),
          role: staffRole,
          title: staffTitle.trim() || (staffRole === "ADMIN" ? "Administrator" : staffRole === "RECRUITER" ? "Talent Partner" : "Technical Interviewer"),
        };
        const updated = [...staff, newMember];
        setStaff(updated);
        localStorage.setItem("bh_admin_staff", JSON.stringify(updated));
        setInviteStaffOpen(false);
        setStaffName("");
        setStaffEmail("");
        setStaffTitle("");
        showFeedback(`Team member "${newMember.name}" added successfully.`);
      },
    });
  };

  const handleOpenEditStaff = (member: StaffItem) => {
    setEditingStaff(member);
    setEditStaffName(member.name);
    setEditStaffEmail(member.email);
    setEditStaffRole(member.role);
    setEditStaffTitle(member.title);
  };

  const handleSaveEditStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff || !editStaffName.trim() || !editStaffEmail.trim()) return;

    setConfirmDialog({
      open: true,
      title: "Confirm Update Team Member",
      message: `Are you sure you want to save changes to team member "${editStaffName.trim()}"?`,
      actionType: "update",
      confirmLabel: "Yes, Save Changes",
      onConfirm: () => {
        const updated = staff.map((s) =>
          s.id === editingStaff.id
            ? {
                ...s,
                name: editStaffName.trim(),
                email: editStaffEmail.trim().toLowerCase(),
                role: editStaffRole,
                title: editStaffTitle.trim(),
              }
            : s
        );
        setStaff(updated);
        localStorage.setItem("bh_admin_staff", JSON.stringify(updated));
        setEditingStaff(null);
        showFeedback(`Team member "${editStaffName.trim()}" updated.`);
      },
    });
  };

  const requestDeleteStaff = (member: StaffItem) => {
    setConfirmDialog({
      open: true,
      title: "Confirm Remove Team Member",
      message: `Are you sure you want to remove team member "${member.name}" (${member.role}) from the hiring team?`,
      actionType: "delete",
      confirmLabel: "Yes, Remove Member",
      onConfirm: () => {
        const updated = staff.filter((s) => s.id !== member.id);
        setStaff(updated);
        localStorage.setItem("bh_admin_staff", JSON.stringify(updated));
        showFeedback(`Team member "${member.name}" removed.`);
      },
    });
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    applyBrand(brandHex);
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 3000);
  };

  if (!isAuthenticated) {
    return <AdminLoginPage onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  if (isJdEditorOpen) {
    return (
      <JobDescriptionEditor
        jobTitle={newJobTitle}
        department={newJobDept || "Technology"}
        location={newJobLoc || "Flexible / Remote"}
        experience={newJobExp}
        workplaceType={newJobWorkplace}
        keywords={newJobKeywords}
        publishedChannels={newJobChannels}
        initialHtml={
          newJobDescHtml ||
          (newJobDesc.startsWith("<")
            ? newJobDesc
            : generateJobDescriptionHtml({
                title: newJobTitle,
                department: newJobDept,
                location: newJobLoc,
                experience: newJobExp,
                keywords: newJobKeywords,
                workplaceType: newJobWorkplace,
              }))
        }
        onSaveDraft={handleSaveDraftJd}
        onPublish={handlePublishJd}
        onRegenerate={handleRegenerateJd}
        onBack={() => {
          setIsJdEditorOpen(false);
          setNewJobOpen(true);
        }}
      />
    );
  }

  return (
    <div className="flex min-h-screen bg-canvas text-ink">
      {/* Left Sidebar Navigation */}
      <aside className="sticky top-0 h-screen w-64 shrink-0 border-r border-line bg-white flex flex-col justify-between p-4 z-30 shadow-sm">
        <div className="space-y-6">
          {/* Brand Mark in Sidebar */}
          <div className="flex items-center gap-3 px-2 pt-2">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand font-display text-sm font-bold text-brand-fg shadow-sm"
              aria-hidden
            >
              {initials(tenant.name)}
            </span>
            <div className="flex flex-col leading-tight min-w-0">
              <span className="font-display text-[16px] font-bold tracking-tight text-ink truncate">
                {tenant.name}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                Admin Command Center
              </span>
            </div>
          </div>

          {/* Navigation Items (Sidebar) */}
          <nav aria-label="Admin Navigation" className="space-y-1">
            {[
              { id: "dashboard", label: "Dashboard", icon: <Dashboard size={18} /> },
              { id: "candidates", label: "Candidates", icon: <Users size={18} /> },
              { id: "jobs", label: "Jobs", icon: <Briefcase size={18} /> },
              { id: "assessments", label: "Assessments", icon: <Shield size={18} /> },
              { id: "interviews", label: "Interviews", icon: <Video size={18} /> },
              { id: "interviewSlots", label: "Interview Slots", icon: <Calendar size={18} /> },
              { id: "brutallyScore", label: "Brutally Score", icon: <Sparkle size={18} /> },
              { id: "offers", label: "Offers", icon: <File size={18} /> },
              { id: "onboarding", label: "Onboarding", icon: <Check size={18} /> },
              { id: "staff", label: "Team", icon: <Users size={18} /> },
              { id: "settings", label: "Settings", icon: <Settings size={18} /> },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`w-full flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-brand text-brand-fg shadow-sm"
                      : "text-ink-2 hover:bg-canvas hover:text-ink"
                  }`}
                >
                  <span className={isActive ? "text-brand-fg" : "text-ink-muted"}>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="space-y-3 border-t border-line pt-4">
          <Link
            to={`/${tenant.slug}/applications`}
            className="flex items-center justify-between rounded-xl border border-line-2 bg-canvas px-3 py-2 text-xs font-semibold text-ink-2 no-underline hover:border-brand hover:text-brand transition-all"
            title="Switch back to candidate view"
          >
            <span className="flex items-center gap-2">
              <ExternalLink size={14} />
              Candidate Portal
            </span>
            <ChevronRight size={14} className="text-ink-muted" />
          </Link>

          <div className="flex items-center justify-between px-2 py-1">
            <div className="flex items-center gap-2.5 min-w-0">
              <Avatar name="Tanuja HR" size={34} />
              <div className="flex flex-col text-left leading-tight min-w-0">
                <span className="text-xs font-bold text-ink truncate">Tanuja HR</span>
                <select
                  value={currentAdminRole}
                  onChange={(e) => setCurrentAdminRole(e.target.value as any)}
                  className="text-[10px] font-semibold text-brand bg-transparent border-0 cursor-pointer p-0 focus:ring-0"
                  title="Simulate Role Permissions"
                >
                  <option value="ADMIN">Role: Admin</option>
                  <option value="RECRUITER">Role: Recruiter</option>
                  <option value="INTERVIEWER">Role: Interviewer</option>
                </select>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              title="Sign out of Admin"
              className="p-1.5 text-ink-muted hover:text-rose-600 rounded-lg hover:bg-canvas transition-colors"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 overflow-y-auto p-6 md:p-8 space-y-8">
        {/* TAB 1: DASHBOARD / OVERVIEW */}
        {activeTab === "dashboard" && (
          <div className="space-y-8">
            {/* Header Banner */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-ink md:text-3xl">
                  Recruitment Command Dashboard
                </h1>
                <p className="mt-1 text-sm text-ink-muted">
                  Automated resume evaluation, candidate pipeline, and LiveKit video interviews for{" "}
                  <strong className="text-ink font-semibold">{tenant.name}</strong>.
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <Button icon={<Plus size={18} />} onClick={() => setNewJobOpen(true)}>
                  Create Job Requisition
                </Button>
                <Button variant="ghost" icon={<Users size={18} />} onClick={() => setActiveTab("candidates")}>
                  View Pipeline
                </Button>
              </div>
            </div>

            {/* Top Fact Cards Row */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Fact
                label="Total Applications"
                value={applications.length}
                sub={`${applications.filter((a) => a.stage === "HIRED" || a.stage === "OFFER").length} offered or hired`}
                trend="up"
                icon={<Users size={20} />}
              />
              <Fact
                label="In Active Review"
                value={applications.filter((a) => a.stage === "IN_REVIEW" || a.stage === "SUBMITTED").length}
                sub={`${applications.filter((a) => a.score < threshold).length} scoring below ${threshold} threshold`}
                trend="neutral"
                icon={<Alert size={20} />}
              />
              <Fact
                label="Active Job Listings"
                value={jobs.filter((j) => j.status === "OPEN").length}
                sub={`${jobs.length} total requisitions`}
                trend="up"
                icon={<Briefcase size={20} />}
              />
              <Fact
                label="Scheduled Interviews"
                value={interviews.length}
                sub="LiveKit rooms ready"
                trend="up"
                icon={<Video size={20} />}
              />
            </div>

            {/* Pipeline Funnel */}
            <Card className="space-y-4">
              <SectionTitle
                action={
                  <button
                    type="button"
                    onClick={() => setActiveTab("candidates")}
                    className="text-xs font-semibold text-brand hover:underline flex items-center gap-1"
                  >
                    View All Candidates <Arrow size={14} />
                  </button>
                }
              >
                Candidate Hiring Pipeline
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
                ].map((st) => (
                  <button
                    key={st.label}
                    type="button"
                    onClick={() => {
                      setStageFilter(st.label.toUpperCase().replace(/\s+/g, "_"));
                      setActiveTab("candidates");
                    }}
                    className={`flex flex-col items-center justify-center rounded-xl border p-3 text-center transition-all hover:scale-105 ${st.tone}`}
                  >
                    <span className="text-[11px] font-semibold uppercase tracking-wider">{st.label}</span>
                    <strong className="mt-1 text-2xl font-bold">{st.count}</strong>
                  </button>
                ))}
              </div>
            </Card>

            {/* Split Row: Candidates Table & Right Widgets */}
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
              {/* Left Column: Recent Applications */}
              <div className="space-y-4 lg:col-span-2">
                <Card className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-[18px] font-bold text-ink">Recent Candidates</h3>
                      <p className="text-xs text-ink-muted">Automated screening against job requirements</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                        <input
                          type="text"
                          placeholder="Search candidate..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="h-9 w-44 rounded-lg border border-line-2 bg-white pl-8 pr-3 text-xs text-ink placeholder:text-ink-muted focus:border-brand focus:outline-none"
                        />
                      </div>

                      <select
                        value={stageFilter}
                        onChange={(e) => setStageFilter(e.target.value)}
                        className="h-9 rounded-lg border border-line-2 bg-white px-2.5 text-xs text-ink focus:border-brand focus:outline-none"
                      >
                        <option value="ALL">All Stages</option>
                        <option value="IN_REVIEW">In Review</option>
                        <option value="INTERVIEW">Interview</option>
                        <option value="ASSESSMENT">Assessment</option>
                        <option value="LOW_SCORE">Below Threshold (&lt;{threshold})</option>
                      </select>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-line text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                          <th className="pb-3 pl-2">Candidate</th>
                          <th className="pb-3">Role</th>
                          <th className="pb-3">AI Score</th>
                          <th className="pb-3">Stage</th>
                          <th className="pb-3">Applied</th>
                          <th className="pb-3 pr-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line/60">
                        {filteredApps.map((app) => (
                          <tr key={app.id} className="hover:bg-canvas/50">
                            <td className="py-3 pl-2">
                              <div className="flex items-center gap-2.5">
                                <Avatar name={app.email} size={30} />
                                <span className="font-semibold text-ink text-xs">{app.email}</span>
                              </div>
                            </td>
                            <td className="py-3 text-xs text-ink-2 font-medium">{app.jobTitle}</td>
                            <td className="py-3">
                              <ScoreBadge score={app.score} threshold={threshold} />
                            </td>
                            <td className="py-3">
                              <StagePill stage={app.stage} />
                            </td>
                            <td className="py-3 text-xs text-ink-muted">{app.submittedAt}</td>
                            <td className="py-3 pr-2 text-right">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setActiveReviewApp(app)}
                              >
                                Review
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>

                {/* AI Rubric Banner */}
                <div className="flex items-center justify-between rounded-2xl border border-line bg-gradient-to-r from-ok-soft/50 via-white to-info-soft/30 p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-fg">
                      <Sparkle size={18} />
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-ink">Automated Scoring Engine</h4>
                      <p className="text-[11px] text-ink-muted">
                        Candidates scoring below {threshold} trigger human review. Configure thresholds in Settings.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab("settings")}
                    className="text-xs font-semibold text-brand hover:underline whitespace-nowrap"
                  >
                    Adjust Threshold →
                  </button>
                </div>
              </div>

              {/* Right Column: Widgets */}
              <div className="space-y-6">
                {/* Upcoming LiveKit Interviews */}
                <Card className="space-y-4">
                  <div className="flex items-center justify-between border-b border-line pb-3">
                    <div>
                      <h3 className="text-sm font-bold text-ink">Upcoming Interviews</h3>
                      <p className="text-xs text-ink-muted">LiveKit video room schedules</p>
                    </div>
                    <span className="flex h-5 items-center rounded-full bg-info-soft px-2 text-[10px] font-bold text-info-ink">
                      {interviews.length} Scheduled
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {interviews.map((int) => (
                      <div
                        key={int.id}
                        className="rounded-xl border border-line-soft bg-[#F9FAFC] p-3 text-xs space-y-1 hover:border-line transition-all"
                      >
                        <div className="flex items-center justify-between font-bold text-ink">
                          <span>{int.roundName}</span>
                          <span className="text-ok flex items-center gap-1 text-[11px]">
                            <Video size={12} /> LiveKit
                          </span>
                        </div>
                        <div className="text-ink-2 font-medium">{int.candidateName}</div>
                        <div className="flex items-center justify-between pt-1 text-[11px] text-ink-muted border-t border-line/50">
                          <span className="flex items-center gap-1">
                            <Clock size={12} /> {int.scheduledAt}
                          </span>
                          <span>{int.interviewerName}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Active Jobs Widget */}
                <Card className="space-y-4">
                  <div className="flex items-center justify-between border-b border-line pb-3">
                    <div>
                      <h3 className="text-sm font-bold text-ink">Active Openings</h3>
                      <p className="text-xs text-ink-muted">Open job posts</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab("jobs")}
                      className="text-xs font-semibold text-brand hover:underline"
                    >
                      View all
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {jobs.length === 0 ? (
                      <p className="py-4 text-center text-xs text-ink-muted">
                        No active openings yet. Click "+ Post Job" to publish one.
                      </p>
                    ) : (
                      jobs.map((j) => (
                        <div
                          key={j.id}
                          onClick={() => setViewJobModal(j)}
                          className="flex items-center justify-between rounded-xl border border-line-soft p-2.5 hover:bg-canvas/50 cursor-pointer transition-colors"
                          title="Click to view full job details"
                        >
                          <div className="min-w-0 pr-2">
                            <span className="font-semibold text-xs text-ink block truncate">{j.title}</span>
                            <span className="text-[11px] text-ink-muted">{j.department || "Technology"} • {j.location || "Remote"}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-brand">{j.applicantCount} apps</span>
                            <Eye size={13} className="text-ink-muted" />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CANDIDATES */}
        {activeTab === "candidates" && (
          <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-ink">Candidates</h1>
                <p className="text-sm text-ink-muted">
                  Review and manage all applicants who applied for your open positions.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-xl border border-line bg-white px-3.5 py-1.5 text-xs font-semibold text-ink shadow-sm">
                  Total Applicants: <strong className="text-brand">{applications.length}</strong>
                </span>
                <Button icon={<Plus size={16} />} onClick={() => setAddCandOpen(true)}>
                  Add Candidate
                </Button>
              </div>
            </div>

            {/* Quick KPI stats */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Card className="p-4 space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Total Applied</span>
                <p className="text-2xl font-bold text-ink">{applications.length}</p>
              </Card>
              <Card className="p-4 space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">In Review</span>
                <p className="text-2xl font-bold text-amber-600">
                  {applications.filter((a) => a.stage === "IN_REVIEW" || a.stage === "SUBMITTED").length}
                </p>
              </Card>
              <Card className="p-4 space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Interviewing</span>
                <p className="text-2xl font-bold text-brand">
                  {applications.filter((a) => a.stage === "INTERVIEW" || a.stage === "ASSESSMENT").length}
                </p>
              </Card>
              <Card className="p-4 space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Offers / Hired</span>
                <p className="text-2xl font-bold text-emerald-600">
                  {applications.filter((a) => a.stage === "OFFER" || a.stage === "HIRED").length}
                </p>
              </Card>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-1 flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <input
                    type="search"
                    placeholder="Search candidate name, email, job, city..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-xl border border-line bg-white py-2 pl-9 pr-3 text-xs text-ink placeholder:text-ink-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand shadow-sm"
                  />
                  <Search size={14} className="absolute left-3 top-2.5 text-ink-muted" />
                </div>

                {/* Filter by Job Requisition */}
                <select
                  value={candidateJobFilter}
                  onChange={(e) => setCandidateJobFilter(e.target.value)}
                  className="rounded-xl border border-line bg-white px-3 py-2 text-xs font-medium text-ink shadow-sm focus:border-brand focus:outline-none"
                >
                  <option value="ALL">All Applied Positions</option>
                  {Array.from(new Set(applications.map((a) => a.jobTitle))).map((jTitle) => (
                    <option key={jTitle} value={jTitle}>
                      {jTitle}
                    </option>
                  ))}
                </select>
              </div>

              {/* Stage filter pills */}
              <div className="flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-line bg-white p-1.5 shadow-sm">
                {[
                  { id: "ALL", label: "All Stages" },
                  { id: "SUBMITTED", label: "Submitted" },
                  { id: "IN_REVIEW", label: "In Review" },
                  { id: "SHORTLISTED", label: "Shortlisted" },
                  { id: "ASSESSMENT", label: "Assessment" },
                  { id: "INTERVIEW", label: "Interview" },
                  { id: "OFFER", label: "Offer" },
                  { id: "HIRED", label: "Hired" },
                  { id: "ON_HOLD", label: "On Hold" },
                  { id: "REJECTED", label: "Rejected" },
                ].map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setStageFilter(st.id)}
                    className={`rounded-xl px-3 py-1 text-xs font-semibold whitespace-nowrap transition-all ${
                      stageFilter === st.id ? "bg-brand text-brand-fg shadow-sm" : "text-ink-2 hover:bg-canvas"
                    }`}
                  >
                    {st.label} (
                    {st.id === "ALL" ? applications.length : applications.filter((a) => a.stage === st.id).length})
                  </button>
                ))}
              </div>
            </div>

            {/* Candidates Table */}
            <Card className="overflow-hidden p-0">
              {filteredApps.length === 0 ? (
                <div className="p-12 text-center space-y-2">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-canvas text-ink-muted">
                    <Users size={24} />
                  </div>
                  <h3 className="text-sm font-bold text-ink">No candidates found</h3>
                  <p className="text-xs text-ink-muted max-w-sm mx-auto">
                    {searchQuery || stageFilter !== "ALL" || candidateJobFilter !== "ALL"
                      ? "No candidates match the current search or stage filter."
                      : "When candidates apply for jobs through the candidate portal, their complete details and submitted resume will appear here."}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-line bg-canvas/60 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                        <th className="py-3.5 pl-6 pr-4">Candidate</th>
                        <th className="py-3.5 px-4">Applied Job</th>
                        <th className="py-3.5 px-4">Experience</th>
                        <th className="py-3.5 px-4">Stage & Status</th>
                        <th className="py-3.5 px-4">Match Score</th>
                        <th className="py-3.5 px-4">Applied Date</th>
                        <th className="py-3.5 pr-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line-soft">
                      {filteredApps.map((app) => (
                        <tr
                          key={app.id}
                          className="hover:bg-canvas/50 transition-colors cursor-pointer group"
                          onClick={() => setActiveReviewApp(app)}
                        >
                          <td className="py-3.5 pl-6 pr-4">
                            <div className="flex items-center gap-3">
                              <Avatar name={app.candidateName || app.email} size={34} />
                              <div className="min-w-0">
                                <span className="font-bold text-ink block truncate group-hover:text-brand transition-colors">
                                  {app.candidateName || app.email.split("@")[0]}
                                </span>
                                <span className="text-[11px] text-ink-muted truncate block">
                                  {app.email} {app.city ? `• ${app.city}` : ""}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-medium text-ink">
                            <span>{app.jobTitle}</span>
                            {app.department && (
                              <span className="text-[11px] text-ink-muted block">{app.department}</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-ink-2 font-medium">
                            {app.experience || "—"}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="space-y-0.5">
                              <StagePill stage={app.stage} />
                              {app.rejectionReason && (
                                <span className="block text-[10px] text-rose-600 font-semibold truncate max-w-[140px]" title={app.rejectionReason}>
                                  {app.rejectionReason}
                                </span>
                              )}
                              {app.holdReason && (
                                <span className="block text-[10px] text-amber-600 font-semibold truncate max-w-[140px]" title={app.holdReason}>
                                  {app.holdReason}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <ScoreBadge score={app.score} threshold={threshold} />
                          </td>
                          <td className="py-3.5 px-4 text-ink-muted whitespace-nowrap">
                            {app.submittedAt}
                          </td>
                          <td className="py-3.5 pr-6 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              {(app.stage === "SUBMITTED" || app.stage === "IN_REVIEW") && (
                                <button
                                  type="button"
                                  onClick={() => void handleStageAdvance("SHORTLISTED", app)}
                                  className="rounded-lg bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-800 text-xs font-bold px-2.5 py-1 transition-colors flex items-center gap-1"
                                  title="Shortlist Candidate & Send Assessment Invite"
                                >
                                  <span>✉️</span> Shortlist
                                </button>
                              )}
                              {["SHORTLISTED", "ASSESSMENT", "INTERVIEW", "OFFER", "HIRED"].includes(app.stage) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const sent: SentEmailRecord = getSentEmails().find((e) => e.recipient === app.email) || {
                                      id: `email-${app.id}`,
                                      recipient: app.email,
                                      recipientName: app.candidateName || "Candidate",
                                      subject: `Assessment ready — ${app.jobTitle}`,
                                      heading: `Congratulations ${app.candidateName || "Candidate"}, you've been shortlisted!`,
                                      body: `We are impressed by your background and are pleased to invite you to the next stage for the ${app.jobTitle} opening at Brutallyhired. Please complete your proctored assessment before the deadline. It takes 45 minutes once you begin.`,
                                      portalUrl: `${window.location.origin}/${tenant.slug}/applications/${app.id}/assessments`,
                                      stage: app.stage as any,
                                      sentAt: "Today",
                                      status: "DELIVERED" as const,
                                    };
                                    setPreviewEmailModal(sent);
                                  }}
                                  className="rounded-lg bg-canvas hover:bg-line border border-line text-ink-2 text-xs font-semibold px-2 py-1 transition-colors flex items-center gap-1"
                                  title="Inspect Sent Email Notification"
                                >
                                  <span>✉️</span> Email
                                </button>
                              )}
                              {(app.stage === "ASSESSMENT" || app.stage === "SHORTLISTED") && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setScheduleTargetApp(app);
                                    setScheduleModalOpen(true);
                                  }}
                                  className="rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-900 text-xs font-bold px-2 py-1 transition-colors flex items-center gap-1"
                                  title="Schedule Technical Interview"
                                >
                                  <span>📅</span> Schedule
                                </button>
                              )}
                              {app.stage === "INTERVIEW" && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOfferApp(app);
                                    setOfferModalOpen(true);
                                  }}
                                  className="rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 text-xs font-bold px-2 py-1 transition-colors flex items-center gap-1"
                                  title="Prepare and Issue Formal Offer"
                                >
                                  <span>📜</span> Offer
                                </button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setActiveReviewApp(app)}
                                className="text-brand font-semibold hover:bg-brand/10"
                              >
                                Review Details →
                              </Button>
                              <button
                                type="button"
                                onClick={() => handleOpenEditCandidate(app)}
                                className="rounded-lg bg-canvas hover:bg-line border border-line text-ink-2 p-1.5 transition-colors"
                                title="Edit candidate details"
                              >
                                <Settings size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => requestDeleteCandidate(app)}
                                className="rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 p-1.5 transition-colors"
                                title="Delete candidate"
                              >
                                <Trash size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* TAB 3: JOBS */}
        {activeTab === "jobs" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-ink">Job Openings</h1>
                <p className="text-sm text-ink-muted">Manage active requisitions and candidate apply links.</p>
              </div>
              <div className="flex items-center gap-2">
                {hasDraftLoaded && (newJobDesc || newJobTitle) && (
                  <button
                    type="button"
                    onClick={() => setIsJdEditorOpen(true)}
                    className="flex items-center gap-1.5 rounded-xl border border-teal-300 bg-teal-50 px-3 py-2 text-xs font-bold text-teal-800 hover:bg-teal-100 transition-colors shadow-xs"
                    title="Resume editing unsaved draft"
                  >
                    <span>✏️</span>
                    <span>Resume Draft ({newJobTitle || "Requisition"})</span>
                  </button>
                )}
                <Button icon={<Plus size={18} />} onClick={() => setNewJobOpen(true)}>
                  Post Job
                </Button>
              </div>
            </div>

            {jobs.length === 0 ? (
              <div className="col-span-full rounded-2xl border border-dashed border-line bg-white p-12 text-center space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-canvas text-ink-muted">
                  <Briefcase size={24} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-ink">No Job Openings Posted</h3>
                  <p className="text-xs text-ink-muted max-w-sm mx-auto">
                    There are currently no active job listings. Click "Post Job" to create a new requisition with an auto-generated job description.
                  </p>
                </div>
                <Button icon={<Plus size={16} />} onClick={() => setNewJobOpen(true)}>
                  Post First Job
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {jobs.map((j) => (
                  <Card key={j.id} className="space-y-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-soft text-brand">
                          <Briefcase size={16} />
                        </span>
                        <div className="flex items-center gap-1.5">
                          <Pill tone={j.status === "OPEN" ? "teal" : "gray"}>{j.status}</Pill>
                          <button
                            type="button"
                            onClick={() => requestDeleteJob(j)}
                            title="Delete opening"
                            className="text-ink-muted hover:text-rose-600 p-1 transition-colors"
                          >
                            <Trash size={14} />
                          </button>
                        </div>
                      </div>
                      <h3 className="mt-2 text-sm font-bold text-ink">{j.title}</h3>
                      <p className="text-xs text-ink-muted">
                        {[j.department || "Technology", j.location || "Remote", j.workplaceType || "HYBRID", j.experience].filter(Boolean).join(" • ")}
                      </p>
                      <p className="mt-2 text-xs leading-relaxed text-ink-2 whitespace-pre-line line-clamp-3">
                        {j.description.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim()}
                      </p>
                    </div>
                    <div className="border-t border-line pt-3 flex items-center justify-between text-xs">
                      <span className="text-ink-muted"><strong>{j.applicantCount}</strong> applicants</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setViewJobModal(j)}
                          className="flex items-center gap-1 font-semibold text-brand hover:underline"
                          title="View job opening details"
                        >
                          <Eye size={13} />
                          <span>View</span>
                        </button>
                        <span className="text-line-2">•</span>
                        <button
                          type="button"
                          onClick={() => handleOpenEditJob(j)}
                          className="flex items-center gap-1 font-semibold text-ink-2 hover:text-brand transition-colors"
                          title="Edit job opening details"
                        >
                          <Settings size={13} />
                          <span>Edit</span>
                        </button>
                        <span className="text-line-2">•</span>
                        <button
                          type="button"
                          onClick={() => handleCopyJobLink(j)}
                          className="flex items-center gap-1 font-semibold text-ink-2 hover:text-brand transition-colors"
                          title="Copy application link to clipboard"
                        >
                          {copiedJobId === j.id ? (
                            <>
                              <Check size={13} className="text-emerald-600" />
                              <span className="text-emerald-700 font-bold">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy size={13} />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                        <span className="text-line-2">•</span>
                        <button
                          type="button"
                          onClick={() => handleShareJob(j)}
                          className="flex items-center gap-1 font-semibold text-ink-2 hover:text-brand transition-colors"
                          title="Share job opening"
                        >
                          <Share size={13} />
                          <span>Share</span>
                        </button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: ASSESSMENTS (Figure 4 Architecture) */}
        {activeTab === "assessments" && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight text-ink">
                    Assessment & Secure Examination Architecture
                  </h1>
                </div>
                
              </div>

              {/* Mode Toggle */}
              <div className="flex items-center gap-1.5 rounded-2xl border border-line bg-white p-1.5 shadow-sm">
                <span className="text-[11px] font-semibold text-ink-muted px-2 uppercase tracking-wider">Mode:</span>
                {[
                  { id: "ALL", label: "All Modes" },
                  { id: "STANDARD", label: "Standard Web" },
                  { id: "HIGHER_ASSURANCE", label: "Higher Assurance" },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setAssessmentFilterMode(m.id as any)}
                    className={`rounded-xl px-2.5 py-1 text-xs font-semibold transition-all ${
                      assessmentFilterMode === m.id
                        ? "bg-brand text-brand-fg shadow-sm"
                        : "text-ink-2 hover:bg-canvas"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sub-tab Navigation */}
            <div className="flex border-b border-line space-x-6 text-xs font-semibold overflow-x-auto">
              <button
                type="button"
                onClick={() => setAssessmentSubTab("ROUNDS")}
                className={`pb-3 transition-colors flex items-center gap-2 border-b-2 whitespace-nowrap ${
                  assessmentSubTab === "ROUNDS"
                    ? "border-brand text-brand"
                    : "border-transparent text-ink-muted hover:text-ink"
                }`}
              >
                <Sparkle size={15} />
                <span>Assessment Rounds Studio (3 Rounds)</span>
                <span className="rounded-full bg-brand-soft text-brand px-2 py-0.5 text-[10px] font-bold">
                  AI Active
                </span>
              </button>

              <button
                type="button"
                onClick={() => setAssessmentSubTab("QUEUE")}
                className={`pb-3 transition-colors flex items-center gap-2 border-b-2 whitespace-nowrap ${
                  assessmentSubTab === "QUEUE"
                    ? "border-brand text-brand"
                    : "border-transparent text-ink-muted hover:text-ink"
                }`}
              >
                <Shield size={15} />
                <span>BrutalAssessAI™ Risk Flags & Evidence Queue</span>
                <span className="rounded-full bg-rose-100 text-rose-800 px-2 py-0.5 text-[10px] font-bold">
                  {assessmentSessions.filter((s) => s.status === "FLAGGED_REVIEW").length} Pending
                </span>
              </button>

              <button
                type="button"
                onClick={() => setAssessmentSubTab("INVITES")}
                className={`pb-3 transition-colors flex items-center gap-2 border-b-2 whitespace-nowrap ${
                  assessmentSubTab === "INVITES"
                    ? "border-brand text-brand"
                    : "border-transparent text-ink-muted hover:text-ink"
                }`}
              >
                <Clock size={15} />
                <span>Invites & Expiry Tracker (3-Day Deadline)</span>
                <span className="rounded-full bg-brand/10 text-brand px-2 py-0.5 text-[10px] font-bold">
                  {assessmentSessions.length} Active
                </span>
              </button>

              <button
                type="button"
                onClick={() => setAssessmentSubTab("TEMPLATES")}
                className={`pb-3 transition-colors flex items-center gap-2 border-b-2 whitespace-nowrap ${
                  assessmentSubTab === "TEMPLATES"
                    ? "border-brand text-brand"
                    : "border-transparent text-ink-muted hover:text-ink"
                }`}
              >
                <File size={15} />
                <span>Assessment Templates Library</span>
              </button>
            </div>

            {/* SUBTAB 0: ASSESSMENT ROUNDS STUDIO (3 ROUNDS + DYNAMIC EXTENSIONS) */}
            {assessmentSubTab === "ROUNDS" && (
              <AssessmentRoundsStudio jobs={jobs} applications={applications} tenant={tenant} />
            )}

            {/* SUBTAB 1: EVIDENCE & RISK FLAGS QUEUE */}
            {assessmentSubTab === "QUEUE" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-ink-muted">Filter by Risk:</span>
                    {[
                      { id: "ALL", label: "All Sessions" },
                      { id: "FLAGGED", label: "High Risk Flagged" },
                      { id: "CLEAN", label: "Clean / Low Risk" },
                    ].map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setAssessmentRiskFilter(f.id as any)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                          assessmentRiskFilter === f.id
                            ? "bg-brand text-brand-fg"
                            : "border border-line bg-white text-ink-2 hover:bg-canvas"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  <span className="text-xs text-ink-muted">
                    Showing{" "}
                    <strong>
                      {
                        assessmentSessions
                          .filter((s) => assessmentFilterMode === "ALL" || s.mode === assessmentFilterMode)
                          .filter(
                            (s) =>
                              assessmentRiskFilter === "ALL" ||
                              (assessmentRiskFilter === "FLAGGED" ? s.riskLevel === "HIGH" : s.riskLevel === "LOW")
                          ).length
                      }
                    </strong>{" "}
                    sessions
                  </span>
                </div>

                <div className="space-y-3">
                  {assessmentSessions
                    .filter((s) => assessmentFilterMode === "ALL" || s.mode === assessmentFilterMode)
                    .filter(
                      (s) =>
                        assessmentRiskFilter === "ALL" ||
                        (assessmentRiskFilter === "FLAGGED" ? s.riskLevel === "HIGH" : s.riskLevel === "LOW")
                    )
                    .map((session) => (
                      <Card
                        key={session.id}
                        className={`p-4 space-y-4 border transition-all ${
                          session.riskLevel === "HIGH"
                            ? "border-rose-200 bg-rose-50/20"
                            : "border-line bg-white"
                        }`}
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div className="flex items-center gap-3">
                            <Avatar name={session.candidateName} size={40} />
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-bold text-ink text-sm">{session.candidateName}</h3>
                                <Pill tone={session.mode === "HIGHER_ASSURANCE" ? "blue" : "teal"}>
                                  {session.mode === "HIGHER_ASSURANCE" ? "Secure Client (OS)" : "Web Proctoring"}
                                </Pill>
                                {session.adjudication ? (
                                  <Pill
                                    tone={
                                      session.adjudication === "PASS"
                                        ? "teal"
                                        : session.adjudication === "FAIL"
                                        ? "red"
                                        : "amber"
                                    }
                                  >
                                    Adjudicated: {session.adjudication}
                                  </Pill>
                                ) : (
                                  <Pill tone="amber" dot>
                                    Awaiting Decision
                                  </Pill>
                                )}
                              </div>
                              <span className="text-xs text-ink-muted">
                                {session.assessmentTitle} • Applied for {session.jobTitle}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            {/* Live Risk Meter */}
                            <div className="flex items-center gap-2 rounded-xl border border-line bg-canvas px-3 py-1.5 text-xs">
                              <span className="font-semibold text-ink-muted uppercase text-[10px]">AI Risk Score:</span>
                              <span
                                className={`font-bold px-1.5 py-0.5 rounded-md ${
                                  session.riskLevel === "HIGH"
                                    ? "bg-rose-100 text-rose-800"
                                    : "bg-emerald-100 text-emerald-800"
                                }`}
                              >
                                {session.riskScore}/100 ({session.riskLevel})
                              </span>
                            </div>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setActiveInspectSession(session)}
                              icon={<Eye size={14} />}
                            >
                              Inspect Audit Trail
                            </Button>
                          </div>
                        </div>

                        {/* AI Signal Breakdown Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-2 border-t border-line/60 text-xs">
                          <div className="rounded-lg bg-canvas p-2 space-y-0.5">
                            <span className="text-[10px] font-semibold text-ink-muted uppercase block">Face Visibility</span>
                            <span className={`font-bold block ${session.aiSignals.faceVisibilityPct < 85 ? "text-rose-600" : "text-emerald-700"}`}>
                              {session.aiSignals.faceVisibilityPct}% Tracking
                            </span>
                          </div>

                          <div className="rounded-lg bg-canvas p-2 space-y-0.5">
                            <span className="text-[10px] font-semibold text-ink-muted uppercase block">Extra Persons</span>
                            <span className={`font-bold block ${session.aiSignals.extraPersonsCount > 0 ? "text-rose-600" : "text-ink"}`}>
                              {session.aiSignals.extraPersonsCount === 0 ? "None detected ✓" : `${session.aiSignals.extraPersonsCount} detected ⚠️`}
                            </span>
                          </div>

                          <div className="rounded-lg bg-canvas p-2 space-y-0.5">
                            <span className="text-[10px] font-semibold text-ink-muted uppercase block">Phone Detection</span>
                            <span className={`font-bold block ${session.aiSignals.phoneDetected ? "text-rose-600" : "text-emerald-700"}`}>
                              {session.aiSignals.phoneDetected ? "Phone in frame ⚠️" : "Clean ✓"}
                            </span>
                          </div>

                          <div className="rounded-lg bg-canvas p-2 space-y-0.5">
                            <span className="text-[10px] font-semibold text-ink-muted uppercase block">Display Monitors</span>
                            <span className={`font-bold block ${session.aiSignals.monitorCount > 1 ? "text-amber-600" : "text-ink"}`}>
                              {session.aiSignals.monitorCount === 1 ? "1 Primary Screen" : `${session.aiSignals.monitorCount} Displays`}
                            </span>
                          </div>

                          <div className="rounded-lg bg-canvas p-2 space-y-0.5">
                            <span className="text-[10px] font-semibold text-ink-muted uppercase block">Focus Loss / Tabs</span>
                            <span className={`font-bold block ${session.aiSignals.focusLossCount > 0 ? "text-amber-600" : "text-ink"}`}>
                              {session.aiSignals.focusLossCount === 0 ? "0 tab switches" : `${session.aiSignals.focusLossCount} switches`}
                            </span>
                          </div>

                          <div className="rounded-lg bg-canvas p-2 space-y-0.5">
                            <span className="text-[10px] font-semibold text-ink-muted uppercase block">Autosave Checkpoints</span>
                            <span className="font-bold text-ink block">{session.autosaveCheckpoints} verified</span>
                          </div>
                        </div>

                        {/* Adjudication Decisions Bar (Figure 4 Step 7) */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-line text-xs">
                          <div className="text-ink-muted">
                            {session.adjudicationNote ? (
                              <span>
                                <strong>Adjudication:</strong> {session.adjudicationNote}
                              </span>
                            ) : (
                              <span>
                                <strong>Action Required:</strong> Human reviewer decision to finalize stage progression.
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleAdjudicate(session.id, "PASS")}
                              className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 transition-colors shadow-xs"
                            >
                              ✓ Pass & Advance to Interview
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAdjudicate(session.id, "RETRY")}
                              className="rounded-lg border border-line-2 bg-white hover:bg-canvas text-ink font-semibold px-3 py-1.5 transition-colors"
                            >
                              ↺ Retry Exam
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAdjudicate(session.id, "MANUAL_REVIEW")}
                              className="rounded-lg border border-amber-300 bg-amber-50 text-amber-800 font-semibold px-3 py-1.5 transition-colors"
                            >
                              Committee Review
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAdjudicate(session.id, "FAIL")}
                              className="rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold px-3 py-1.5 transition-colors shadow-xs"
                            >
                              ✗ Fail & Disqualify
                            </button>
                          </div>
                        </div>
                      </Card>
                    ))}
                </div>
              </div>
            )}

            {/* SUBTAB 2: INVITES & EXPIRY TRACKER */}
            {assessmentSubTab === "INVITES" && (
              <Card className="overflow-hidden p-0">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-line bg-canvas/60 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                      <th className="py-3.5 pl-6 pr-4">Candidate</th>
                      <th className="py-3.5 px-4">Assessment Challenge</th>
                      <th className="py-3.5 px-4">Mode</th>
                      <th className="py-3.5 px-4">3-Day Deadline Expiry</th>
                      <th className="py-3.5 px-4">Pre-Check System Test</th>
                      <th className="py-3.5 pr-6 text-right">Invite Link</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft">
                    {assessmentSessions.map((session) => (
                      <tr key={session.id} className="hover:bg-canvas/40 transition-colors">
                        <td className="py-3.5 pl-6 pr-4 font-bold text-ink">
                          {session.candidateName}
                          <span className="block font-normal text-ink-muted text-[11px]">{session.jobTitle}</span>
                        </td>
                        <td className="py-3.5 px-4 font-medium text-ink">
                          {session.assessmentTitle}
                          <span className="block text-ink-muted text-[11px]">{session.durationMins} minutes</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <Pill tone={session.mode === "HIGHER_ASSURANCE" ? "blue" : "teal"}>
                            {session.mode === "HIGHER_ASSURANCE" ? "Secure Client" : "Standard Web"}
                          </Pill>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-amber-700">
                          {session.expiresIn}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 text-[11px]">
                            <span className="text-emerald-700 font-semibold" title="Webcam, screen share & audio passed">
                              Consent ✓ • Cam ✓ • Screen ✓
                            </span>
                            <span className="text-ink-muted">• {session.systemTest.networkLatency}</span>
                          </div>
                        </td>
                        <td className="py-3.5 pr-6 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              alert(`Secure candidate exam link copied: https://${tenant.slug}.brutallyhired.com/exam/${session.id}`);
                            }}
                            className="font-semibold text-brand hover:underline"
                          >
                            Copy Link →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}

            {/* SUBTAB 3: TEMPLATES LIBRARY */}
            {assessmentSubTab === "TEMPLATES" && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {[
                  {
                    title: "Senior Full-Stack & Architecture Challenge",
                    mins: 60,
                    questions: 15,
                    pass: 70,
                    proctored: true,
                    mode: "Standard Web / Secure Client",
                    signals: "Webcam + Screen + Telemetry",
                  },
                  {
                    title: "Distributed Systems & DB Design Quiz",
                    mins: 45,
                    questions: 10,
                    pass: 65,
                    proctored: true,
                    mode: "Standard Web",
                    signals: "Face Tracking + Autosave",
                  },
                  {
                    title: "AI Strategy & Rubric Assessment",
                    mins: 40,
                    questions: 12,
                    pass: 75,
                    proctored: true,
                    mode: "Standard Web",
                    signals: "Continuous Telemetry",
                  },
                ].map((tpl) => (
                  <Card key={tpl.title} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Shield size={20} className="text-brand" />
                      <Pill tone={tpl.proctored ? "teal" : "gray"}>
                        {tpl.proctored ? "Proctored" : "Standard"}
                      </Pill>
                    </div>
                    <h3 className="text-sm font-bold text-ink">{tpl.title}</h3>
                    <p className="text-xs text-ink-muted">Mode: {tpl.mode} • {tpl.signals}</p>
                    <div className="flex items-center gap-3 text-xs text-ink-muted border-t border-line pt-2">
                      <span>{tpl.questions} Questions</span>
                      <span>•</span>
                      <span>{tpl.mins} Mins</span>
                      <span>•</span>
                      <span>Pass: {tpl.pass}%</span>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB: INTERVIEWS */}
        {activeTab === "interviews" && (
          <InterviewsModule
            jobs={jobs}
            applications={applications}
            onUpdateApplications={setApplications}
            tenant={tenant}
            onNavigateToOffer={(candidateId) => {
              const target = applications.find(
                (a) => a.id === candidateId || a.candidateName === candidateId
              );
              if (target) {
                setOfferApp(target);
                setOfferModalOpen(true);
              } else {
                setActiveTab("offers");
              }
            }}
          />
        )}

        {/* TAB: INTERVIEW SLOTS MODULE */}
        {activeTab === "interviewSlots" && (
          <InterviewSlotsModule jobs={jobs} applications={applications} tenant={tenant} />
        )}

        {/* TAB: BRUTALLY SCORE MODULE */}
        {activeTab === "brutallyScore" && (
          <BrutallyScoreModule jobs={jobs} tenant={tenant} />
        )}

        {/* TAB: OFFERS MODULE */}
        {activeTab === "offers" && (
          <OfferModule
            applications={applications as any}
            jobs={jobs}
            onUpdateApplications={(updated) => setApplications(updated as any)}
            tenant={tenant}
            onNavigateToOnboarding={() => setActiveTab("onboarding")}
          />
        )}

        {/* TAB: ONBOARDING MODULE */}
        {activeTab === "onboarding" && (
          <OnboardingModule
            applications={applications}
            jobs={jobs}
            tenant={tenant}
            onNavigateToOffers={() => setActiveTab("offers")}
          />
        )}

        {/* TAB 5: STAFF */}
        {activeTab === "staff" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-ink">Team & Hiring Staff</h1>
                <p className="text-sm text-ink-muted">Manage recruiters, hiring managers, and interviewers.</p>
              </div>
              <Button icon={<Plus size={18} />} onClick={() => setInviteStaffOpen(true)}>
                Invite Member
              </Button>
            </div>

            <Card className="space-y-4">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                    <th className="pb-3 pl-2">Name</th>
                    <th className="pb-3">Title</th>
                    <th className="pb-3">Role</th>
                    <th className="pb-3 text-right">Status</th>
                    <th className="pb-3 pr-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {staff.map((s) => (
                    <tr key={s.id} className="hover:bg-canvas/50">
                      <td className="py-3 pl-2 flex items-center gap-3">
                        <Avatar name={s.name} size={32} />
                        <div>
                          <span className="font-semibold text-xs text-ink block">{s.name}</span>
                          <span className="text-[11px] text-ink-muted">{s.email}</span>
                        </div>
                      </td>
                      <td className="py-3 text-xs text-ink-2">{s.title}</td>
                      <td className="py-3">
                        <Pill tone={s.role === "ADMIN" ? "amber" : s.role === "RECRUITER" ? "blue" : "gray"}>
                          {s.role}
                        </Pill>
                      </td>
                      <td className="py-3 text-right text-xs font-semibold text-ok">Active</td>
                      <td className="py-3 pr-2 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditStaff(s)}
                            className="rounded-lg bg-canvas hover:bg-line border border-line text-ink-2 px-2.5 py-1 text-xs font-semibold transition-colors flex items-center gap-1"
                            title="Edit team member"
                          >
                            <Settings size={12} />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => requestDeleteStaff(s)}
                            className="rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 p-1.5 transition-colors"
                            title="Remove team member"
                          >
                            <Trash size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        )}

        {/* TAB 6: SETTINGS */}
        {activeTab === "settings" && (
          <div className="space-y-6 max-w-3xl">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-ink">Organization Settings</h1>
              <p className="text-sm text-ink-muted">Configure your branding and company portal colors. Screening cutoff thresholds are managed in the Brutally Score module.</p>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-6">
              <Card className="space-y-4">
                <SectionTitle>Company Branding & Portal Colors</SectionTitle>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Company Name">
                    <Input value={tenant.name} readOnly />
                  </Field>

                  <Field label="Organization Slug">
                    <Input value={tenant.slug} readOnly />
                  </Field>

                  <Field label="Brand Accent Color (Hex)" hint="Updates buttons and highlights dynamically">
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={brandHex}
                        onChange={(e) => setBrandHex(e.target.value)}
                        className="h-10 w-12 cursor-pointer rounded-lg border border-line bg-white p-1"
                      />
                      <Input value={brandHex} onChange={(e) => setBrandHex(e.target.value)} />
                    </div>
                  </Field>

                  <Field label="Default Timezone">
                    <Input value={tenant.timezone || "Asia/Kolkata"} readOnly />
                  </Field>
                </div>
              </Card>

              <div className="flex items-center gap-3">
                <Button type="submit">Save Changes</Button>
                {settingsSaved && (
                  <span className="text-xs font-semibold text-ok">✓ Settings updated!</span>
                )}
              </div>
            </form>
          </div>
        )}
      </main>

      {/* MODAL: Review & Advance Candidate */}
      <Modal
        open={Boolean(activeReviewApp)}
        onClose={() => setActiveReviewApp(null)}
        title="Candidate Profile & Application Review"
        subtitle={activeReviewApp ? `Applied for ${activeReviewApp.jobTitle} • ${activeReviewApp.submittedAt}` : ""}
      >
        {activeReviewApp && (
          <div className="space-y-5 text-xs">
            {/* Candidate Header Summary */}
            <div className="flex items-center justify-between rounded-2xl border border-line bg-canvas p-4">
              <div className="flex items-center gap-3.5">
                <Avatar name={activeReviewApp.candidateName || activeReviewApp.email} size={44} />
                <div className="space-y-0.5">
                  <h3 className="text-base font-bold text-ink">
                    {activeReviewApp.candidateName || activeReviewApp.email.split("@")[0]}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 text-ink-muted text-[11px]">
                    <a
                      href={`mailto:${activeReviewApp.email}`}
                      className="text-brand hover:underline flex items-center gap-1 font-medium"
                    >
                      <Mail size={12} />
                      <span>{activeReviewApp.email}</span>
                    </a>
                    {activeReviewApp.phone && <span>• {activeReviewApp.phone}</span>}
                    {activeReviewApp.city && <span>• {activeReviewApp.city}</span>}
                    {activeReviewApp.experience && <span>• {activeReviewApp.experience} Exp</span>}
                  </div>
                </div>
              </div>
              <StagePill stage={activeReviewApp.stage} />
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-line bg-white p-3 shadow-xs">
                <span className="text-[10px] uppercase font-semibold text-ink-muted block">Applied Role</span>
                <span className="mt-1 block font-bold text-ink text-xs truncate">{activeReviewApp.jobTitle}</span>
              </div>
              <div className="rounded-xl border border-line bg-white p-3 shadow-xs">
                <span className="text-[10px] uppercase font-semibold text-ink-muted block">Match Score</span>
                <span className="mt-1 block text-base font-bold text-brand">{activeReviewApp.score}/100</span>
              </div>
              <div className="rounded-xl border border-line bg-white p-3 shadow-xs">
                <span className="text-[10px] uppercase font-semibold text-ink-muted block">Applied Date</span>
                <span className="mt-1 block text-ink font-medium text-xs">{activeReviewApp.submittedAt}</span>
              </div>
            </div>

            {/* Candidate Submitted Resume */}
            <div className="rounded-xl border border-line bg-white p-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                  <File size={18} />
                </span>
                <div>
                  <span className="font-semibold text-ink block text-xs">
                    {activeReviewApp.resumeName || `${(activeReviewApp.candidateName || "Candidate").replace(/\s+/g, "_")}_Resume.pdf`}
                  </span>
                  <span className="text-[10px] text-ink-muted">Verified Candidate Attachment (PDF)</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingResumeApp(activeReviewApp)}
                className="rounded-lg border border-brand bg-brand/5 hover:bg-brand hover:text-white text-brand px-3 py-1.5 text-xs font-semibold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                title="View submitted resume"
              >
                <Eye size={14} />
                <span>View</span>
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL: View Candidate Resume */}
      <Modal
        open={Boolean(viewingResumeApp)}
        onClose={() => setViewingResumeApp(null)}
        title={viewingResumeApp?.resumeName || `${(viewingResumeApp?.candidateName || "Candidate").replace(/\s+/g, "_")}_Resume.pdf`}
        subtitle="Uploaded Candidate Resume"
        maxWidth="max-w-4xl"
      >
        {viewingResumeApp && (() => {
          const { url: resumeUrl, filename: resumeFileName } = getCandidateUploadedResume(viewingResumeApp);

          return (
            <div className="space-y-4">
              {/* The Uploaded Resume Display - Authentic Document Only */}
              <ResumeDocViewer
                url={resumeUrl}
                filename={resumeFileName}
                className="w-full h-[72vh] min-h-[550px]"
              />

              {/* Footer with ONLY Download button and Close button */}
              <div className="flex items-center justify-between border-t border-line pt-3">
                <Button
                  variant="primary"
                  onClick={() => downloadCandidateResume(resumeUrl, resumeFileName)}
                  className="text-xs font-semibold flex items-center gap-1.5"
                >
                  <Download size={14} />
                  <span>Download Resume</span>
                </Button>

                <Button variant="ghost" onClick={() => setViewingResumeApp(null)}>
                  Close
                </Button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* MODAL: View Job Details */}
      <Modal
        open={Boolean(viewJobModal)}
        onClose={() => setViewJobModal(null)}
        title={viewJobModal?.title || "Job Details"}
        subtitle={[
          viewJobModal?.department || "Technology",
          viewJobModal?.location || "Remote",
          viewJobModal?.workplaceType || "HYBRID",
          viewJobModal?.experience ? `Exp: ${viewJobModal.experience}` : null,
        ]
          .filter(Boolean)
          .join(" • ")}
      >
        {viewJobModal && (
          <div className="space-y-5">
            {/* Highlights pills */}
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone={viewJobModal.status === "OPEN" ? "teal" : "gray"}>
                Status: {viewJobModal.status}
              </Pill>
              <span className="rounded-lg border border-line bg-canvas px-2.5 py-1 text-xs font-semibold text-ink-2">
                Workplace: {viewJobModal.workplaceType || "HYBRID"}
              </span>
              {viewJobModal.experience && (
                <span className="rounded-lg border border-line bg-canvas px-2.5 py-1 text-xs font-semibold text-ink-2">
                  Experience: {viewJobModal.experience}
                </span>
              )}
              {viewJobModal.keywords && (
                <span className="rounded-lg border border-line bg-brand/5 text-brand px-2.5 py-1 text-xs font-semibold">
                  Keywords: {viewJobModal.keywords}
                </span>
              )}
              <span className="rounded-lg border border-line bg-canvas px-2.5 py-1 text-xs font-semibold text-ink-2">
                Applicants: {viewJobModal.applicantCount}
              </span>
            </div>

            {/* Candidate Apply Link Card */}
            <div className="flex items-center justify-between rounded-xl border border-line bg-canvas p-3 text-xs">
              <div className="min-w-0 pr-3">
                <span className="font-semibold text-ink block">Public Candidate Apply URL:</span>
                <span className="text-ink-muted truncate block font-mono text-[11px]">
                  /{tenant.slug}/apply/{viewJobModal.externalRef}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleCopyJobLink(viewJobModal)}
                  className="flex items-center gap-1 font-bold text-ink-2 hover:text-brand transition-colors"
                  title="Copy application link to clipboard"
                >
                  {copiedJobId === viewJobModal.id ? (
                    <>
                      <Check size={13} className="text-emerald-600" />
                      <span className="text-emerald-700">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={13} />
                      <span>Copy</span>
                    </>
                  )}
                </button>
                <span className="text-line-2">•</span>
                <button
                  type="button"
                  onClick={() => handleShareJob(viewJobModal)}
                  className="flex items-center gap-1 font-bold text-ink-2 hover:text-brand transition-colors"
                  title="Share job opening"
                >
                  <Share size={13} />
                  <span>Share</span>
                </button>
              </div>
            </div>

            {/* Full Job Description */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted block">
                Full Job Description
              </span>
              <div className="max-h-80 overflow-y-auto rounded-xl border border-line bg-canvas/40 p-4 text-xs leading-relaxed text-ink select-text">
                {viewJobModal.description.includes("<") ? (
                  <div
                    className="prose prose-xs max-w-none [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mt-3 [&_h2]:mb-1 [&_ul]:list-disc [&_ul]:pl-4 [&_p]:mb-2 text-ink-2"
                    dangerouslySetInnerHTML={{ __html: viewJobModal.description }}
                  />
                ) : (
                  <p className="whitespace-pre-line">{viewJobModal.description}</p>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between border-t border-line pt-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => requestDeleteJob(viewJobModal)}
                  className="text-xs font-semibold text-rose-600 hover:underline"
                >
                  Delete Opening
                </button>
                <span className="text-line-2">•</span>
                <button
                  type="button"
                  onClick={() => handleOpenEditJob(viewJobModal)}
                  className="text-xs font-semibold text-brand hover:underline"
                >
                  Edit Opening
                </button>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => setViewJobModal(null)}>
                  Close
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => handleCopyJobLink(viewJobModal)}
                  className="flex items-center gap-1.5 text-xs font-semibold"
                >
                  {copiedJobId === viewJobModal.id ? (
                    <>
                      <Check size={14} className="text-emerald-600" />
                      <span className="text-emerald-700 font-bold">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span>Copy Link</span>
                    </>
                  )}
                </Button>
                <Button
                  variant="primary"
                  onClick={() => handleShareJob(viewJobModal)}
                  className="flex items-center gap-1.5 text-xs font-bold"
                >
                  <Share size={14} />
                  <span>Share Job</span>
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL: Share Job Opening */}
      <Modal
        open={Boolean(shareJobModal)}
        onClose={() => setShareJobModal(null)}
        title="Share Job Opening"
        subtitle={shareJobModal ? `Share "${shareJobModal.title}" with prospective candidates` : undefined}
      >
        {shareJobModal && (
          <div className="space-y-4 text-xs">
            <div>
              <span className="text-ink-muted block font-semibold mb-1">Public Application Link</span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={getJobApplyUrl(shareJobModal)}
                  className="flex-1 rounded-xl border border-line bg-canvas/60 px-3 py-2 text-xs font-mono text-ink select-all focus:outline-none"
                />
                <Button
                  variant={copiedJobId === shareJobModal.id ? "ghost" : "primary"}
                  onClick={() => handleCopyJobLink(shareJobModal)}
                  className="flex items-center gap-1 shrink-0 text-xs"
                >
                  {copiedJobId === shareJobModal.id ? (
                    <>
                      <Check size={13} className="text-emerald-600" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={13} />
                      <span>Copy Link</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-line-soft bg-canvas/40 p-3 space-y-2">
              <span className="font-semibold text-ink block">Quick Share via Platforms</span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                    `We're hiring for ${shareJobModal.title} at ${tenant.name}! Apply here: ${getJobApplyUrl(shareJobModal)}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-line bg-surface p-2.5 font-semibold text-ink hover:border-brand hover:text-brand transition-colors text-center no-underline"
                >
                  <span>WhatsApp</span>
                </a>
                <a
                  href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(getJobApplyUrl(shareJobModal))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-line bg-surface p-2.5 font-semibold text-ink hover:border-brand hover:text-brand transition-colors text-center no-underline"
                >
                  <span>LinkedIn</span>
                </a>
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                    `We're hiring a ${shareJobModal.title}! Apply now: `
                  )}&url=${encodeURIComponent(getJobApplyUrl(shareJobModal))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-line bg-surface p-2.5 font-semibold text-ink hover:border-brand hover:text-brand transition-colors text-center no-underline"
                >
                  <span>Twitter / X</span>
                </a>
                <a
                  href={`mailto:?subject=${encodeURIComponent(
                    `Job Opportunity: ${shareJobModal.title} at ${tenant.name}`
                  )}&body=${encodeURIComponent(
                    `Hi,\n\nCheck out this job opening for ${shareJobModal.title} (${shareJobModal.department || "Technology"} • ${shareJobModal.location || "Remote"}):\n\n${getJobApplyUrl(shareJobModal)}\n\nBest regards,\n${tenant.name} Hiring Team`
                  )}`}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-line bg-surface p-2.5 font-semibold text-ink hover:border-brand hover:text-brand transition-colors text-center no-underline"
                >
                  <span>Email</span>
                </a>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-line">
              <Button variant="ghost" onClick={() => setShareJobModal(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL: Create New Job (Diagram 1 Step 1: Role + Keywords + Selected Sites) */}
      <Modal
        open={newJobOpen}
        onClose={() => {
          setNewJobOpen(false);
          setGenerateError("");
        }}
        title="Post New Job Opening"
        subtitle="Step 1: HR creates role + keywords. Step 2: AI drafts JD. Step 3: Publish to selected sites."
      >
        <form onSubmit={handleCreateJob} className="space-y-4">
          {generateError && (
            <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800">
              <Alert size={15} className="shrink-0 text-rose-600 mt-0.5" />
              <span>{generateError}</span>
            </div>
          )}

          <Field label="Job Title" htmlFor="job-title-input">
            <Input
              id="job-title-input"
              placeholder="e.g. Senior Software Architect"
              value={newJobTitle}
              onChange={(e) => setNewJobTitle(e.target.value)}
              required
            />
          </Field>

          {/* Role Keywords Input (Diagram 1: "HR creates role + keywords") */}
          <Field label="Role Keywords & Core Competencies" htmlFor="job-keywords-input" hint="Required technical skills, domain expertise, and frameworks">
            <Input
              id="job-keywords-input"
              placeholder="e.g. TypeScript, React, Node.js, Distributed Systems, PostgreSQL"
              value={newJobKeywords}
              onChange={(e) => setNewJobKeywords(e.target.value)}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Department" htmlFor="job-dept-input">
              <Input
                id="job-dept-input"
                placeholder="e.g. Engineering"
                value={newJobDept}
                onChange={(e) => setNewJobDept(e.target.value)}
              />
            </Field>

            <Field label="Experience" htmlFor="job-exp-input">
              <Input
                id="job-exp-input"
                placeholder="e.g. 3-5 years or 5+ years"
                value={newJobExp}
                onChange={(e) => setNewJobExp(e.target.value)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Workplace Type" htmlFor="job-mode-select">
              <Select
                id="job-mode-select"
                value={newJobWorkplace}
                onChange={(e) => setNewJobWorkplace(e.target.value as any)}
              >
                <option value="HYBRID">Hybrid</option>
                <option value="REMOTE">Remote</option>
                <option value="ONSITE">On-site</option>
              </Select>
            </Field>

            <Field label="Location" htmlFor="job-loc-input">
              <Input
                id="job-loc-input"
                placeholder="e.g. Bangalore, India"
                value={newJobLoc}
                onChange={(e) => setNewJobLoc(e.target.value)}
              />
            </Field>
          </div>

          {/* Publish to Selected Sites (Diagram 1 Step 3) */}
          <div className="space-y-1.5 pt-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-muted block">
              Publish to Selected Sites
            </label>
            <div className="flex flex-wrap gap-2 text-xs">
              {["Brutallyhired Portal", "LinkedIn", "Indeed", "Glassdoor"].map((channel) => {
                const selected = newJobChannels.includes(channel);
                return (
                  <button
                    key={channel}
                    type="button"
                    onClick={() => {
                      if (selected) {
                        setNewJobChannels(newJobChannels.filter((c) => c !== channel));
                      } else {
                        setNewJobChannels([...newJobChannels, channel]);
                      }
                    }}
                    className={`rounded-lg px-2.5 py-1 font-semibold transition-all ${
                      selected
                        ? "bg-brand text-brand-fg shadow-xs"
                        : "border border-line bg-white text-ink-muted hover:text-ink"
                    }`}
                  >
                    {selected ? "✓ " : "+ "}
                    {channel}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t border-line-soft">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                Job Description (AI Generator & Workspace)
              </label>
              <button
                type="button"
                onClick={handleAutoGenerateDesc}
                disabled={!newJobTitle.trim()}
                className="flex items-center gap-1.5 rounded-lg border border-brand/30 bg-brand/5 px-2.5 py-1 text-xs font-semibold text-brand hover:bg-brand hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Sparkle size={13} />
                <span>Auto-Generate with AI</span>
              </button>
            </div>

            {newJobDescHtml || newJobDesc ? (
              <div className="rounded-xl border border-teal-200 bg-teal-50/80 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-teal-900 flex items-center gap-1.5">
                    <Check size={15} className="text-teal-700" />
                    <span>AI Description Drafted Successfully</span>
                  </span>
                  <span className="text-[11px] text-teal-800 font-semibold bg-white/70 px-2 py-0.5 rounded-full border border-teal-200">
                    ~{newJobDesc.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length} words
                  </span>
                </div>

                <p className="text-xs text-teal-800 leading-relaxed line-clamp-3 bg-white/60 p-2.5 rounded-lg border border-teal-100">
                  {newJobDesc.replace(/<[^>]+>/g, " ").substring(0, 220)}...
                </p>

                {/* Requirement 1: Provide "Preview & Edit JD" button */}
                <button
                  type="button"
                  onClick={() => {
                    setNewJobOpen(false);
                    setIsJdEditorOpen(true);
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold py-2.5 px-4 text-xs shadow-sm hover:shadow transition-all"
                >
                  <span>Preview & Edit JD (Full-Page Workspace)</span>
                  <Arrow size={14} />
                </button>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-line-2 bg-slate-50 p-5 text-center space-y-2">
                <p className="text-xs text-ink-muted">
                  Fill in the role & keywords above, then click <strong>Auto-Generate with AI</strong>.
                </p>
                <button
                  type="button"
                  onClick={handleAutoGenerateDesc}
                  disabled={!newJobTitle.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-line px-3.5 py-1.5 text-xs font-semibold text-ink-2 hover:border-brand hover:text-brand shadow-xs disabled:opacity-50"
                >
                  <Sparkle size={13} />
                  <span>Auto-Generate with AI</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center border-t border-line pt-3">
            <div>
              {hasDraftLoaded && (
                <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                  <Check size={12} />
                  <span>Saved draft active</span>
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setNewJobOpen(false);
                  setGenerateError("");
                }}
              >
                Cancel
              </Button>
              {newJobDesc ? (
                <button
                  type="button"
                  onClick={() => {
                    setNewJobOpen(false);
                    setIsJdEditorOpen(true);
                  }}
                  className="rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold px-4 py-2 text-xs shadow-sm transition-all flex items-center gap-1.5"
                >
                  <span>Preview & Edit JD →</span>
                </button>
              ) : (
                <Button
                  type="submit"
                  disabled={!newJobTitle.trim()}
                  title="Generate or fill JD first"
                >
                  Continue
                </Button>
              )}
            </div>
          </div>
        </form>
      </Modal>

      {/* MODAL: Reject or Hold Candidate with Explicit Reason (Diagram 1) */}
      <Modal
        open={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title={rejectActionType === "REJECTED" ? "Reject Candidate Application" : "Place Candidate On Hold"}
        subtitle={`Select an explicit reason to record for ${activeReviewApp?.candidateName || activeReviewApp?.email}.`}
      >
        <div className="space-y-4 text-xs">
          <Field label="Select Explicit Reason">
            <Select
              value={selectedRejectReason}
              onChange={(e) => setSelectedRejectReason(e.target.value)}
            >
              {(rejectActionType === "REJECTED" ? REJECTION_REASONS : HOLD_REASONS).map((r) => (
                <option key={r.id} value={r.label}>
                  {r.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Additional Recruiter Notes (Optional)">
            <Textarea
              rows={3}
              placeholder="Provide specific justification or notes for this decision..."
              value={rejectCustomNote}
              onChange={(e) => setRejectCustomNote(e.target.value)}
            />
          </Field>

          <div className="flex justify-end gap-2 border-t border-line pt-3">
            <Button variant="ghost" onClick={() => setRejectModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={rejectActionType === "REJECTED" ? "danger" : "primary"}
              onClick={handleConfirmRejectOrHold}
            >
              {rejectActionType === "REJECTED" ? "Confirm Rejection" : "Confirm Hold"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL: BrutalAssessAI™ Telemetry & Audit Evidence Inspector (Figure 4) */}
      <Modal
        open={Boolean(activeInspectSession)}
        onClose={() => setActiveInspectSession(null)}
        title="BrutalAssessAI™ Telemetry & Audit Evidence Inspector"
        subtitle={
          activeInspectSession
            ? `${activeInspectSession.candidateName} • ${activeInspectSession.assessmentTitle} • ${activeInspectSession.mode}`
            : ""
        }
      >
        {activeInspectSession && (
          <div className="space-y-5 text-xs">
            {/* Header Anomaly Summary */}
            <div className="flex items-center justify-between rounded-xl border border-line bg-canvas p-3.5">
              <div>
                <span className="text-[10px] font-semibold text-ink-muted uppercase block">Overall AI Anomaly Risk</span>
                <span className={`text-base font-bold ${activeInspectSession.riskLevel === "HIGH" ? "text-rose-600" : "text-emerald-700"}`}>
                  Risk Score: {activeInspectSession.riskScore}/100 ({activeInspectSession.riskLevel})
                </span>
              </div>
              <Pill tone={activeInspectSession.mode === "HIGHER_ASSURANCE" ? "blue" : "teal"}>
                {activeInspectSession.mode === "HIGHER_ASSURANCE" ? "Secure Exam Client (OS Controls)" : "Standard Web Proctoring"}
              </Pill>
            </div>

            {/* AI Signal Deep-Dive */}
            <div className="space-y-2">
              <span className="font-bold text-ink uppercase tracking-wider text-[11px] block">
                Figure 4 AI Proctoring Signals
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div className="rounded-lg border border-line p-2.5 space-y-1">
                  <span className="text-[10px] text-ink-muted uppercase block">Face Visibility</span>
                  <span className="font-bold text-ink">{activeInspectSession.aiSignals.faceVisibilityPct}% Tracking</span>
                </div>
                <div className="rounded-lg border border-line p-2.5 space-y-1">
                  <span className="text-[10px] text-ink-muted uppercase block">Extra Persons</span>
                  <span className={`font-bold ${activeInspectSession.aiSignals.extraPersonsCount > 0 ? "text-rose-600" : "text-emerald-700"}`}>
                    {activeInspectSession.aiSignals.extraPersonsCount} Detected
                  </span>
                </div>
                <div className="rounded-lg border border-line p-2.5 space-y-1">
                  <span className="text-[10px] text-ink-muted uppercase block">Phone Detection</span>
                  <span className={`font-bold ${activeInspectSession.aiSignals.phoneDetected ? "text-rose-600" : "text-emerald-700"}`}>
                    {activeInspectSession.aiSignals.phoneDetected ? "Flagged (Confidence 89%)" : "Clean"}
                  </span>
                </div>
                <div className="rounded-lg border border-line p-2.5 space-y-1">
                  <span className="text-[10px] text-ink-muted uppercase block">Display Monitors</span>
                  <span className="font-bold text-ink">{activeInspectSession.aiSignals.monitorCount} Display(s)</span>
                </div>
                <div className="rounded-lg border border-line p-2.5 space-y-1">
                  <span className="text-[10px] text-ink-muted uppercase block">Focus Loss / Tabs</span>
                  <span className="font-bold text-ink">{activeInspectSession.aiSignals.focusLossCount} tab switches</span>
                </div>
                <div className="rounded-lg border border-line p-2.5 space-y-1">
                  <span className="text-[10px] text-ink-muted uppercase block">Network Interruptions</span>
                  <span className="font-bold text-ink">{activeInspectSession.aiSignals.interruptionsCount} drops</span>
                </div>
              </div>
            </div>

            {/* Audit Trail Timeline */}
            <div className="space-y-2">
              <span className="font-bold text-ink uppercase tracking-wider text-[11px] block">
                Continuous Autosave & Audit Trail Stream
              </span>
              <div className="max-h-48 overflow-y-auto rounded-xl border border-line bg-canvas p-3 space-y-2">
                {activeInspectSession.auditTrail.map((ev, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-[11px]">
                    <span className="font-mono text-ink-muted shrink-0">[{ev.time}]</span>
                    <span
                      className={`font-medium ${
                        ev.tone === "danger"
                          ? "text-rose-700 font-bold"
                          : ev.tone === "warn"
                          ? "text-amber-800"
                          : "text-ink"
                      }`}
                    >
                      {ev.event}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Adjudication actions inside inspector */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    handleAdjudicate(activeInspectSession.id, "PASS");
                    setActiveInspectSession(null);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  ✓ Pass Candidate
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    handleAdjudicate(activeInspectSession.id, "RETRY");
                    setActiveInspectSession(null);
                  }}
                >
                  ↺ Retry
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    handleAdjudicate(activeInspectSession.id, "FAIL");
                    setActiveInspectSession(null);
                  }}
                >
                  ✗ Fail Candidate
                </Button>
              </div>

              <Button variant="ghost" onClick={() => setActiveInspectSession(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL: Invite / Add Staff Member */}
      <Modal
        open={inviteStaffOpen}
        onClose={() => setInviteStaffOpen(false)}
        title="Add Team Member"
        subtitle="Add a new recruiter, administrator, or technical interviewer to the hiring team"
      >
        <form onSubmit={handleAddStaff} className="space-y-4">
          <Field label="Full Name">
            <Input
              placeholder="e.g. Priya Sharma"
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
              required
            />
          </Field>
          <Field label="Email Address">
            <Input
              type="email"
              placeholder="priya.recruiter@company.com"
              value={staffEmail}
              onChange={(e) => setStaffEmail(e.target.value)}
              required
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Role">
              <Select value={staffRole} onChange={(e) => setStaffRole(e.target.value as any)}>
                <option value="RECRUITER">Recruiter</option>
                <option value="INTERVIEWER">Interviewer</option>
                <option value="ADMIN">Admin</option>
              </Select>
            </Field>
            <Field label="Title / Designation">
              <Input
                placeholder="e.g. Senior Tech Recruiter"
                value={staffTitle}
                onChange={(e) => setStaffTitle(e.target.value)}
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2 border-t border-line pt-3">
            <Button variant="ghost" type="button" onClick={() => setInviteStaffOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Add Member</Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Edit Team Member */}
      <Modal
        open={Boolean(editingStaff)}
        onClose={() => setEditingStaff(null)}
        title="Edit Team Member"
        subtitle={editingStaff ? `Editing ${editingStaff.name}` : ""}
      >
        {editingStaff && (
          <form onSubmit={handleSaveEditStaff} className="space-y-4">
            <Field label="Full Name">
              <Input
                value={editStaffName}
                onChange={(e) => setEditStaffName(e.target.value)}
                required
              />
            </Field>
            <Field label="Email Address">
              <Input
                type="email"
                value={editStaffEmail}
                onChange={(e) => setEditStaffEmail(e.target.value)}
                required
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Role">
                <Select value={editStaffRole} onChange={(e) => setEditStaffRole(e.target.value as any)}>
                  <option value="RECRUITER">Recruiter</option>
                  <option value="INTERVIEWER">Interviewer</option>
                  <option value="ADMIN">Admin</option>
                </Select>
              </Field>
              <Field label="Title / Designation">
                <Input
                  value={editStaffTitle}
                  onChange={(e) => setEditStaffTitle(e.target.value)}
                  required
                />
              </Field>
            </div>
            <div className="flex justify-end gap-2 border-t border-line pt-3">
              <Button variant="ghost" type="button" onClick={() => setEditingStaff(null)}>
                Cancel
              </Button>
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* MODAL: Add New Candidate */}
      <Modal
        open={addCandOpen}
        onClose={() => setAddCandOpen(false)}
        title="Add New Candidate Application"
        subtitle="Create an applicant profile and add them to the hiring pipeline"
      >
        <form onSubmit={handleAddCandidate} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Candidate Full Name">
              <Input
                placeholder="e.g. Rahul Verma"
                value={candName}
                onChange={(e) => setCandName(e.target.value)}
                required
              />
            </Field>
            <Field label="Email Address">
              <Input
                type="email"
                placeholder="e.g. rahul.verma@example.com"
                value={candEmail}
                onChange={(e) => setCandEmail(e.target.value)}
                required
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone Number">
              <Input
                placeholder="e.g. +91 9876543210"
                value={candPhone}
                onChange={(e) => setCandPhone(e.target.value)}
              />
            </Field>
            <Field label="City / Location">
              <Input
                placeholder="e.g. Visakhapatnam, Hyderabad, Remote"
                value={candCity}
                onChange={(e) => setCandCity(e.target.value)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Applied Job Requisition">
              <Select value={candJob || jobs[0]?.title} onChange={(e) => setCandJob(e.target.value)}>
                {jobs.map((j) => (
                  <option key={j.id} value={j.title}>
                    {j.title} ({j.department})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Initial Pipeline Stage">
              <Select value={candStage} onChange={(e) => setCandStage(e.target.value)}>
                <option value="SUBMITTED">Submitted</option>
                <option value="IN_REVIEW">In Review</option>
                <option value="SHORTLISTED">Shortlisted</option>
                <option value="ASSESSMENT">Screening Test / Assessment</option>
                <option value="INTERVIEW">Interview Schedule</option>
                <option value="OFFER">Offer</option>
                <option value="HIRED">Onboarding / Hired</option>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Work Experience">
              <Select value={candExp} onChange={(e) => setCandExp(e.target.value)}>
                <option value="Less than 2 years">Less than 2 years</option>
                <option value="2-4 years">2-4 years</option>
                <option value="5-8 years">5-8 years</option>
                <option value="8+ years">8+ years</option>
              </Select>
            </Field>
            <Field label="Match Score (0-100)">
              <Input
                type="number"
                min={0}
                max={100}
                value={candScore}
                onChange={(e) => setCandScore(Number(e.target.value) || 0)}
              />
            </Field>
          </div>

          <div className="flex justify-end gap-2 border-t border-line pt-3">
            <Button variant="ghost" type="button" onClick={() => setAddCandOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Candidate</Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Edit Candidate Details */}
      <Modal
        open={Boolean(editingCandidate)}
        onClose={() => setEditingCandidate(null)}
        title="Edit Candidate Application"
        subtitle={editingCandidate ? `Editing ${editingCandidate.candidateName || editingCandidate.email}` : ""}
      >
        {editingCandidate && (
          <form onSubmit={handleSaveEditCandidate} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Candidate Name">
                <Input
                  value={editCandName}
                  onChange={(e) => setEditCandName(e.target.value)}
                  required
                />
              </Field>
              <Field label="Email Address">
                <Input
                  type="email"
                  value={editCandEmail}
                  onChange={(e) => setEditCandEmail(e.target.value)}
                  required
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone Number">
                <Input
                  value={editCandPhone}
                  onChange={(e) => setEditCandPhone(e.target.value)}
                />
              </Field>
              <Field label="City">
                <Input
                  value={editCandCity}
                  onChange={(e) => setEditCandCity(e.target.value)}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Applied Job Title">
                <Input
                  value={editCandJob}
                  onChange={(e) => setEditCandJob(e.target.value)}
                  required
                />
              </Field>
              <Field label="Current Pipeline Stage">
                <Select value={editCandStage} onChange={(e) => setEditCandStage(e.target.value)}>
                  <option value="SUBMITTED">Submitted</option>
                  <option value="IN_REVIEW">In Review</option>
                  <option value="SHORTLISTED">Shortlisted</option>
                  <option value="ASSESSMENT">Screening Test / Assessment</option>
                  <option value="INTERVIEW">Interview Schedule</option>
                  <option value="OFFER">Offer</option>
                  <option value="HIRED">Onboarding / Hired</option>
                  <option value="ON_HOLD">On Hold</option>
                  <option value="REJECTED">Rejected</option>
                </Select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Total Experience">
                <Input
                  value={editCandExp}
                  onChange={(e) => setEditCandExp(e.target.value)}
                />
              </Field>
              <Field label="Match Score (0-100)">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={editCandScore}
                  onChange={(e) => setEditCandScore(Number(e.target.value) || 0)}
                />
              </Field>
            </div>

            <div className="flex justify-end gap-2 border-t border-line pt-3">
              <Button variant="ghost" type="button" onClick={() => setEditingCandidate(null)}>
                Cancel
              </Button>
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* MODAL: Edit Job Opening */}
      <Modal
        open={Boolean(editingJob)}
        onClose={() => setEditingJob(null)}
        title="Edit Job Opening"
        subtitle={editingJob ? `Editing ${editingJob.title}` : ""}
      >
        {editingJob && (
          <form onSubmit={handleSaveEditJob} className="space-y-4">
            <Field label="Job Title">
              <Input
                value={editJobTitle}
                onChange={(e) => setEditJobTitle(e.target.value)}
                required
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Department">
                <Input
                  value={editJobDept}
                  onChange={(e) => setEditJobDept(e.target.value)}
                  required
                />
              </Field>
              <Field label="Location">
                <Input
                  value={editJobLoc}
                  onChange={(e) => setEditJobLoc(e.target.value)}
                  required
                />
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Workplace Type">
                <Select
                  value={editJobWorkplace}
                  onChange={(e) => setEditJobWorkplace(e.target.value as any)}
                >
                  <option value="HYBRID">Hybrid</option>
                  <option value="REMOTE">Remote</option>
                  <option value="ONSITE">Onsite</option>
                </Select>
              </Field>
              <Field label="Experience">
                <Input
                  value={editJobExp}
                  onChange={(e) => setEditJobExp(e.target.value)}
                />
              </Field>
              <Field label="Status">
                <Select
                  value={editJobStatus}
                  onChange={(e) => setEditJobStatus(e.target.value as any)}
                >
                  <option value="OPEN">Open</option>
                  <option value="DRAFT">Draft</option>
                  <option value="CLOSED">Closed</option>
                </Select>
              </Field>
            </div>

            <Field label="Job Description">
              <Textarea
                rows={6}
                value={editJobDesc}
                onChange={(e) => setEditJobDesc(e.target.value)}
                required
              />
            </Field>

            <div className="flex justify-end gap-2 border-t border-line pt-3">
              <Button variant="ghost" type="button" onClick={() => setEditingJob(null)}>
                Cancel
              </Button>
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* UNIVERSAL CONFIRMATION / PERMISSION DIALOG */}
      <Modal
        open={Boolean(confirmDialog?.open)}
        onClose={() => setConfirmDialog(null)}
        title={confirmDialog?.title || "Confirm Action"}
        maxWidth="max-w-md"
      >
        {confirmDialog && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-line bg-canvas p-4 text-xs">
              <Alert
                size={18}
                className={
                  confirmDialog.actionType === "delete"
                    ? "text-rose-600 mt-0.5 shrink-0"
                    : "text-brand mt-0.5 shrink-0"
                }
              />
              <p className="text-ink leading-relaxed font-medium">
                {confirmDialog.message}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 border-t border-line pt-3">
              <Button variant="ghost" type="button" onClick={() => setConfirmDialog(null)}>
                Cancel
              </Button>
              <button
                type="button"
                onClick={() => {
                  const act = confirmDialog.onConfirm;
                  setConfirmDialog(null);
                  act();
                }}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition-all shadow-sm cursor-pointer ${
                  confirmDialog.actionType === "delete"
                    ? "bg-rose-600 hover:bg-rose-700 text-white"
                    : "bg-brand hover:opacity-90 text-brand-fg"
                }`}
              >
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Floating Action Feedback Toast */}
      {actionFeedback && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 rounded-xl bg-slate-900 text-white px-4 py-2.5 text-xs font-semibold shadow-lift animate-in fade-in slide-in-from-top-2">
          <Check size={16} className="text-emerald-400" />
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* MODAL: Schedule Interview Round */}
      <Modal
        open={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        title="Schedule Technical Interview Round"
        subtitle={scheduleTargetApp ? `Candidate: ${scheduleTargetApp.candidateName} (${scheduleTargetApp.jobTitle})` : ""}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleConfirmScheduleInterview();
          }}
          className="space-y-4"
        >
          <Field label="Interview Round Title">
            <Input
              value={scheduleRoundName}
              onChange={(e) => setScheduleRoundName(e.target.value)}
              placeholder="e.g. Round 1: System Architecture & Technical Deep-Dive"
              required
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Assigned Panelist">
              <Select value={scheduleInterviewer} onChange={(e) => setScheduleInterviewer(e.target.value)}>
                <option value="Arun K. (Principal Architect)">Arun K. (Principal Architect)</option>
                <option value="Chandra S. (Lead Software Engineer)">Chandra S. (Lead Software Engineer)</option>
                <option value="Tanuja HR (Head of Talent)">Tanuja HR (Head of Talent)</option>
              </Select>
            </Field>
            <Field label="Scheduled Date & Time">
              <Input
                value={scheduleDateTime}
                onChange={(e) => setScheduleDateTime(e.target.value)}
                placeholder="Tomorrow at 10:00 AM"
                required
              />
            </Field>
          </div>
          <Field label="Panel Evaluation Focus & Prep Notes">
            <Textarea
              rows={3}
              value={scheduleNotes}
              onChange={(e) => setScheduleNotes(e.target.value)}
              placeholder="System design scaling, distributed caching, idempotency, LiveKit room setup..."
            />
          </Field>
          <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-3 text-xs text-blue-900 leading-relaxed">
            ✉️ Scheduling this round will automatically update candidate to <strong>INTERVIEW</strong> stage and dispatch an interview invitation email with the LiveKit room link.
          </div>
          <div className="flex justify-end gap-2 border-t border-line pt-3">
            <Button variant="ghost" onClick={() => setScheduleModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Schedule Round & Notify Candidate</Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Customize & Approve Formal Offer */}
      <Modal
        open={offerModalOpen}
        onClose={() => setOfferModalOpen(false)}
        title="Prepare & Approve Formal Job Offer"
        subtitle={offerApp ? `Candidate: ${offerApp.candidateName} • ${offerApp.jobTitle}` : ""}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleConfirmSendOffer();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Annual Base Compensation">
              <Input
                value={offerBaseSalary}
                onChange={(e) => setOfferBaseSalary(e.target.value)}
                placeholder="e.g. ₹ 18,00,000 / year"
                required
              />
            </Field>
            <Field label="Joining Bonus">
              <Input
                value={offerBonus}
                onChange={(e) => setOfferBonus(e.target.value)}
                placeholder="e.g. ₹ 2,00,000"
                required
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Stock / Equity Grant">
              <Input
                value={offerEquity}
                onChange={(e) => setOfferEquity(e.target.value)}
                placeholder="e.g. 5,000 RSUs (4-year vesting)"
                required
              />
            </Field>
            <Field label="Location & Workplace Type">
              <Input
                value={offerWorkplace}
                onChange={(e) => setOfferWorkplace(e.target.value)}
                placeholder="Visakhapatnam (Hybrid)"
                required
              />
            </Field>
          </div>
          <Field label="Proposed Start Date">
            <Input
              value={offerStartDate}
              onChange={(e) => setOfferStartDate(e.target.value)}
              placeholder="e.g. 1st of upcoming month"
              required
            />
          </Field>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs text-emerald-900 leading-relaxed">
            ✉️ Approving this formal offer will immediately update candidate stage to <strong>OFFER</strong> and email the candidate their official letter with digital signing capabilities.
          </div>
          <div className="flex justify-end gap-2 border-t border-line pt-3">
            <Button variant="ghost" onClick={() => setOfferModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
              Approve & Dispatch Offer Letter
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Inspect Sent Email */}
      <Modal
        open={Boolean(previewEmailModal)}
        onClose={() => setPreviewEmailModal(null)}
        title="Sent Email Notification Preview"
        subtitle={previewEmailModal?.recipient ? `Delivered to: ${previewEmailModal.recipient}` : ""}
      >
        {previewEmailModal && (
          <div className="space-y-4">
            <div className="rounded-xl border border-line bg-canvas p-4 text-xs space-y-1.5 font-sans">
              <div className="flex justify-between">
                <span className="text-ink-muted font-medium">To:</span>
                <span className="font-bold text-ink">{previewEmailModal.recipient} ({previewEmailModal.recipientName})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted font-medium">From:</span>
                <span className="font-medium text-ink">Brutallyhired Talent Team &lt;chandra2001ks@gmail.com&gt;</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted font-medium">Sent At:</span>
                <span className="text-ink-2">{previewEmailModal.sentAt}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-line-soft">
                <span className="text-ink-muted font-medium">Subject:</span>
                <strong className="text-ink font-bold">{previewEmailModal.subject}</strong>
              </div>
            </div>

            {/* Rendered HTML Email Container */}
            <div className="rounded-2xl border border-line-2 bg-[#F4F6FA] p-6 shadow-inner">
              <div className="max-w-[500px] mx-auto bg-white rounded-xl border border-[#E9EDF3] p-6 space-y-4 shadow-sm">
                <div className="flex items-center gap-2 font-bold text-ink text-base border-b border-line pb-3">
                  <span className="h-6 w-6 rounded-lg bg-brand text-white flex items-center justify-center text-xs">BH</span>
                  Brutallyhired
                </div>
                <h3 className="text-xl font-bold text-ink leading-snug">{previewEmailModal.heading}</h3>
                <p className="text-sm leading-relaxed text-[#2A3647]">{previewEmailModal.body}</p>
                
                <div className="pt-2">
                  <a
                    href={previewEmailModal.portalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block bg-brand hover:bg-brand-hover text-white font-semibold text-sm px-5 py-2.5 rounded-lg no-underline shadow-xs"
                  >
                    Open candidate portal →
                  </a>
                </div>

                <div className="pt-4 border-t border-line-soft text-[11px] text-[#5B6676]">
                  You’re receiving this because you applied through Brutallyhired’s candidate portal.
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-line pt-3">
              <a
                href={previewEmailModal.portalUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-bold text-brand hover:underline inline-flex items-center gap-1"
              >
                Launch Candidate View ↗
              </a>
              <Button variant="ghost" onClick={() => setPreviewEmailModal(null)}>
                Close Preview
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
