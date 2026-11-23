import { useState, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { Card, Pill } from "@/components/ui/Card";
import {
  Alert,
  Briefcase,
  Calendar,
  Check,
  Clock,
  Copy,
  Download,
  Eye,
  File,
  Hourglass,
  Lock,
  Mail,
  Monitor,
  Plus,
  Search,
  Shield,
  Sparkle,
  Trash,
  Upload,
  User,
  Users,
  Wifi,
  X,
} from "@/components/ui/icons";
import { sendEmailNotification } from "@/lib/emailService";

export interface OnboardingTaskItem {
  id: string;
  title: string;
  description: string;
  category: "DOCUMENTS" | "FINANCE" | "LEGAL" | "IT_SETUP" | "ORIENTATION";
  status: "PENDING" | "SUBMITTED" | "VERIFIED" | "REJECTED";
  required: boolean;
  submittedFile?: string;
  submittedAt?: string;
  verifiedAt?: string;
  reviewerNote?: string;
}

export interface NewHireRecord {
  id: string;
  candidateId: string;
  name: string;
  email: string;
  phone: string;
  jobTitle: string;
  department: string;
  startDate: string;
  location: string;
  assignedBuddy: string;
  status: "IN_PROGRESS" | "DOCS_PENDING" | "READY_FOR_DAY_1" | "COMPLETED";
  itHardware: {
    laptopModel: string;
    corporateEmail: string;
    slackInvited: boolean;
    githubProvisioned: boolean;
    laptopShipped: boolean;
    trackingNumber: string;
  };
  orientationNotes: string;
  tasks: OnboardingTaskItem[];
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

interface OnboardingModuleProps {
  applications: ApplicationItem[];
  jobs: JobItem[];
  tenant: { slug: string; name: string };
  onNavigateToOffers?: () => void;
}

const DEFAULT_TASKS_TEMPLATE: OnboardingTaskItem[] = [
  {
    id: "task-1",
    title: "Government Identity & Address Proof",
    description: "Upload Aadhaar, Passport, or National ID document.",
    category: "DOCUMENTS",
    required: true,
    status: "VERIFIED",
    submittedFile: "aadhaar_card_verified.pdf",
    submittedAt: "2 days ago",
    verifiedAt: "1 day ago",
  },
  {
    id: "task-2",
    title: "Direct Deposit & Bank Details",
    description: "Upload cancelled cheque or passbook copy with verified IFSC code.",
    category: "FINANCE",
    required: true,
    status: "SUBMITTED",
    submittedFile: "hdfc_bank_cancelled_cheque.pdf",
    submittedAt: "1 day ago",
  },
  {
    id: "task-3",
    title: "Signed Non-Disclosure & Intellectual Property Agreement",
    category: "LEGAL",
    description: "Review and electronically sign confidentiality & invention assignment terms.",
    required: true,
    status: "VERIFIED",
    submittedFile: "signed_nda_agreement_ip.pdf",
    submittedAt: "3 days ago",
    verifiedAt: "2 days ago",
  },
  {
    id: "task-4",
    title: "Emergency Contact Details",
    category: "DOCUMENTS",
    description: "Provide primary and secondary emergency contact details and blood group.",
    required: false,
    status: "SUBMITTED",
    submittedFile: "emergency_contacts.pdf",
    submittedAt: "1 day ago",
  },
  {
    id: "task-5",
    title: "IT Workstation & Security Policy Acknowledgement",
    category: "IT_SETUP",
    description: "Confirm acceptance of corporate cyber security and encryption guidelines.",
    required: true,
    status: "PENDING",
  },
];

// Helper to download onboarding dossier
function downloadOnboardingDossier(hire: NewHireRecord, companyName: string) {
  const filename = `Onboarding_Dossier_${hire.name.replace(/\s+/g, "_")}.txt`;
  const lines: string[] = [
    `========================================================================`,
    `${companyName.toUpperCase()} - NEW HIRE ONBOARDING & COMPLIANCE DOSSIER`,
    `========================================================================`,
    `Employee / Candidate: ${hire.name}`,
    `Email: ${hire.email} | Phone: ${hire.phone}`,
    `Position: ${hire.jobTitle} (${hire.department})`,
    `Target Start Date: ${hire.startDate}`,
    `Work Location: ${hire.location}`,
    `Assigned Buddy / Mentor: ${hire.assignedBuddy}`,
    `Corporate Email: ${hire.itHardware.corporateEmail}`,
    `Laptop Provisioned: ${hire.itHardware.laptopModel} (Shipped: ${hire.itHardware.laptopShipped ? "YES - Tracking: " + hire.itHardware.trackingNumber : "NO"})`,
    `Overall Status: ${hire.status}`,
    `------------------------------------------------------------------------`,
    `COMPLIANCE CHECKLIST & VERIFICATION:`,
    ...hire.tasks.map((t, idx) => {
      return `${idx + 1}. [${t.status}] ${t.title} (${t.category})${t.submittedFile ? ` - File: ${t.submittedFile}` : ""}${t.reviewerNote ? ` - Note: ${t.reviewerNote}` : ""}`;
    }),
    `------------------------------------------------------------------------`,
    `ORIENTATION SCHEDULE & NOTES:`,
    hire.orientationNotes || "Day 1 orientation schedule confirmed by Talent Operations.",
    `========================================================================`,
    `Generated by Brutallyhired Onboarding Command Center on ${new Date().toLocaleString()}`,
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function OnboardingModule({
  applications,
  jobs,
  tenant,
  onNavigateToOffers,
}: OnboardingModuleProps) {
  // Load or initialize new hire records
  const [newHires, setNewHires] = useState<NewHireRecord[]>(() => {
    const saved = localStorage.getItem("bh_admin_onboarding_records");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        // ignore parsing errors
      }
    }

    // Default seed records matching existing hiring state
    const seed: NewHireRecord[] = [
      {
        id: "nh-1",
        candidateId: "app-101",
        name: "Amirti Tanuja",
        email: "amirti.tanuja@example.com",
        phone: "+91 98480 22338",
        jobTitle: "Senior Full-Stack Developer",
        department: "Engineering",
        startDate: "2026-12-01",
        location: "Engineering Tech Hub, Visakhapatnam (Hybrid)",
        assignedBuddy: "Arun K. (Principal Architect)",
        status: "READY_FOR_DAY_1",
        itHardware: {
          laptopModel: "MacBook Pro 16\" M3 Max (36GB RAM / 1TB SSD)",
          corporateEmail: "amirti.tanuja@brutallyhired.com",
          slackInvited: true,
          githubProvisioned: true,
          laptopShipped: true,
          trackingNumber: "BLUEDART-8492049182",
        },
        orientationNotes:
          "09:30 AM: Welcome Breakfast & IT Laptop Provisioning\n11:00 AM: Team Introductions & Architecture Overview\n02:00 PM: Deep-Dive with Assigned Buddy",
        tasks: [
          {
            id: "task-1",
            title: "Government Identity & Address Proof",
            description: "Upload Aadhaar, Passport, or National ID document.",
            category: "DOCUMENTS",
            required: true,
            status: "VERIFIED",
            submittedFile: "amirti_aadhaar_verified.pdf",
            submittedAt: "Nov 18, 2026",
            verifiedAt: "Nov 18, 2026",
          },
          {
            id: "task-2",
            title: "Direct Deposit & Bank Details",
            description: "Upload cancelled cheque or passbook copy with verified IFSC code.",
            category: "FINANCE",
            required: true,
            status: "VERIFIED",
            submittedFile: "hdfc_cancelled_cheque.pdf",
            submittedAt: "Nov 18, 2026",
            verifiedAt: "Nov 19, 2026",
          },
          {
            id: "task-3",
            title: "Signed Non-Disclosure & Intellectual Property Agreement",
            category: "LEGAL",
            description: "Review and electronically sign confidentiality & IP assignment terms.",
            required: true,
            status: "VERIFIED",
            submittedFile: "signed_brutallyhired_nda.pdf",
            submittedAt: "Nov 17, 2026",
            verifiedAt: "Nov 17, 2026",
          },
          {
            id: "task-4",
            title: "IT Workstation & Security Policy Acknowledgement",
            category: "IT_SETUP",
            description: "Confirm acceptance of corporate cyber security and 2FA guidelines.",
            required: true,
            status: "VERIFIED",
            submittedFile: "security_policy_signed.pdf",
            submittedAt: "Nov 19, 2026",
            verifiedAt: "Nov 19, 2026",
          },
          {
            id: "task-5",
            title: "Emergency Contact Details",
            category: "DOCUMENTS",
            description: "Provide primary and secondary contact details.",
            required: false,
            status: "VERIFIED",
            submittedFile: "emergency_contact_sheet.pdf",
            submittedAt: "Nov 19, 2026",
            verifiedAt: "Nov 19, 2026",
          },
        ],
      },
      {
        id: "nh-2",
        candidateId: "app-105",
        name: "Rahul Sharma",
        email: "rahul.sharma@example.com",
        phone: "+91 99123 45678",
        jobTitle: "Software Developer",
        department: "Engineering",
        startDate: "2026-12-15",
        location: "Bengaluru Office / Hybrid",
        assignedBuddy: "Vikram R. (Engineering Manager)",
        status: "DOCS_PENDING",
        itHardware: {
          laptopModel: "Lenovo ThinkPad P1 Gen 6 (32GB RAM)",
          corporateEmail: "rahul.sharma@brutallyhired.com",
          slackInvited: true,
          githubProvisioned: false,
          laptopShipped: false,
          trackingNumber: "",
        },
        orientationNotes: "10:00 AM: Engineering Orientation & AWS Workspace Setup.",
        tasks: [
          {
            id: "task-1",
            title: "Government Identity & Address Proof",
            description: "Upload Aadhaar, Passport, or National ID document.",
            category: "DOCUMENTS",
            required: true,
            status: "VERIFIED",
            submittedFile: "rahul_passport_copy.pdf",
            submittedAt: "Nov 19, 2026",
            verifiedAt: "Nov 20, 2026",
          },
          {
            id: "task-2",
            title: "Direct Deposit & Bank Details",
            description: "Upload cancelled cheque or passbook copy with verified IFSC code.",
            category: "FINANCE",
            required: true,
            status: "SUBMITTED",
            submittedFile: "sbi_bank_statement.pdf",
            submittedAt: "Nov 20, 2026",
          },
          {
            id: "task-3",
            title: "Signed Non-Disclosure & Intellectual Property Agreement",
            category: "LEGAL",
            description: "Review and electronically sign confidentiality terms.",
            required: true,
            status: "PENDING",
          },
          {
            id: "task-4",
            title: "IT Workstation & Security Policy Acknowledgement",
            category: "IT_SETUP",
            description: "Confirm acceptance of corporate cyber security guidelines.",
            required: true,
            status: "PENDING",
          },
        ],
      },
    ];

    return seed;
  });

  const saveHires = (updated: NewHireRecord[]) => {
    setNewHires(updated);
    localStorage.setItem("bh_admin_onboarding_records", JSON.stringify(updated));
  };

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedHireId, setSelectedHireId] = useState<string | null>(newHires[0]?.id || null);
  const [copiedCandidateId, setCopiedCandidateId] = useState<string | null>(null);
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);

  // New hire add modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newHireCandidateId, setNewHireCandidateId] = useState("");
  const [newHireStartDate, setNewHireStartDate] = useState(
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] || ""
  );
  const [newHireBuddy, setNewHireBuddy] = useState("Arun K. (Principal Architect)");
  const [newHireLaptop, setNewHireLaptop] = useState("MacBook Pro 16\" M3 (32GB RAM)");

  // Filtered new hires
  const filteredHires = useMemo(() => {
    return newHires.filter((h) => {
      const matchSearch =
        h.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        h.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        h.jobTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
        h.department.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = statusFilter === "ALL" || h.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [newHires, searchTerm, statusFilter]);

  // Selected candidate object
  const activeHire = useMemo(() => {
    return newHires.find((h) => h.id === selectedHireId) || newHires[0] || null;
  }, [newHires, selectedHireId]);

  // Metric counts
  const metrics = useMemo(() => {
    const total = newHires.length;
    const docsPending = newHires.filter(
      (h) => h.tasks.some((t) => t.status === "PENDING" || t.status === "SUBMITTED")
    ).length;
    const itShipped = newHires.filter((h) => h.itHardware.laptopShipped).length;
    const readyForDay1 = newHires.filter((h) => h.status === "READY_FOR_DAY_1" || h.status === "COMPLETED").length;
    return { total, docsPending, itShipped, readyForDay1 };
  }, [newHires]);

  // Actions on tasks
  const handleVerifyTask = (taskId: string) => {
    if (!activeHire) return;
    const updatedTasks = activeHire.tasks.map((t) => {
      if (t.id === taskId) {
        return {
          ...t,
          status: "VERIFIED" as const,
          verifiedAt: new Date().toLocaleDateString(),
        };
      }
      return t;
    });

    const allVerified = updatedTasks.every((t) => !t.required || t.status === "VERIFIED");
    const nextStatus = allVerified ? ("READY_FOR_DAY_1" as const) : activeHire.status;

    const updated = newHires.map((h) =>
      h.id === activeHire.id ? { ...h, tasks: updatedTasks, status: nextStatus } : h
    );
    saveHires(updated);
  };

  const handleRejectTask = (taskId: string) => {
    if (!activeHire) return;
    const reason = prompt("Enter note/reason for document rejection or re-submission request:");
    if (reason === null) return;

    const updatedTasks = activeHire.tasks.map((t) => {
      if (t.id === taskId) {
        return {
          ...t,
          status: "REJECTED" as const,
          reviewerNote: reason || "Document rejected by HR. Please re-upload a clear copy.",
        };
      }
      return t;
    });

    const updated = newHires.map((h) =>
      h.id === activeHire.id ? { ...h, tasks: updatedTasks, status: "DOCS_PENDING" as const } : h
    );
    saveHires(updated);
  };

  const handleToggleItHardware = (key: "slackInvited" | "githubProvisioned" | "laptopShipped") => {
    if (!activeHire) return;
    const currentVal = activeHire.itHardware[key];
    const updatedHardware = { ...activeHire.itHardware, [key]: !currentVal };
    const updated = newHires.map((h) =>
      h.id === activeHire.id ? { ...h, itHardware: updatedHardware } : h
    );
    saveHires(updated);
  };

  const handleUpdateTracking = () => {
    if (!activeHire) return;
    const tracking = prompt("Enter Courier / Tracking Number for Laptop Dispatch:", activeHire.itHardware.trackingNumber || "");
    if (tracking === null) return;
    const updatedHardware = {
      ...activeHire.itHardware,
      trackingNumber: tracking,
      laptopShipped: tracking.trim().length > 0,
    };
    const updated = newHires.map((h) =>
      h.id === activeHire.id ? { ...h, itHardware: updatedHardware } : h
    );
    saveHires(updated);
  };

  const handleCopyOnboardingLink = (candidateId: string) => {
    const origin = window.location.origin;
    const link = `${origin}/${tenant.slug}/onboarding/${candidateId}`;
    navigator.clipboard.writeText(link);
    setCopiedCandidateId(candidateId);
    setTimeout(() => setCopiedCandidateId(null), 3000);
  };

  const handleEmailOnboardingLink = (hire: NewHireRecord) => {
    const origin = window.location.origin;
    const link = `${origin}/${tenant.slug}/onboarding/${hire.candidateId}`;
    sendEmailNotification({
      to: hire.email,
      recipientName: hire.name,
      jobTitle: hire.jobTitle,
      stage: "HIRED",
      portalPath: `/${tenant.slug}/onboarding/${hire.candidateId}`,
      tenantSlug: tenant.slug,
      customHeading: `Welcome to ${tenant.name} - Onboarding & Next Steps`,
      customBody: `Dear ${hire.name},\n\nWelcome to ${tenant.name}! Your onboarding portal is ready.\n\nPlease log in to complete your identity documents, direct deposit details, and review orientation arrangements:\n${link}\n\nTarget Joining Date: ${hire.startDate}\nAssigned Buddy: ${hire.assignedBuddy}\n\nWe look forward to having you on the team!`,
    });
    setNotificationMsg(`Onboarding instructions and portal link emailed to ${hire.email}`);
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  const handleMarkCompleted = (hireId: string) => {
    const updated = newHires.map((h) =>
      h.id === hireId ? { ...h, status: "COMPLETED" as const } : h
    );
    saveHires(updated);
    setNotificationMsg("Candidate onboarding marked fully complete. Transitioned to Active Employee.");
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  const handleCreateNewHire = () => {
    const candidate = applications.find((a) => a.id === newHireCandidateId);
    const candidateName = candidate?.candidateName || "New Hire";
    const candidateEmail = candidate?.email || `${candidateName.toLowerCase().replace(/\s+/g, ".")}@example.com`;
    const candidateJob = candidate?.jobTitle || "Software Engineer";
    const candidateDept = candidate?.department || "Engineering";

    const newRecord: NewHireRecord = {
      id: `nh-${Date.now()}`,
      candidateId: newHireCandidateId || `cand-${Date.now()}`,
      name: candidateName,
      email: candidateEmail,
      phone: candidate?.phone || "+91 98480 00000",
      jobTitle: candidateJob,
      department: candidateDept,
      startDate: newHireStartDate,
      location: "Engineering Tech Hub (Hybrid)",
      assignedBuddy: newHireBuddy,
      status: "DOCS_PENDING",
      itHardware: {
        laptopModel: newHireLaptop,
        corporateEmail: `${candidateName.toLowerCase().replace(/\s+/g, ".")}@${tenant.slug || "brutallyhired"}.com`,
        slackInvited: false,
        githubProvisioned: false,
        laptopShipped: false,
        trackingNumber: "",
      },
      orientationNotes: "09:30 AM: Welcome Breakfast & IT Setup\n11:00 AM: Department Intro",
      tasks: DEFAULT_TASKS_TEMPLATE.map((t) => ({
        ...t,
        status: t.category === "DOCUMENTS" ? "PENDING" : "PENDING",
        submittedFile: undefined,
        submittedAt: undefined,
        verifiedAt: undefined,
      })),
    };

    saveHires([newRecord, ...newHires]);
    setSelectedHireId(newRecord.id);
    setIsAddModalOpen(false);
    setNotificationMsg(`Added ${newRecord.name} to Onboarding Tracker.`);
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-ink">
              Onboarding & Compliance Command Center
            </h1>
            <Pill tone="teal">Module Active</Pill>
          </div>
          <p className="text-sm text-ink-muted">
            Manage accepted hires through document verification, payroll setup, IT hardware dispatch, and Day-1 orientation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onNavigateToOffers && (
            <Button
              variant="ghost"
              onClick={onNavigateToOffers}
              className="text-xs font-semibold flex items-center gap-1.5 border border-line"
            >
              <Briefcase size={14} />
              <span>View Offers</span>
            </Button>
          )}
          <Button
            variant="primary"
            onClick={() => setIsAddModalOpen(true)}
            className="text-xs font-semibold flex items-center gap-1.5"
          >
            <Plus size={16} />
            <span>Enroll New Hire</span>
          </Button>
        </div>
      </div>

      {notificationMsg && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800 flex items-center justify-between">
          <span>✓ {notificationMsg}</span>
          <button type="button" onClick={() => setNotificationMsg(null)} className="text-emerald-700 hover:text-emerald-900">
            <X size={14} />
          </button>
        </div>
      )}

      {/* KPI Overview Metrics */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="p-4 space-y-1 bg-white border border-line">
          <div className="flex items-center justify-between text-xs font-semibold text-ink-muted">
            <span>Total In Onboarding</span>
            <Users size={16} className="text-brand" />
          </div>
          <div className="text-2xl font-bold text-ink">{metrics.total}</div>
          <p className="text-[11px] text-ink-muted">Active accepted hires</p>
        </Card>

        <Card className="p-4 space-y-1 bg-white border border-line">
          <div className="flex items-center justify-between text-xs font-semibold text-ink-muted">
            <span>Pending Doc Verification</span>
            <File size={16} className="text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600">{metrics.docsPending}</div>
          <p className="text-[11px] text-ink-muted">ID, Bank or NDA awaiting review</p>
        </Card>

        <Card className="p-4 space-y-1 bg-white border border-line">
          <div className="flex items-center justify-between text-xs font-semibold text-ink-muted">
            <span>IT Hardware Dispatched</span>
            <Monitor size={16} className="text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-indigo-600">{metrics.itShipped}</div>
          <p className="text-[11px] text-ink-muted">Laptops in transit or provisioned</p>
        </Card>

        <Card className="p-4 space-y-1 bg-white border border-line">
          <div className="flex items-center justify-between text-xs font-semibold text-ink-muted">
            <span>Ready for Day 1</span>
            <Check size={16} className="text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600">{metrics.readyForDay1}</div>
          <p className="text-[11px] text-ink-muted">Compliance & IT 100% verified</p>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-3 bg-white border border-line flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-2.5 text-ink-muted" />
          <input
            type="text"
            placeholder="Search new hire by name, email, role, or department..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-line bg-canvas pl-9 pr-3 py-1.5 text-xs text-ink focus:border-brand focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto">
          {["ALL", "DOCS_PENDING", "READY_FOR_DAY_1", "COMPLETED"].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all ${
                statusFilter === tab
                  ? "bg-brand text-brand-fg shadow-sm"
                  : "bg-canvas text-ink-2 hover:bg-line/40 hover:text-ink"
              }`}
            >
              {tab === "ALL" && "All Hires"}
              {tab === "DOCS_PENDING" && "Docs Pending"}
              {tab === "READY_FOR_DAY_1" && "Ready for Day 1"}
              {tab === "COMPLETED" && "Completed"}
            </button>
          ))}
        </div>
      </Card>

      {/* Main Workspace Layout: Master-Detail Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: New Hires List (4 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-ink-muted px-1">
            New Hire Pipeline ({filteredHires.length})
          </h2>

          {filteredHires.length === 0 ? (
            <Card className="p-8 text-center bg-white border border-line space-y-2">
              <Users size={32} className="mx-auto text-ink-muted" />
              <p className="text-sm font-semibold text-ink">No candidates found in this view</p>
              <p className="text-xs text-ink-muted">
                Candidates with accepted offers automatically appear here, or you can enroll a new hire directly.
              </p>
            </Card>
          ) : (
            <div className="space-y-2">
              {filteredHires.map((hire) => {
                const isSelected = activeHire?.id === hire.id;
                const totalTasks = hire.tasks.length;
                const verifiedTasks = hire.tasks.filter((t) => t.status === "VERIFIED").length;
                const progressPct = totalTasks > 0 ? Math.round((verifiedTasks / totalTasks) * 100) : 0;

                return (
                  <div
                    key={hire.id}
                    onClick={() => setSelectedHireId(hire.id)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer bg-white ${
                      isSelected
                        ? "border-brand shadow-sm ring-1 ring-brand"
                        : "border-line hover:border-line-2 hover:bg-canvas/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-ink">{hire.name}</h3>
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              hire.status === "COMPLETED"
                                ? "bg-emerald-100 text-emerald-800"
                                : hire.status === "READY_FOR_DAY_1"
                                ? "bg-teal-100 text-teal-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {hire.status === "READY_FOR_DAY_1"
                              ? "Day-1 Ready"
                              : hire.status === "COMPLETED"
                              ? "Completed"
                              : "Docs In Progress"}
                          </span>
                        </div>
                        <p className="text-xs text-ink-muted mt-0.5">
                          {hire.jobTitle} • {hire.department}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] font-semibold text-ink-muted block">Joining:</span>
                        <strong className="text-xs text-ink">{hire.startDate}</strong>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-3 space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-ink-muted">Verification Progress</span>
                        <span className="font-bold text-ink">
                          {verifiedTasks}/{totalTasks} ({progressPct}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-line overflow-hidden">
                        <div
                          className={`h-full transition-all rounded-full ${
                            progressPct === 100 ? "bg-emerald-500" : "bg-brand"
                          }`}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>

                    {/* Quick Badge Chips */}
                    <div className="mt-2.5 flex items-center gap-2 text-[10px] text-ink-muted">
                      <span className="flex items-center gap-1">
                        <Monitor size={12} className={hire.itHardware.laptopShipped ? "text-emerald-600" : "text-ink-muted"} />
                        {hire.itHardware.laptopShipped ? "Hardware Shipped" : "Hardware Pending"}
                      </span>
                      <span>•</span>
                      <span className="truncate">Buddy: {hire.assignedBuddy.split("(")[0]?.trim()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side: Active Hire Detail Workspace (7 cols) */}
        <div className="lg:col-span-7">
          {activeHire ? (
            <div className="space-y-4">
              {/* Profile Card & Action Bar */}
              <Card className="p-5 bg-white border border-line space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-4 border-b border-line">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-ink">{activeHire.name}</h2>
                      <Pill
                        tone={
                          activeHire.status === "COMPLETED"
                            ? "teal"
                            : activeHire.status === "READY_FOR_DAY_1"
                            ? "blue"
                            : "amber"
                        }
                      >
                        {activeHire.status.replace(/_/g, " ")}
                      </Pill>
                    </div>
                    <p className="text-xs text-ink-muted mt-1">
                      {activeHire.jobTitle} • {activeHire.department} • {activeHire.location}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-ink-muted mt-1.5">
                      <span>Email: <strong className="text-ink">{activeHire.email}</strong></span>
                      <span>•</span>
                      <span>Phone: <strong className="text-ink">{activeHire.phone}</strong></span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => handleCopyOnboardingLink(activeHire.candidateId)}
                      className="text-xs font-semibold border border-line flex items-center gap-1"
                      title="Copy public candidate onboarding portal URL"
                    >
                      <Copy size={13} />
                      <span>{copiedCandidateId === activeHire.candidateId ? "Copied!" : "Portal Link"}</span>
                    </Button>

                    <Button
                      variant="ghost"
                      onClick={() => handleEmailOnboardingLink(activeHire)}
                      className="text-xs font-semibold border border-line flex items-center gap-1 text-brand"
                    >
                      <Mail size={13} />
                      <span>Email Link</span>
                    </Button>

                    <Button
                      variant="ghost"
                      onClick={() => downloadOnboardingDossier(activeHire, tenant.name)}
                      className="text-xs font-semibold border border-line flex items-center gap-1"
                      title="Download full candidate compliance dossier"
                    >
                      <Download size={13} />
                      <span>Dossier</span>
                    </Button>
                  </div>
                </div>

                {/* Day 1 Orientation & Mentor Bar */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-canvas border border-line text-xs">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted block">
                      Target Start Date
                    </span>
                    <strong className="text-ink text-sm flex items-center gap-1.5 mt-0.5">
                      <Calendar size={14} className="text-brand" />
                      {activeHire.startDate}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted block">
                      Assigned Onboarding Buddy / Mentor
                    </span>
                    <strong className="text-ink text-sm flex items-center gap-1.5 mt-0.5">
                      <User size={14} className="text-brand" />
                      {activeHire.assignedBuddy}
                    </strong>
                  </div>
                </div>
              </Card>

              {/* Section 1: Compliance & Document Verification Checklist */}
              <Card className="p-5 bg-white border border-line space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-ink">
                      Compliance Documents & Agreements Verification
                    </h3>
                    <p className="text-xs text-ink-muted">
                      Review identity proofs, cancelled cheques, and signed legal agreements.
                    </p>
                  </div>
                  <span className="text-xs font-bold text-ink">
                    {activeHire.tasks.filter((t) => t.status === "VERIFIED").length} of {activeHire.tasks.length} Verified
                  </span>
                </div>

                <div className="divide-y divide-line/60">
                  {activeHire.tasks.map((task) => {
                    const isVerified = task.status === "VERIFIED";
                    const isSubmitted = task.status === "SUBMITTED";
                    const isRejected = task.status === "REJECTED";
                    const isPending = task.status === "PENDING";

                    return (
                      <div key={task.id} className="py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div
                            className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold ${
                              isVerified
                                ? "bg-emerald-100 text-emerald-800"
                                : isSubmitted
                                ? "bg-blue-100 text-blue-800"
                                : isRejected
                                ? "bg-red-100 text-red-800"
                                : "bg-gray-100 text-gray-500 border border-dashed border-gray-300"
                            }`}
                          >
                            {isVerified ? <Check size={14} /> : isSubmitted ? <Clock size={14} /> : <File size={14} />}
                          </div>

                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-ink">{task.title}</span>
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  isVerified
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : isSubmitted
                                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                                    : isRejected
                                    ? "bg-red-50 text-red-700 border border-red-200"
                                    : "bg-gray-50 text-gray-600 border border-gray-200"
                                }`}
                              >
                                {task.status}
                              </span>
                            </div>
                            <p className="text-[11px] text-ink-muted">{task.description}</p>
                            {task.submittedFile && (
                              <div className="flex items-center gap-2 pt-1 text-[11px] text-brand">
                                <File size={12} />
                                <span className="font-semibold underline cursor-pointer">{task.submittedFile}</span>
                                {task.submittedAt && (
                                  <span className="text-ink-muted">({task.submittedAt})</span>
                                )}
                              </div>
                            )}
                            {task.reviewerNote && (
                              <p className="text-[11px] text-red-600 pt-0.5 font-medium">
                                Review Note: {task.reviewerNote}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Action buttons per task */}
                        <div className="flex items-center gap-2 self-end md:self-center">
                          {!isVerified && (
                            <Button
                              variant="ghost"
                              onClick={() => handleVerifyTask(task.id)}
                              className="text-[11px] font-bold text-emerald-700 hover:bg-emerald-50 border border-emerald-300 px-2 py-1 h-7"
                            >
                              <Check size={12} />
                              <span>Verify & Approve</span>
                            </Button>
                          )}

                          {!isVerified && !isRejected && (
                            <Button
                              variant="ghost"
                              onClick={() => handleRejectTask(task.id)}
                              className="text-[11px] font-bold text-red-700 hover:bg-red-50 border border-red-300 px-2 py-1 h-7"
                            >
                              <X size={12} />
                              <span>Request Re-upload</span>
                            </Button>
                          )}

                          {isVerified && (
                            <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                              <Check size={12} />
                              Verified by HR
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* Bottom Action: Final Transition to Completed */}
              <div className="flex items-center justify-between p-4 rounded-xl border border-line bg-white">
                <div>
                  <h4 className="text-xs font-bold text-ink">Finalize Onboarding Progression</h4>
                  <p className="text-[11px] text-ink-muted">
                    When all compliance tasks are verified and hardware is handed over, mark candidate as Active Employee.
                  </p>
                </div>

                {activeHire.status !== "COMPLETED" ? (
                  <Button
                    variant="primary"
                    onClick={() => handleMarkCompleted(activeHire.id)}
                    className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    ✓ Complete Onboarding & Activate
                  </Button>
                ) : (
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                    ✓ Onboarding Completed
                  </span>
                )}
              </div>
            </div>
          ) : (
            <Card className="p-12 text-center bg-white border border-line">
              <p className="text-sm font-semibold text-ink">Select a candidate on the left to view onboarding details</p>
            </Card>
          )}
        </div>
      </div>

      {/* Enroll New Hire Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-line space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="text-base font-bold text-ink">Enroll New Hire into Onboarding</h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-ink-muted hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-ink block mb-1">Select Candidate / Application</label>
                <select
                  value={newHireCandidateId}
                  onChange={(e) => setNewHireCandidateId(e.target.value)}
                  className="w-full rounded-lg border border-line p-2 text-xs bg-canvas"
                >
                  <option value="">-- Choose from existing applications or manual --</option>
                  {applications.map((app) => (
                    <option key={app.id} value={app.id}>
                      {app.candidateName || app.email} ({app.jobTitle} - {app.stage})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-ink block mb-1">Target Start Date</label>
                <input
                  type="date"
                  value={newHireStartDate}
                  onChange={(e) => setNewHireStartDate(e.target.value)}
                  className="w-full rounded-lg border border-line p-2 text-xs"
                >
                </input>
              </div>

              <div>
                <label className="font-semibold text-ink block mb-1">Assigned Onboarding Buddy / Mentor</label>
                <input
                  type="text"
                  value={newHireBuddy}
                  onChange={(e) => setNewHireBuddy(e.target.value)}
                  className="w-full rounded-lg border border-line p-2 text-xs"
                />
              </div>

              <div>
                <label className="font-semibold text-ink block mb-1">Assigned Laptop Model</label>
                <input
                  type="text"
                  value={newHireLaptop}
                  onChange={(e) => setNewHireLaptop(e.target.value)}
                  className="w-full rounded-lg border border-line p-2 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
              <Button variant="ghost" onClick={() => setIsAddModalOpen(false)} className="text-xs">
                Cancel
              </Button>
              <Button variant="primary" onClick={handleCreateNewHire} className="text-xs font-semibold">
                Enroll Candidate
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
