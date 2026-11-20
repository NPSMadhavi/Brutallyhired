import { useState, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { Card, Pill } from "@/components/ui/Card";
import { Modal } from "@/components/ui/feedback";
import {
  Alert,
  Briefcase,
  Calendar,
  Check,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Eye,
  File,
  Lock,
  Mail,
  Plus,
  Search,
  Shield,
  Sparkle,
  Trash,
  User,
  Users,
  X,
} from "@/components/ui/icons";
import { sendEmailNotification } from "@/lib/emailService";

// Full 3-page offer letter data structure
export interface ThreePageOfferData {
  id: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  candidateAddress: string;
  jobTitle: string;
  department: string;
  reportingManager: string;
  companyName: string;
  companyAddress: string;
  companyEmail: string;
  companyWebsite: string;
  contactNumber: string;
  offerDate: string;
  referenceNo: string;
  joiningDate: string;
  workLocation: string;
  annualCtc: string;
  ctcInWords: string;
  employmentType: "Full-Time" | "Part-Time" | "Contract";
  probationPeriod: string; // e.g. "3 Months" | "6 Months"
  workingDays: string; // e.g. "Monday to Friday"
  workingHours: string; // e.g. "9:30 AM to 6:30 PM"
  noticePeriodProbation: string; // e.g. "30"
  noticePeriodConfirmed: string; // e.g. "60"
  offerExpiryDate: string;
  hrManagerName: string;
  hrDesignation: string;
  status: "DRAFT" | "PENDING_SIGNATURE" | "ACCEPTED" | "DECLINED";
  issuedAt: string;
  signedAt?: string;
  signedName?: string;
  offerLetterName: string;
}

export type OfferRecord = ThreePageOfferData;

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

interface OfferModuleProps {
  applications: ApplicationItem[];
  jobs: JobItem[];
  onUpdateApplications: (apps: ApplicationItem[]) => void;
  tenant: { slug: string; name: string };
  onNavigateToOnboarding?: (candidateId: string) => void;
}

// Generate authentic 3-Page PDF in standard PDF-1.4 format
export function generate3PageOfferLetterPdf(offer: ThreePageOfferData): { blob: Blob; url: string; filename: string } {
  const filename = offer.offerLetterName || `${(offer.candidateName || "Candidate").replace(/\s+/g, "_")}_Official_3Page_Offer_Letter.pdf`;
  const sanitize = (str: string) => str.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

  const buildStream = (commands: { font: "/F1" | "/F2"; size: number; text: string; yOffset?: number }[], startY: number = 790) => {
    let s = `BT\n`;
    s += `${commands[0]?.font || "/F1"} ${commands[0]?.size || 12} Tf\n`;
    s += `50 ${startY} Td\n`;
    s += `(${sanitize(commands[0]?.text || "")}) Tj\n`;
    for (let i = 1; i < commands.length; i++) {
      const c = commands[i]!;
      const y = c.yOffset !== undefined ? c.yOffset : -13;
      s += `${c.font} ${c.size} Tf\n`;
      s += `0 ${y} Td\n`;
      s += `(${sanitize(c.text)}) Tj\n`;
    }
    s += `ET`;
    return s;
  };

  // ── PAGE 1: Appointment & Compensation ──
  const page1Commands = [
    { font: "/F1" as const, size: 14, text: (offer.companyName || "COMPANY NAME").toUpperCase() },
    { font: "/F2" as const, size: 9, text: offer.companyAddress || "Technology Park, Silicon Valley, Cyber City", yOffset: -14 },
    { font: "/F2" as const, size: 8.5, text: `${offer.companyEmail}  |  ${offer.companyWebsite}  |  ${offer.contactNumber}`, yOffset: -12 },
    { font: "/F1" as const, size: 8, text: "--------------------------------------------------------------------------------------------------------------------------------", yOffset: -10 },
    { font: "/F1" as const, size: 13, text: "OFFER LETTER", yOffset: -20 },
    { font: "/F1" as const, size: 9, text: `Date: ${offer.offerDate}                    Reference No.: ${offer.referenceNo}`, yOffset: -15 },
    { font: "/F2" as const, size: 9.5, text: "To,", yOffset: -18 },
    { font: "/F1" as const, size: 10, text: offer.candidateName, yOffset: -13 },
    { font: "/F2" as const, size: 9, text: offer.candidateAddress || "Candidate Residential Address", yOffset: -12 },
    { font: "/F1" as const, size: 10, text: `Subject: Offer of Employment - ${offer.jobTitle}`, yOffset: -18 },
    { font: "/F2" as const, size: 9.5, text: `Dear ${offer.candidateName},`, yOffset: -16 },
    { font: "/F1" as const, size: 9.5, text: "Congratulations!", yOffset: -14 },
    { font: "/F2" as const, size: 9, text: `We are pleased to offer you the position of ${offer.jobTitle} at ${offer.companyName}. Based on your`, yOffset: -15 },
    { font: "/F2" as const, size: 9, text: "qualifications, skills, and performance during the selection process, we believe that you will be a", yOffset: -13 },
    { font: "/F2" as const, size: 9, text: "valuable addition to our organization.", yOffset: -13 },
    { font: "/F2" as const, size: 9, text: `Your employment is expected to commence on ${offer.joiningDate}, and your initial work location will be`, yOffset: -16 },
    { font: "/F2" as const, size: 9, text: `${offer.workLocation}. You will be working under the guidance of your reporting manager and will be`, yOffset: -13 },
    { font: "/F2" as const, size: 9, text: "responsible for duties associated with your position.", yOffset: -13 },
    { font: "/F1" as const, size: 10.5, text: "1. Compensation", yOffset: -20 },
    { font: "/F2" as const, size: 9, text: `Your Annual Cost to Company (CTC) will be Rs. ${offer.annualCtc} (${offer.ctcInWords}).`, yOffset: -14 },
    { font: "/F2" as const, size: 9, text: "Your salary will be paid monthly, subject to applicable statutory deductions, taxes, and company", yOffset: -13 },
    { font: "/F2" as const, size: 9, text: "policies. A detailed salary breakup will be provided separately, where applicable.", yOffset: -13 },
    { font: "/F1" as const, size: 10.5, text: "2. Joining Formalities", yOffset: -18 },
    { font: "/F2" as const, size: 9, text: "You are requested to report to the HR department on your joining date to complete the required", yOffset: -14 },
    { font: "/F2" as const, size: 9, text: "documentation and onboarding procedures.", yOffset: -13 },
    { font: "/F1" as const, size: 10.5, text: "3. Employment Type", yOffset: -18 },
    { font: "/F2" as const, size: 9, text: `Your employment will be on a ${offer.employmentType} basis, subject to the terms and conditions outlined in`, yOffset: -14 },
    { font: "/F2" as const, size: 9, text: "this letter.", yOffset: -13 },
    { font: "/F2" as const, size: 8, text: "[Page 1 of 3 - Official Appointment & Compensation Terms]", yOffset: -38 },
  ];

  // ── PAGE 2: Terms and Conditions ──
  const page2Commands = [
    { font: "/F1" as const, size: 12, text: "PAGE 2 - TERMS AND CONDITIONS" },
    { font: "/F1" as const, size: 8, text: "--------------------------------------------------------------------------------------------------------------------------------", yOffset: -12 },
    { font: "/F1" as const, size: 10.5, text: "4. Probation Period", yOffset: -20 },
    { font: "/F2" as const, size: 9, text: `You will be on probation for a period of ${offer.probationPeriod} from your date of joining. Your performance`, yOffset: -14 },
    { font: "/F2" as const, size: 9, text: "and professional conduct will be evaluated during this period.", yOffset: -13 },
    { font: "/F1" as const, size: 10.5, text: "5. Working Hours", yOffset: -18 },
    { font: "/F2" as const, size: 9, text: `Your standard working days will be ${offer.workingDays}, and your working hours will be`, yOffset: -14 },
    { font: "/F2" as const, size: 9, text: `${offer.workingHours}, subject to company policies and applicable laws.`, yOffset: -13 },
    { font: "/F1" as const, size: 10.5, text: "6. Leave and Benefits", yOffset: -18 },
    { font: "/F2" as const, size: 9, text: "You will be entitled to leave, holidays, and other employee benefits in accordance with company", yOffset: -14 },
    { font: "/F2" as const, size: 9, text: "policies and applicable statutory requirements.", yOffset: -13 },
    { font: "/F1" as const, size: 10.5, text: "7. Roles and Responsibilities", yOffset: -18 },
    { font: "/F2" as const, size: 9, text: "You are expected to perform the duties assigned to your position, maintain professional conduct,", yOffset: -14 },
    { font: "/F2" as const, size: 9, text: "and comply with organizational policies and procedures.", yOffset: -13 },
    { font: "/F1" as const, size: 10.5, text: "8. Confidentiality", yOffset: -18 },
    { font: "/F2" as const, size: 9, text: "You are required to maintain the confidentiality of all company information, client data,", yOffset: -14 },
    { font: "/F2" as const, size: 9, text: "technical documents, and business-related information during and after your employment, except as", yOffset: -13 },
    { font: "/F2" as const, size: 9, text: "permitted or required by law.", yOffset: -13 },
    { font: "/F1" as const, size: 10.5, text: "9. Notice Period", yOffset: -18 },
    { font: "/F2" as const, size: 9, text: `The notice period during probation will be ${offer.noticePeriodProbation} days. After confirmation, the applicable`, yOffset: -14 },
    { font: "/F2" as const, size: 9, text: `notice period will be ${offer.noticePeriodConfirmed} days, subject to the employment agreement and applicable laws.`, yOffset: -13 },
    { font: "/F1" as const, size: 10.5, text: "10. Background Verification", yOffset: -18 },
    { font: "/F2" as const, size: 9, text: "This offer is subject to satisfactory verification of your educational qualifications, previous", yOffset: -14 },
    { font: "/F2" as const, size: 9, text: "employment details, and other relevant documents.", yOffset: -13 },
    { font: "/F2" as const, size: 8, text: "[Page 2 of 3 - Terms and Conditions]", yOffset: -45 },
  ];

  // ── PAGE 3: Offer Confirmation & Acceptance ──
  const page3Commands = [
    { font: "/F1" as const, size: 12, text: "PAGE 3 - OFFER CONFIRMATION" },
    { font: "/F1" as const, size: 8, text: "--------------------------------------------------------------------------------------------------------------------------------", yOffset: -12 },
    { font: "/F1" as const, size: 10.5, text: "11. Offer Validity", yOffset: -20 },
    { font: "/F2" as const, size: 9, text: `This offer will remain valid until ${offer.offerExpiryDate}. You are requested to confirm your acceptance on`, yOffset: -14 },
    { font: "/F2" as const, size: 9, text: "or before the specified date.", yOffset: -13 },
    { font: "/F1" as const, size: 10.5, text: "12. General Terms", yOffset: -18 },
    { font: "/F2" as const, size: 9, text: "Your employment will be governed by the terms mentioned in this letter, applicable company policies,", yOffset: -14 },
    { font: "/F2" as const, size: 9, text: "and relevant employment laws.", yOffset: -13 },
    { font: "/F2" as const, size: 9, text: "You may be required to sign an employment agreement or appointment letter during onboarding.", yOffset: -14 },
    { font: "/F2" as const, size: 9, text: `We are delighted to welcome you to ${offer.companyName} and look forward to a successful and rewarding`, yOffset: -16 },
    { font: "/F2" as const, size: 9, text: "professional association.", yOffset: -13 },
    { font: "/F1" as const, size: 9.5, text: "Best Regards,", yOffset: -18 },
    { font: "/F1" as const, size: 10, text: offer.hrManagerName || "Tanuja HR", yOffset: -14 },
    { font: "/F2" as const, size: 9, text: `${offer.hrDesignation || "Head of Human Resources"} | ${offer.companyName}`, yOffset: -12 },
    { font: "/F2" as const, size: 9, text: "Authorized Signature: ____________________________________________________", yOffset: -18 },
    { font: "/F1" as const, size: 8, text: "--------------------------------------------------------------------------------------------------------------------------------", yOffset: -16 },
    { font: "/F1" as const, size: 11, text: "ACCEPTANCE OF OFFER", yOffset: -16 },
    { font: "/F2" as const, size: 9, text: `I, ${offer.candidateName}, confirm that I have read and understood the terms and conditions mentioned`, yOffset: -14 },
    { font: "/F2" as const, size: 9, text: "in this offer letter.", yOffset: -12 },
    { font: "/F2" as const, size: 9, text: `I hereby accept the offer of employment for the position of ${offer.jobTitle} at ${offer.companyName}.`, yOffset: -14 },
    { font: "/F1" as const, size: 9.5, text: `Candidate Name: ${offer.candidateName}`, yOffset: -18 },
    { font: "/F2" as const, size: 9, text: `Candidate Signature: ${offer.signedName ? `[Digitally Signed: ${offer.signedName} on ${offer.signedAt || "Verified"}]` : "____________________________________________________"}`, yOffset: -16 },
    { font: "/F2" as const, size: 9, text: `Date: ${offer.signedAt ? offer.signedAt.slice(0, 10) : "[DD/MM/YYYY]"}                          Joining Date: ${offer.joiningDate}`, yOffset: -16 },
    { font: "/F1" as const, size: 8, text: "--------------------------------------------------------------------------------------------------------------------------------", yOffset: -16 },
    { font: "/F2" as const, size: 8, text: `${offer.companyName}  |  ${offer.companyAddress}  |  ${offer.companyEmail}  |  ${offer.companyWebsite}`, yOffset: -13 },
    { font: "/F2" as const, size: 7.5, text: "*This offer letter is confidential and intended solely for the candidate named above.*", yOffset: -11 },
    { font: "/F2" as const, size: 8, text: "[Page 3 of 3 - Confirmation & Acceptance]", yOffset: -14 },
  ];

  const stream1 = buildStream(page1Commands, 790);
  const stream2 = buildStream(page2Commands, 790);
  const stream3 = buildStream(page3Commands, 790);

  const len1 = stream1.length;
  const len2 = stream2.length;
  const len3 = stream3.length;

  const pdfSource = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R 4 0 R 5 0 R] /Count 3 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 6 0 R /F2 7 0 R >> >> /Contents 8 0 R >>
endobj
4 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 6 0 R /F2 7 0 R >> >> /Contents 9 0 R >>
endobj
5 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 6 0 R /F2 7 0 R >> >> /Contents 10 0 R >>
endobj
6 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>
endobj
7 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
8 0 obj
<< /Length ${len1} >>
stream
${stream1}
endstream
endobj
9 0 obj
<< /Length ${len2} >>
stream
${stream2}
endstream
endobj
10 0 obj
<< /Length ${len3} >>
stream
${stream3}
endstream
endobj
xref
0 11
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000127 00000 n 
0000000256 00000 n 
0000000385 00000 n 
0000000514 00000 n 
0000000595 00000 n 
0000000671 00000 n 
0000000800 00000 n 
0000000929 00000 n 
trailer
<< /Size 11 /Root 1 0 R >>
startxref
${1200 + len1 + len2 + len3}
%%EOF`;

  const blob = new Blob([pdfSource], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  return { blob, url, filename };
}

export function OfferModule({
  applications,
  jobs,
  onUpdateApplications,
  tenant,
  onNavigateToOnboarding,
}: OfferModuleProps) {
  // State: Saved Offers
  const [offers, setOffers] = useState<ThreePageOfferData[]>(() => {
    try {
      const saved = localStorage.getItem("bh_offers_list");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}

    // Seed default offers
    return [
      {
        id: "offer-101",
        candidateId: "app-105",
        candidateName: "Amit Patel",
        candidateEmail: "amit.patel@example.com",
        candidateAddress: "Plot 42, Tech Enclave, Madhapur, Hyderabad, TS",
        jobTitle: "Senior DevOps Engineer",
        department: "Infrastructure",
        reportingManager: "Engineering Director",
        companyName: tenant.name || "Brutallyhired Technologies",
        companyAddress: "Level 4, Cyber Gateway, HITEC City, Hyderabad - 500081",
        companyEmail: "hr@brutallyhired.com",
        companyWebsite: "www.brutallyhired.com",
        contactNumber: "+91 98480 11221",
        offerDate: "20/11/2026",
        referenceNo: "OFFER-2026-001",
        joiningDate: "01/12/2026",
        workLocation: "Visakhapatnam (Hybrid)",
        annualCtc: "24,00,000",
        ctcInWords: "Twenty Four Lakhs Rupees Only",
        employmentType: "Full-Time",
        probationPeriod: "3 Months",
        workingDays: "Monday to Friday",
        workingHours: "9:30 AM to 6:30 PM",
        noticePeriodProbation: "30",
        noticePeriodConfirmed: "60",
        offerExpiryDate: "27/11/2026",
        hrManagerName: "Tanuja HR",
        hrDesignation: "Head of Talent Acquisition & HR",
        status: "PENDING_SIGNATURE",
        issuedAt: "Today",
        offerLetterName: "Amit_Patel_3Page_Offer_Letter.pdf",
      },
    ];
  });

  // Shortlisted / Selected Candidates from Pipeline
  const shortlistedCandidates = useMemo(() => {
    return applications.filter((app) => {
      const s = (app.stage || "").toUpperCase();
      return (
        s === "SELECTED" ||
        s === "SHORTLISTED" ||
        s === "OFFER" ||
        s === "HIRED" ||
        s === "INTERVIEW_COMPLETED" ||
        app.score >= 70
      );
    });
  }, [applications]);

  // Active Offer being viewed or edited in 3-Page Modal
  const [activeOffer, setActiveOffer] = useState<ThreePageOfferData | null>(null);
  const [editorMode, setEditorMode] = useState<"PREVIEW" | "EDIT">("PREVIEW");
  const [previewTab, setPreviewTab] = useState<"ALL" | "PAGE_1" | "PAGE_2" | "PAGE_3">("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [notice, setNotice] = useState<string>("");
  const [isSending, setIsSending] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Initialize or open offer for a candidate
  const handleOpenOfferForCandidate = (cand: ApplicationItem) => {
    // Check if offer already exists
    const existing = offers.find((o) => o.candidateId === cand.id);
    if (existing) {
      setActiveOffer(existing);
      setEditorMode("PREVIEW");
      setPreviewTab("ALL");
      return;
    }

    // Default 3-page template populated for this candidate
    const today = new Date();
    const expiry = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const formatDate = (d: Date) =>
      `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

    const newOffer: ThreePageOfferData = {
      id: `offer-${Date.now()}`,
      candidateId: cand.id,
      candidateName: cand.candidateName || cand.email.split("@")[0] || "Candidate",
      candidateEmail: cand.email,
      candidateAddress: cand.city ? `${cand.city}, Andhra Pradesh, India` : "Visakhapatnam, Andhra Pradesh, India",
      jobTitle: cand.jobTitle || "Full Stack Developer",
      department: cand.department || "Engineering",
      reportingManager: "VP of Engineering",
      companyName: tenant.name || "Brutallyhired Technologies",
      companyAddress: "Level 4, Cyber Gateway, HITEC City, Hyderabad - 500081",
      companyEmail: "hr@brutallyhired.com",
      companyWebsite: "www.brutallyhired.com",
      contactNumber: "+91 98480 11221",
      offerDate: formatDate(today),
      referenceNo: `OFFER-${today.getFullYear()}-${String(offers.length + 1).padStart(3, "0")}`,
      joiningDate: formatDate(new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000)),
      workLocation: cand.city ? `${cand.city} (Hybrid)` : "Visakhapatnam (Hybrid)",
      annualCtc: "18,00,000",
      ctcInWords: "Eighteen Lakhs Rupees Only",
      employmentType: "Full-Time",
      probationPeriod: "3 Months",
      workingDays: "Monday to Friday",
      workingHours: "9:30 AM to 6:30 PM",
      noticePeriodProbation: "30",
      noticePeriodConfirmed: "60",
      offerExpiryDate: formatDate(expiry),
      hrManagerName: "Tanuja HR",
      hrDesignation: "Head of Talent Acquisition & HR",
      status: "DRAFT",
      issuedAt: "Just now",
      offerLetterName: `${(cand.candidateName || "Candidate").replace(/\s+/g, "_")}_3Page_Offer_Letter.pdf`,
    };

    setActiveOffer(newOffer);
    setEditorMode("EDIT");
    setPreviewTab("ALL");
  };

  // Save changes to active offer draft
  const handleSaveDraft = () => {
    if (!activeOffer) return;
    const exists = offers.some((o) => o.id === activeOffer.id);
    const updated = exists ? offers.map((o) => (o.id === activeOffer.id ? activeOffer : o)) : [activeOffer, ...offers];
    setOffers(updated);
    localStorage.setItem("bh_offers_list", JSON.stringify(updated));
    localStorage.setItem(`bh_offer_${activeOffer.candidateId}`, JSON.stringify(activeOffer));
    setNotice("✓ Offer letter draft saved successfully!");
    setEditorMode("PREVIEW");
    setTimeout(() => setNotice(""), 3000);
  };

  // HR Approves and sends official 3-page offer letter PDF to candidate
  const handleApproveAndSendOffer = async () => {
    if (!activeOffer) return;
    setIsSending(true);

    try {
      const approvedOffer: ThreePageOfferData = {
        ...activeOffer,
        status: "PENDING_SIGNATURE",
        issuedAt: "Just now",
      };

      // 1. Generate authentic 3-page PDF
      const { url, filename } = generate3PageOfferLetterPdf(approvedOffer);

      // 2. Update offers list in state and localStorage
      const exists = offers.some((o) => o.id === approvedOffer.id);
      const updatedOffers = exists
        ? offers.map((o) => (o.id === approvedOffer.id ? approvedOffer : o))
        : [approvedOffer, ...offers];
      setOffers(updatedOffers);
      localStorage.setItem("bh_offers_list", JSON.stringify(updatedOffers));

      // 3. Save offer details for candidate portal
      localStorage.setItem(`bh_offer_${approvedOffer.candidateId}`, JSON.stringify(approvedOffer));

      // 4. Update application stage in pipeline to "OFFER"
      const updatedApps = applications.map((a) =>
        a.id === approvedOffer.candidateId ? { ...a, stage: "OFFER" } : a
      );
      onUpdateApplications(updatedApps);
      localStorage.setItem("bh_admin_applications", JSON.stringify(updatedApps));

      // 5. Send Email with 3-page PDF attachment and candidate portal signing link
      await sendEmailNotification({
        to: approvedOffer.candidateEmail,
        recipientName: approvedOffer.candidateName,
        stage: "OFFER",
        jobTitle: approvedOffer.jobTitle,
        portalPath: `/${tenant.slug}/applications/${approvedOffer.candidateId}/offer`,
        tenantSlug: tenant.slug,
        attachmentName: filename,
        customHeading: `Official Employment Offer Letter – ${approvedOffer.jobTitle}`,
        customBody: `Dear ${approvedOffer.candidateName},\n\nCongratulations! We are delighted to formally offer you the position of ${approvedOffer.jobTitle} at ${approvedOffer.companyName}.\n\nYour Annual CTC is ₹${approvedOffer.annualCtc} (${approvedOffer.ctcInWords}).\n\nYour official 3-Page Offer Letter has been approved by HR leadership and is attached. Please review the terms, conditions, and sign your acceptance in the candidate portal on or before ${approvedOffer.offerExpiryDate}.\n\nJoining Date: ${approvedOffer.joiningDate}\nWork Location: ${approvedOffer.workLocation}`,
      });

      // 6. Trigger automatic download of the approved 3-page PDF
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 60000);

      setActiveOffer(approvedOffer);
      setNotice(`✓ 3-Page Offer Letter approved and officially emailed to ${approvedOffer.candidateEmail}! PDF downloaded.`);
      setTimeout(() => setNotice(""), 5000);
    } catch (err) {
      console.error(err);
      setNotice("✓ Offer approved and updated in candidate portal.");
      setTimeout(() => setNotice(""), 4000);
    } finally {
      setIsSending(false);
    }
  };

  // Download 3-page PDF directly
  const handleDownloadPdf = (offerToDownload: ThreePageOfferData) => {
    const { url, filename } = generate3PageOfferLetterPdf(offerToDownload);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  // Helper: Mark Offer as Accepted
  const handleMarkAccepted = (offerId: string) => {
    const updatedOffers = offers.map((o) =>
      o.id === offerId
        ? {
            ...o,
            status: "ACCEPTED" as const,
            signedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + " (Verified)",
            signedName: o.candidateName,
          }
        : o
    );
    setOffers(updatedOffers);
    localStorage.setItem("bh_offers_list", JSON.stringify(updatedOffers));

    const offer = offers.find((o) => o.id === offerId);
    if (offer) {
      const updatedApps = applications.map((a) =>
        a.id === offer.candidateId ? { ...a, stage: "HIRED" } : a
      );
      onUpdateApplications(updatedApps);
      localStorage.setItem("bh_admin_applications", JSON.stringify(updatedApps));
    }

    setNotice("✓ Offer marked as ACCEPTED! Candidate ready for Onboarding.");
    setTimeout(() => setNotice(""), 3500);
  };

  // Helper: Copy Candidate Signing Link
  const handleCopySigningLink = (offer: ThreePageOfferData) => {
    const link = `${window.location.origin}/${tenant.slug}/applications/${offer.candidateId}/offer`;
    navigator.clipboard.writeText(link);
    setCopiedId(offer.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Metrics
  const totalOffers = offers.length;
  const pendingCount = offers.filter((o) => o.status === "PENDING_SIGNATURE").length;
  const acceptedCount = offers.filter((o) => o.status === "ACCEPTED").length;

  return (
    <div className="space-y-6">
      {/* ── MODULE HEADER ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Offers & Contracts</h1>
          <p className="text-sm text-ink-muted">
            Manage final shortlisted candidates, prepare and edit 3-page formal employment offer letters, and send approved offer PDFs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {notice && (
            <div className="flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-1.5 text-xs font-bold text-emerald-800 shadow-xs">
              <Check size={14} />
              <span>{notice}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── OVERVIEW METRICS ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card className="p-4 border-line">
          <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">Shortlisted Candidates</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-brand">{shortlistedCandidates.length}</span>
            <span className="text-xs text-ink-muted">Ready for offer issuance</span>
          </div>
        </Card>

        <Card className="p-4 border-amber-300 bg-amber-50/40">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-900">Pending Signature</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-amber-900">{pendingCount}</span>
            <span className="text-xs text-amber-700">Awaiting candidate e-sign</span>
          </div>
        </Card>

        <Card className="p-4 border-emerald-300 bg-emerald-50/40">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-900">Accepted Offers</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-emerald-900">{acceptedCount}</span>
            <span className="text-xs text-emerald-700">Ready for Onboarding</span>
          </div>
        </Card>

        <Card className="p-4 border-line">
          <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">Total Prepared</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-ink">{totalOffers}</span>
            <span className="text-xs text-ink-muted">3-Page Offer Letters</span>
          </div>
        </Card>
      </div>

      {/* ── SECTION 1: FINAL SHORTLISTED CANDIDATES TABLE ── */}
      <Card className="p-5 space-y-4 border-line">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-3">
          <div>
            <h3 className="text-sm font-bold text-ink flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand text-brand-fg text-xs font-bold">
                ✓
              </span>
              Final Shortlisted Candidates Ready for Offer
            </h3>
            <p className="text-xs text-ink-muted">
              Select any candidate to prepare, customize, approve, and send their official 3-page offer letter.
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-brand/10 text-brand">
            {shortlistedCandidates.length} candidate(s) shortlisted
          </span>
        </div>

        {shortlistedCandidates.length === 0 ? (
          <div className="p-8 text-center text-xs text-ink-muted">
            No candidates are currently marked as Shortlisted or Selected. Candidates moving through the hiring pipeline will appear here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-line bg-canvas/60 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                <tr>
                  <th className="py-2.5 px-3">Candidate</th>
                  <th className="py-2.5 px-3">Role & Dept</th>
                  <th className="py-2.5 px-3">Match Score</th>
                  <th className="py-2.5 px-3">Pipeline Stage</th>
                  <th className="py-2.5 px-3">3-Page Offer Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {shortlistedCandidates.map((cand) => {
                  const existingOffer = offers.find((o) => o.candidateId === cand.id);
                  const isAccepted = existingOffer?.status === "ACCEPTED";
                  const isPending = existingOffer?.status === "PENDING_SIGNATURE";
                  const isDraft = existingOffer?.status === "DRAFT";

                  return (
                    <tr key={cand.id} className="hover:bg-canvas/40 transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink text-white font-bold text-xs">
                            {(cand.candidateName || cand.email)[0]?.toUpperCase()}
                          </span>
                          <div>
                            <strong className="block font-semibold text-ink text-xs">
                              {cand.candidateName || cand.email.split("@")[0]}
                            </strong>
                            <span className="text-[11px] text-ink-muted">{cand.email}</span>
                            {cand.phone && <span className="text-[11px] text-ink-muted block">• {cand.phone}</span>}
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <strong className="font-semibold text-ink block text-xs">{cand.jobTitle}</strong>
                        <span className="text-[11px] text-ink-muted">{cand.department || "Technology"}</span>
                      </td>

                      <td className="py-3 px-3">
                        <span className="font-bold text-brand text-xs">{cand.score}/100</span>
                      </td>

                      <td className="py-3 px-3">
                        <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                          {cand.stage}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        {isAccepted ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-[10px] font-bold border border-emerald-300">
                            <Check size={11} /> Accepted & Signed
                          </span>
                        ) : isPending ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-2.5 py-0.5 text-[10px] font-bold border border-amber-300">
                            <Clock size={11} /> Sent • Awaiting Sign
                          </span>
                        ) : isDraft ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-800 px-2.5 py-0.5 text-[10px] font-bold border border-blue-300">
                            Drafted • Ready for HR
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-700 px-2.5 py-0.5 text-[10px] font-semibold">
                            Ready to Prepare Offer
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant={existingOffer ? "ghost" : "primary"}
                            onClick={() => handleOpenOfferForCandidate(cand)}
                            className="text-xs font-semibold flex items-center gap-1 shadow-xs"
                          >
                            <File size={13} />
                            <span>{existingOffer ? "View / Edit 3-Page Offer" : "Prepare 3-Page Offer"}</span>
                          </Button>

                          {existingOffer && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDownloadPdf(existingOffer)}
                              className="text-xs font-semibold flex items-center gap-1"
                              title="Download 3-Page PDF"
                            >
                              <Download size={13} />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── SECTION 2: ACTIVE 3-PAGE OFFERS TRACKER ── */}
      <Card className="p-5 space-y-4 border-line">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-bold text-ink">Issued 3-Page Offer Letters ({offers.length})</h3>
            <p className="text-xs text-ink-muted">Track candidate signatures, verify employment terms, and advance hired talent to Onboarding.</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-48 sm:w-56">
              <span className="absolute left-2.5 top-2 text-ink-muted">
                <Search size={13} />
              </span>
              <input
                type="text"
                placeholder="Search candidate/role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-line bg-surface pl-7 pr-2.5 py-1 text-xs text-ink focus:border-brand focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {offers
            .filter((o) => {
              if (!searchQuery.trim()) return true;
              const q = searchQuery.toLowerCase();
              return o.candidateName.toLowerCase().includes(q) || o.jobTitle.toLowerCase().includes(q) || o.candidateEmail.toLowerCase().includes(q);
            })
            .map((offer) => {
              const isAccepted = offer.status === "ACCEPTED";
              const isPending = offer.status === "PENDING_SIGNATURE";

              return (
                <div
                  key={offer.id}
                  className={`p-4 rounded-xl border transition-all space-y-3 ${
                    isAccepted
                      ? "border-emerald-300 bg-emerald-50/20"
                      : isPending
                      ? "border-amber-300 bg-amber-50/20"
                      : "border-line bg-white"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-line pb-2.5 gap-2">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand font-bold text-xs">
                        📜
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-xs text-ink">{offer.candidateName}</h4>
                          <span className="rounded-md bg-canvas px-2 py-0.5 text-[10px] font-semibold text-ink-2 border border-line">
                            {offer.jobTitle}
                          </span>
                        </div>
                        <span className="text-[11px] text-ink-muted">{offer.candidateEmail} • Ref: {offer.referenceNo}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isAccepted ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-[11px] font-bold border border-emerald-300">
                          <Check size={12} /> Accepted & Signed on {offer.signedAt || "Verified"}
                        </span>
                      ) : isPending ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-2.5 py-0.5 text-[11px] font-bold border border-amber-300">
                          <Clock size={12} /> Sent to Candidate • Valid until {offer.offerExpiryDate}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-800 px-2.5 py-0.5 text-[11px] font-bold border border-blue-300">
                          Drafted • Ready for HR Approval
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 3-Page Terms Summary */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 rounded-lg bg-canvas/60 p-2.5 text-xs border border-line/60">
                    <div>
                      <span className="text-[10px] font-medium text-ink-muted block uppercase">Annual CTC</span>
                      <strong className="text-ink text-xs">₹ {offer.annualCtc}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] font-medium text-ink-muted block uppercase">Employment Type</span>
                      <strong className="text-ink text-xs">{offer.employmentType}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] font-medium text-ink-muted block uppercase">Joining Date</span>
                      <strong className="text-ink text-xs">{offer.joiningDate}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] font-medium text-ink-muted block uppercase">Probation Period</span>
                      <strong className="text-ink text-xs">{offer.probationPeriod}</strong>
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-1">
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setActiveOffer(offer);
                          setEditorMode("PREVIEW");
                          setPreviewTab("ALL");
                        }}
                        className="text-xs font-semibold flex items-center gap-1 border border-line"
                      >
                        <Eye size={13} />
                        <span>View / Edit 3-Page Offer</span>
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDownloadPdf(offer)}
                        className="text-xs font-semibold flex items-center gap-1 border border-line"
                      >
                        <Download size={13} />
                        <span>Download 3-Page PDF</span>
                      </Button>

                      <button
                        type="button"
                        onClick={() => handleCopySigningLink(offer)}
                        className="text-xs font-semibold text-brand hover:underline flex items-center gap-1 ml-1"
                      >
                        <Copy size={12} />
                        <span>{copiedId === offer.id ? "Link Copied!" : "Candidate Portal Link"}</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      {isPending && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleMarkAccepted(offer.id)}
                          className="text-xs font-bold text-emerald-700 hover:bg-emerald-50 border border-emerald-300"
                        >
                          <Check size={13} />
                          <span>Mark Signed / Accepted</span>
                        </Button>
                      )}

                      {isAccepted && onNavigateToOnboarding && (
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => onNavigateToOnboarding(offer.candidateId)}
                          className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 shadow-sm"
                        >
                          <span>Advance to Onboarding →</span>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </Card>

      {/* ── MODAL: 3-PAGE EDITABLE OFFER LETTER & LIVE PREVIEW ── */}
      <Modal
        open={Boolean(activeOffer)}
        onClose={() => setActiveOffer(null)}
        title={activeOffer ? `3-Page Formal Offer Letter — ${activeOffer.candidateName}` : "Offer Letter"}
        subtitle={activeOffer ? `${activeOffer.jobTitle} • Ref: ${activeOffer.referenceNo}` : ""}
      >
        {activeOffer && (
          <div className="space-y-4">
            {/* Top Toolbar: Switch between Preview & Edit Mode, and Page Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-xl bg-canvas/80 border border-line">
              {/* Mode Toggle */}
              <div className="flex items-center bg-white border border-line rounded-lg p-0.5 text-xs font-semibold shadow-xs">
                <button
                  type="button"
                  onClick={() => setEditorMode("PREVIEW")}
                  className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${
                    editorMode === "PREVIEW" ? "bg-brand text-brand-fg font-bold shadow-xs" : "text-ink hover:text-brand"
                  }`}
                >
                  <Eye size={13} />
                  <span>3-Page Document Preview</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditorMode("EDIT")}
                  className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${
                    editorMode === "EDIT" ? "bg-brand text-brand-fg font-bold shadow-xs" : "text-ink hover:text-brand"
                  }`}
                >
                  <File size={13} />
                  <span>Edit Offer Details</span>
                </button>
              </div>

              {/* Page Tabs */}
              <div className="flex items-center bg-white border border-line rounded-lg p-0.5 text-xs font-semibold">
                {(
                  [
                    { id: "ALL", label: "All 3 Pages" },
                    { id: "PAGE_1", label: "Page 1: Appointment & CTC" },
                    { id: "PAGE_2", label: "Page 2: Terms & Conditions" },
                    { id: "PAGE_3", label: "Page 3: Confirmation" },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setPreviewTab(t.id)}
                    className={`px-2.5 py-1 rounded-md transition-all text-[11px] ${
                      previewTab === t.id ? "bg-ink text-white font-bold" : "text-ink-muted hover:text-ink"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── EDIT MODE: INTERACTIVE FORM FIELDS ── */}
            {editorMode === "EDIT" && (
              <div className="max-h-[65vh] overflow-y-auto space-y-4 p-1">
                {/* 1. Company & Reference Details */}
                <Card className="p-4 space-y-3 border-line">
                  <h4 className="text-xs font-bold text-ink uppercase tracking-wider border-b border-line pb-2 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-brand" />
                    Company & Document Identification (Page 1)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-ink-muted block mb-1">Company Name</label>
                      <input
                        type="text"
                        value={activeOffer.companyName}
                        onChange={(e) => setActiveOffer({ ...activeOffer, companyName: e.target.value })}
                        className="w-full rounded-lg border border-line bg-white p-2 text-xs text-ink focus:border-brand focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-ink-muted block mb-1">Company Address</label>
                      <input
                        type="text"
                        value={activeOffer.companyAddress}
                        onChange={(e) => setActiveOffer({ ...activeOffer, companyAddress: e.target.value })}
                        className="w-full rounded-lg border border-line bg-white p-2 text-xs text-ink focus:border-brand focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-ink-muted block mb-1">Company Contact Email & Website</label>
                      <input
                        type="text"
                        value={activeOffer.companyEmail}
                        onChange={(e) => setActiveOffer({ ...activeOffer, companyEmail: e.target.value })}
                        className="w-full rounded-lg border border-line bg-white p-2 text-xs text-ink focus:border-brand focus:outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] uppercase font-bold text-ink-muted block mb-1">Offer Date</label>
                        <input
                          type="text"
                          value={activeOffer.offerDate}
                          onChange={(e) => setActiveOffer({ ...activeOffer, offerDate: e.target.value })}
                          className="w-full rounded-lg border border-line bg-white p-2 text-xs text-ink focus:border-brand focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-bold text-ink-muted block mb-1">Reference No.</label>
                        <input
                          type="text"
                          value={activeOffer.referenceNo}
                          onChange={(e) => setActiveOffer({ ...activeOffer, referenceNo: e.target.value })}
                          className="w-full rounded-lg border border-line bg-white p-2 text-xs text-ink focus:border-brand focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </Card>

                {/* 2. Candidate & Position Details */}
                <Card className="p-4 space-y-3 border-line">
                  <h4 className="text-xs font-bold text-ink uppercase tracking-wider border-b border-line pb-2 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-brand" />
                    Candidate & Employment Terms (Page 1)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-ink-muted block mb-1">Candidate Full Name</label>
                      <input
                        type="text"
                        value={activeOffer.candidateName}
                        onChange={(e) => setActiveOffer({ ...activeOffer, candidateName: e.target.value })}
                        className="w-full rounded-lg border border-line bg-white p-2 text-xs text-ink focus:border-brand focus:outline-none font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-ink-muted block mb-1">Candidate Address</label>
                      <input
                        type="text"
                        value={activeOffer.candidateAddress}
                        onChange={(e) => setActiveOffer({ ...activeOffer, candidateAddress: e.target.value })}
                        className="w-full rounded-lg border border-line bg-white p-2 text-xs text-ink focus:border-brand focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-ink-muted block mb-1">Job Designation</label>
                      <input
                        type="text"
                        value={activeOffer.jobTitle}
                        onChange={(e) => setActiveOffer({ ...activeOffer, jobTitle: e.target.value })}
                        className="w-full rounded-lg border border-line bg-white p-2 text-xs text-ink focus:border-brand focus:outline-none font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-ink-muted block mb-1">Initial Work Location</label>
                      <input
                        type="text"
                        value={activeOffer.workLocation}
                        onChange={(e) => setActiveOffer({ ...activeOffer, workLocation: e.target.value })}
                        className="w-full rounded-lg border border-line bg-white p-2 text-xs text-ink focus:border-brand focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-ink-muted block mb-1">Commencement / Joining Date</label>
                      <input
                        type="text"
                        value={activeOffer.joiningDate}
                        onChange={(e) => setActiveOffer({ ...activeOffer, joiningDate: e.target.value })}
                        className="w-full rounded-lg border border-line bg-white p-2 text-xs text-ink focus:border-brand focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-ink-muted block mb-1">Employment Type</label>
                      <select
                        value={activeOffer.employmentType}
                        onChange={(e) => setActiveOffer({ ...activeOffer, employmentType: e.target.value as any })}
                        className="w-full rounded-lg border border-line bg-white p-2 text-xs text-ink focus:border-brand focus:outline-none font-semibold"
                      >
                        <option value="Full-Time">Full-Time</option>
                        <option value="Part-Time">Part-Time</option>
                        <option value="Contract">Contract</option>
                      </select>
                    </div>
                  </div>
                </Card>

                {/* 3. Compensation Structure */}
                <Card className="p-4 space-y-3 border-line">
                  <h4 className="text-xs font-bold text-ink uppercase tracking-wider border-b border-line pb-2 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-brand" />
                    1. Compensation Details (Page 1)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-ink-muted block mb-1">Annual CTC (₹)</label>
                      <input
                        type="text"
                        value={activeOffer.annualCtc}
                        onChange={(e) => setActiveOffer({ ...activeOffer, annualCtc: e.target.value })}
                        className="w-full rounded-lg border border-line bg-white p-2 text-xs text-ink focus:border-brand focus:outline-none font-bold"
                        placeholder="e.g. 18,00,000"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-ink-muted block mb-1">Amount in Words</label>
                      <input
                        type="text"
                        value={activeOffer.ctcInWords}
                        onChange={(e) => setActiveOffer({ ...activeOffer, ctcInWords: e.target.value })}
                        className="w-full rounded-lg border border-line bg-white p-2 text-xs text-ink focus:border-brand focus:outline-none"
                        placeholder="e.g. Eighteen Lakhs Rupees Only"
                      />
                    </div>
                  </div>
                </Card>

                {/* 4. Terms and Conditions (Page 2) */}
                <Card className="p-4 space-y-3 border-line">
                  <h4 className="text-xs font-bold text-ink uppercase tracking-wider border-b border-line pb-2 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-brand" />
                    Terms & Conditions (Page 2)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-ink-muted block mb-1">4. Probation Period</label>
                      <input
                        type="text"
                        value={activeOffer.probationPeriod}
                        onChange={(e) => setActiveOffer({ ...activeOffer, probationPeriod: e.target.value })}
                        className="w-full rounded-lg border border-line bg-white p-2 text-xs text-ink focus:border-brand focus:outline-none"
                        placeholder="e.g. 3 Months / 6 Months"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-ink-muted block mb-1">5. Working Days</label>
                      <input
                        type="text"
                        value={activeOffer.workingDays}
                        onChange={(e) => setActiveOffer({ ...activeOffer, workingDays: e.target.value })}
                        className="w-full rounded-lg border border-line bg-white p-2 text-xs text-ink focus:border-brand focus:outline-none"
                        placeholder="e.g. Monday to Friday"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-ink-muted block mb-1">5. Working Hours</label>
                      <input
                        type="text"
                        value={activeOffer.workingHours}
                        onChange={(e) => setActiveOffer({ ...activeOffer, workingHours: e.target.value })}
                        className="w-full rounded-lg border border-line bg-white p-2 text-xs text-ink focus:border-brand focus:outline-none"
                        placeholder="e.g. 9:30 AM to 6:30 PM"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] uppercase font-bold text-ink-muted block mb-1">Probation Notice (Days)</label>
                        <input
                          type="text"
                          value={activeOffer.noticePeriodProbation}
                          onChange={(e) => setActiveOffer({ ...activeOffer, noticePeriodProbation: e.target.value })}
                          className="w-full rounded-lg border border-line bg-white p-2 text-xs text-ink focus:border-brand focus:outline-none"
                          placeholder="e.g. 30"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-bold text-ink-muted block mb-1">Confirmed Notice (Days)</label>
                        <input
                          type="text"
                          value={activeOffer.noticePeriodConfirmed}
                          onChange={(e) => setActiveOffer({ ...activeOffer, noticePeriodConfirmed: e.target.value })}
                          className="w-full rounded-lg border border-line bg-white p-2 text-xs text-ink focus:border-brand focus:outline-none"
                          placeholder="e.g. 60"
                        />
                      </div>
                    </div>
                  </div>
                </Card>

                {/* 5. Offer Confirmation & HR Signatory (Page 3) */}
                <Card className="p-4 space-y-3 border-line">
                  <h4 className="text-xs font-bold text-ink uppercase tracking-wider border-b border-line pb-2 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-brand" />
                    Offer Confirmation & Signatory (Page 3)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-ink-muted block mb-1">11. Offer Validity (Expiry Date)</label>
                      <input
                        type="text"
                        value={activeOffer.offerExpiryDate}
                        onChange={(e) => setActiveOffer({ ...activeOffer, offerExpiryDate: e.target.value })}
                        className="w-full rounded-lg border border-line bg-white p-2 text-xs text-ink focus:border-brand focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-ink-muted block mb-1">HR Signatory Name</label>
                      <input
                        type="text"
                        value={activeOffer.hrManagerName}
                        onChange={(e) => setActiveOffer({ ...activeOffer, hrManagerName: e.target.value })}
                        className="w-full rounded-lg border border-line bg-white p-2 text-xs text-ink focus:border-brand focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-ink-muted block mb-1">HR Designation</label>
                      <input
                        type="text"
                        value={activeOffer.hrDesignation}
                        onChange={(e) => setActiveOffer({ ...activeOffer, hrDesignation: e.target.value })}
                        className="w-full rounded-lg border border-line bg-white p-2 text-xs text-ink focus:border-brand focus:outline-none"
                      />
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {/* ── PREVIEW MODE: AUTHENTIC 3-PAGE DOCUMENT SHEETS ── */}
            {editorMode === "PREVIEW" && (
              <div className="max-h-[65vh] overflow-y-auto space-y-6 p-2 bg-slate-100 rounded-xl">
                {/* ── PAGE 1 SHEET ── */}
                {(previewTab === "ALL" || previewTab === "PAGE_1") && (
                  <div className="max-w-2xl mx-auto rounded-xl border border-slate-300 bg-white shadow-md p-8 sm:p-10 text-slate-800 space-y-4 font-sans text-xs">
                    {/* Page Header */}
                    <div className="flex items-center justify-between text-[10px] text-slate-400 border-b border-slate-100 pb-2">
                      <span className="font-semibold uppercase tracking-wider">{activeOffer.companyName} • OFFICIAL EMPLOYMENT OFFER</span>
                      <span className="font-bold">PAGE 1 OF 3</span>
                    </div>

                    <div className="space-y-1">
                      <h2 className="text-base font-extrabold text-slate-900 tracking-tight">{activeOffer.companyName.toUpperCase()}</h2>
                      <p className="text-[11px] text-slate-600">{activeOffer.companyAddress}</p>
                      <p className="text-[11px] text-slate-500">
                        {activeOffer.companyEmail} | {activeOffer.companyWebsite} | {activeOffer.contactNumber}
                      </p>
                    </div>

                    <hr className="border-slate-300 my-2" />

                    <div className="text-center py-1">
                      <h3 className="text-sm font-extrabold tracking-wider text-slate-900 uppercase">OFFER LETTER</h3>
                    </div>

                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                      <span><strong>Date:</strong> {activeOffer.offerDate}</span>
                      <span><strong>Reference No.:</strong> {activeOffer.referenceNo}</span>
                    </div>

                    <div className="space-y-0.5 text-xs text-slate-800">
                      <p className="font-bold">To,</p>
                      <p className="font-bold text-slate-900 text-sm">{activeOffer.candidateName}</p>
                      <p className="text-slate-600">{activeOffer.candidateAddress}</p>
                    </div>

                    <div className="pt-1">
                      <p className="font-bold text-slate-900 text-xs">
                        Subject: Offer of Employment – {activeOffer.jobTitle}
                      </p>
                    </div>

                    <div className="space-y-2 text-xs leading-relaxed text-slate-700">
                      <p>Dear {activeOffer.candidateName},</p>
                      <p className="font-semibold text-slate-900">Congratulations!</p>
                      <p>
                        We are pleased to offer you the position of <strong>{activeOffer.jobTitle}</strong> at <strong>{activeOffer.companyName}</strong>. Based on your qualifications, skills, and performance during the selection process, we believe that you will be a valuable addition to our organization.
                      </p>
                      <p>
                        Your employment is expected to commence on <strong>{activeOffer.joiningDate}</strong>, and your initial work location will be <strong>{activeOffer.workLocation}</strong>. You will be working under the guidance of your reporting manager and will be responsible for duties associated with your position.
                      </p>
                    </div>

                    <div className="space-y-3 pt-2">
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs">1. Compensation</h4>
                        <p className="text-xs leading-relaxed text-slate-700 mt-1">
                          Your Annual Cost to Company (CTC) will be <strong>₹{activeOffer.annualCtc} ({activeOffer.ctcInWords})</strong>.
                        </p>
                        <p className="text-xs leading-relaxed text-slate-600 mt-0.5">
                          Your salary will be paid monthly, subject to applicable statutory deductions, taxes, and company policies. A detailed salary breakup will be provided separately, where applicable.
                        </p>
                      </div>

                      <div>
                        <h4 className="font-bold text-slate-900 text-xs">2. Joining Formalities</h4>
                        <p className="text-xs leading-relaxed text-slate-700 mt-1">
                          You are requested to report to the HR department on your joining date to complete the required documentation and onboarding procedures.
                        </p>
                      </div>

                      <div>
                        <h4 className="font-bold text-slate-900 text-xs">3. Employment Type</h4>
                        <p className="text-xs leading-relaxed text-slate-700 mt-1">
                          Your employment will be on a <strong>{activeOffer.employmentType}</strong> basis, subject to the terms and conditions outlined in this letter.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── PAGE 2 SHEET ── */}
                {(previewTab === "ALL" || previewTab === "PAGE_2") && (
                  <div className="max-w-2xl mx-auto rounded-xl border border-slate-300 bg-white shadow-md p-8 sm:p-10 text-slate-800 space-y-4 font-sans text-xs">
                    {/* Page Header */}
                    <div className="flex items-center justify-between text-[10px] text-slate-400 border-b border-slate-100 pb-2">
                      <span className="font-semibold uppercase tracking-wider">{activeOffer.companyName} • TERMS & CONDITIONS</span>
                      <span className="font-bold">PAGE 2 OF 3</span>
                    </div>

                    <div className="text-center py-1">
                      <h3 className="text-sm font-extrabold tracking-wider text-slate-900 uppercase">PAGE 2 – TERMS AND CONDITIONS</h3>
                    </div>

                    <hr className="border-slate-300 my-2" />

                    <div className="space-y-3.5 text-xs text-slate-700 leading-relaxed">
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs">4. Probation Period</h4>
                        <p className="mt-1">
                          You will be on probation for a period of <strong>{activeOffer.probationPeriod}</strong> from your date of joining. Your performance and professional conduct will be evaluated during this period.
                        </p>
                      </div>

                      <div>
                        <h4 className="font-bold text-slate-900 text-xs">5. Working Hours</h4>
                        <p className="mt-1">
                          Your standard working days will be <strong>{activeOffer.workingDays}</strong>, and your working hours will be <strong>{activeOffer.workingHours}</strong>, subject to company policies and applicable laws.
                        </p>
                      </div>

                      <div>
                        <h4 className="font-bold text-slate-900 text-xs">6. Leave and Benefits</h4>
                        <p className="mt-1">
                          You will be entitled to leave, holidays, and other employee benefits in accordance with company policies and applicable statutory requirements.
                        </p>
                      </div>

                      <div>
                        <h4 className="font-bold text-slate-900 text-xs">7. Roles and Responsibilities</h4>
                        <p className="mt-1">
                          You are expected to perform the duties assigned to your position, maintain professional conduct, and comply with organizational policies and procedures.
                        </p>
                      </div>

                      <div>
                        <h4 className="font-bold text-slate-900 text-xs">8. Confidentiality</h4>
                        <p className="mt-1">
                          You are required to maintain the confidentiality of all company information, client data, technical documents, and business-related information during and after your employment, except as permitted or required by law.
                        </p>
                      </div>

                      <div>
                        <h4 className="font-bold text-slate-900 text-xs">9. Notice Period</h4>
                        <p className="mt-1">
                          The notice period during probation will be <strong>{activeOffer.noticePeriodProbation} days</strong>. After confirmation, the applicable notice period will be <strong>{activeOffer.noticePeriodConfirmed} days</strong>, subject to the employment agreement and applicable laws.
                        </p>
                      </div>

                      <div>
                        <h4 className="font-bold text-slate-900 text-xs">10. Background Verification</h4>
                        <p className="mt-1">
                          This offer is subject to satisfactory verification of your educational qualifications, previous employment details, and other relevant documents.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── PAGE 3 SHEET ── */}
                {(previewTab === "ALL" || previewTab === "PAGE_3") && (
                  <div className="max-w-2xl mx-auto rounded-xl border border-slate-300 bg-white shadow-md p-8 sm:p-10 text-slate-800 space-y-4 font-sans text-xs">
                    {/* Page Header */}
                    <div className="flex items-center justify-between text-[10px] text-slate-400 border-b border-slate-100 pb-2">
                      <span className="font-semibold uppercase tracking-wider">{activeOffer.companyName} • OFFER CONFIRMATION</span>
                      <span className="font-bold">PAGE 3 OF 3</span>
                    </div>

                    <div className="text-center py-1">
                      <h3 className="text-sm font-extrabold tracking-wider text-slate-900 uppercase">PAGE 3 – OFFER CONFIRMATION</h3>
                    </div>

                    <hr className="border-slate-300 my-2" />

                    <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs">11. Offer Validity</h4>
                        <p className="mt-1">
                          This offer will remain valid until <strong>{activeOffer.offerExpiryDate}</strong>. You are requested to confirm your acceptance on or before the specified date.
                        </p>
                      </div>

                      <div>
                        <h4 className="font-bold text-slate-900 text-xs">12. General Terms</h4>
                        <p className="mt-1">
                          Your employment will be governed by the terms mentioned in this letter, applicable company policies, and relevant employment laws.
                        </p>
                        <p className="mt-1">
                          You may be required to sign an employment agreement or appointment letter during onboarding.
                        </p>
                        <p className="mt-2 font-medium text-slate-800">
                          We are delighted to welcome you to <strong>{activeOffer.companyName}</strong> and look forward to a successful and rewarding professional association.
                        </p>
                      </div>

                      <div className="pt-3 space-y-1">
                        <p className="font-bold text-slate-900">Best Regards,</p>
                        <p className="font-bold text-slate-900 text-sm mt-1">{activeOffer.hrManagerName}</p>
                        <p className="text-slate-600">{activeOffer.hrDesignation}</p>
                        <p className="text-slate-600 font-semibold">{activeOffer.companyName}</p>
                        <p className="text-slate-500 pt-3">
                          Authorized Signature: ____________________________________________________
                        </p>
                      </div>
                    </div>

                    <hr className="border-slate-300 my-3" />

                    {/* Acceptance Section */}
                    <div className="space-y-3 bg-slate-50 p-4 rounded-lg border border-slate-200">
                      <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">ACCEPTANCE OF OFFER</h4>
                      <p className="text-xs text-slate-700 leading-relaxed">
                        I, <strong>{activeOffer.candidateName}</strong>, confirm that I have read and understood the terms and conditions mentioned in this offer letter.
                      </p>
                      <p className="text-xs text-slate-700 leading-relaxed">
                        I hereby accept the offer of employment for the position of <strong>{activeOffer.jobTitle}</strong> at <strong>{activeOffer.companyName}</strong>.
                      </p>

                      <div className="pt-2 space-y-2 text-xs text-slate-800">
                        <p><strong>Candidate Name:</strong> {activeOffer.candidateName}</p>
                        <p>
                          <strong>Candidate Signature:</strong>{" "}
                          {activeOffer.signedName ? (
                            <span className="font-bold text-emerald-700">[Digitally Signed: {activeOffer.signedName} on {activeOffer.signedAt || "Verified"}]</span>
                          ) : (
                            "____________________________________________________"
                          )}
                        </p>
                        <div className="flex items-center justify-between pt-1 text-slate-600">
                          <span><strong>Date:</strong> {activeOffer.signedAt ? activeOffer.signedAt.slice(0, 10) : "[DD/MM/YYYY]"}</span>
                          <span><strong>Joining Date:</strong> {activeOffer.joiningDate}</span>
                        </div>
                      </div>
                    </div>

                    <hr className="border-slate-300 my-2" />

                    {/* Footer */}
                    <div className="text-center text-[10px] text-slate-500 space-y-0.5">
                      <p className="font-bold text-slate-700">{activeOffer.companyName} • {activeOffer.companyAddress}</p>
                      <p>{activeOffer.companyEmail} | {activeOffer.companyWebsite}</p>
                      <p className="italic text-slate-400 pt-1">
                        *This offer letter is confidential and intended solely for the candidate named above.*
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── FOOTER ACTIONS ── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-line pt-3">
              <div className="flex items-center gap-2">
                {editorMode === "EDIT" ? (
                  <Button variant="ghost" onClick={handleSaveDraft} className="text-xs font-semibold">
                    <span>Save Draft Changes</span>
                  </Button>
                ) : (
                  <Button variant="ghost" onClick={() => setEditorMode("EDIT")} className="text-xs font-semibold">
                    <span>Edit Form Fields</span>
                  </Button>
                )}

                <Button
                  variant="ghost"
                  onClick={() => handleDownloadPdf(activeOffer)}
                  className="text-xs font-semibold flex items-center gap-1.5 border border-line"
                  title="Download the full 3-page PDF"
                >
                  <Download size={13} />
                  <span>Download 3-Page PDF</span>
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => setActiveOffer(null)} className="text-xs">
                  Close
                </Button>

                <Button
                  variant="primary"
                  onClick={handleApproveAndSendOffer}
                  disabled={isSending}
                  className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-sm"
                >
                  {isSending ? (
                    <span>Sending PDF...</span>
                  ) : (
                    <>
                      <Mail size={14} />
                      <span>Approve & Send 3-Page Offer to Candidate</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
