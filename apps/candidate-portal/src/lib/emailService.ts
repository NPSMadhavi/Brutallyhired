/**
 * Email Service helper for candidate communication lifecycle:
 * - Dispatches real emails via backend API (Nodemailer / Gmail SMTP)
 * - Logs sent communications to localStorage for audit & inspection
 * - Generates email previews with exact styling and deep portal links
 */

export interface SentEmailRecord {
  id: string;
  recipient: string;
  recipientName: string;
  subject: string;
  heading: string;
  body: string;
  portalUrl: string;
  stage: "SHORTLISTED" | "ASSESSMENT" | "INTERVIEW" | "OFFER" | "HIRED";
  sentAt: string;
  status: "DELIVERED" | "QUEUED";
  attachmentName?: string;
}

export function getSentEmails(): SentEmailRecord[] {
  try {
    const raw = localStorage.getItem("bh_sent_emails");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function saveSentEmail(record: SentEmailRecord) {
  const current = getSentEmails();
  const updated = [record, ...current.filter((e) => e.id !== record.id)];
  localStorage.setItem("bh_sent_emails", JSON.stringify(updated));
  return updated;
}

export async function sendEmailNotification({
  to,
  recipientName,
  stage,
  jobTitle,
  portalPath,
  tenantSlug = "brutallyhired",
  customHeading,
  customBody,
  customSubject,
  roundTitle,
  roundNumber,
  attachmentName,
}: {
  to: string;
  recipientName: string;
  stage: "SHORTLISTED" | "ASSESSMENT" | "INTERVIEW" | "OFFER" | "HIRED";
  jobTitle: string;
  portalPath: string;
  tenantSlug?: string;
  customHeading?: string;
  customBody?: string;
  customSubject?: string;
  roundTitle?: string;
  roundNumber?: number;
  attachmentName?: string;
}): Promise<SentEmailRecord> {
  const fullPortalUrl = `${window.location.origin}${portalPath}`;

  let subject = customSubject || "";
  let heading = customHeading || "";
  let body = customBody || "";
  let templateKey = "assessment_invited";

  switch (stage) {
    case "SHORTLISTED":
    case "ASSESSMENT":
      templateKey = "assessment_invited";
      subject = subject || `Assessment ready — ${jobTitle}`;
      heading = heading || `Congratulations ${recipientName}, you've been shortlisted!`;
      body =
        body ||
        `We are impressed by your background and are pleased to invite you to the next stage for the ${jobTitle} opening at Brutallyhired. Please complete your proctored assessment before the deadline. It takes 45 minutes once you begin.`;
      break;

    case "INTERVIEW":
      templateKey = "interview_invited";
      if (roundNumber) {
        subject = subject || `Interview Round ${roundNumber}: ${roundTitle || "Practical Evaluation"} — ${jobTitle}`;
        heading = heading || `Interview Round ${roundNumber}: ${roundTitle || "Technical Round with Panel"}`;
        body =
          body ||
          `Congratulations on your progress! You have been invited to Round ${roundNumber} (${roundTitle || "Practical Technical Round"}). Please open the candidate portal to submit your assignment, select your preferred interview slot, or join the live session.`;
      } else {
        subject = subject || `Please book your interview — ${jobTitle}`;
        heading = heading || `Interview Invitation: 3-Round Evaluation Process`;
        body =
          body ||
          `Congratulations on passing the BrutalAssessAI™ examination! The engineering leadership team would love to meet you for the 3-round interview evaluation. Please book your slots and complete your practical assignments in the candidate portal.`;
      }
      break;

    case "OFFER":
      templateKey = "offer_sent";
      subject = subject || `You have an offer from Brutallyhired — ${jobTitle}`;
      heading = heading || `Official Job Offer: ${jobTitle}`;
      body =
        body ||
        `We are thrilled to offer you the position of ${jobTitle} at Brutallyhired! Your exceptional performance across all screening and technical rounds was remarkable. Please review the formal terms, compensation structure, and sign your offer letter in the candidate portal.`;
      break;

    case "HIRED":
      templateKey = "hired";
      subject = subject || `Welcome to the team — ${jobTitle} at Brutallyhired`;
      heading = heading || `Welcome Aboard, ${recipientName}!`;
      body =
        body ||
        `Congratulations! Your signed offer letter has been processed. We could not be more excited to welcome you to Brutallyhired. Next up: Complete your onboarding checklist and get ready for Day 1!`;
      break;
  }

  const record: SentEmailRecord = {
    id: `email-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    recipient: to,
    recipientName,
    subject,
    heading,
    body,
    portalUrl: fullPortalUrl,
    stage,
    sentAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + " (Today)",
    status: "DELIVERED",
    attachmentName,
  };

  // Attempt real backend email dispatch via Nodemailer
  try {
    await fetch(`/api/t/${tenantSlug}/notifications/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to,
        template: templateKey,
        vars: {
          jobTitle,
          assessmentTitle: "Senior Full-Stack & Architecture Challenge",
          roundTitle: roundTitle || "System Architecture & Technical Round",
          dueAt: "in 3 days",
          durationMinutes: 45,
          respondBy: "7 days",
        },
        path: portalPath,
        customSubject: subject,
        customHeading: heading,
        customBody: body,
      }),
    });
  } catch (err) {
    console.warn("Backend email dispatch note:", err);
  }

  saveSentEmail(record);
  return record;
}
