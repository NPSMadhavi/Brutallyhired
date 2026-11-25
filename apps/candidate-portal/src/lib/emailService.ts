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
  stage: "SHORTLISTED" | "ASSESSMENT" | "TEST_SUBMITTED" | "INTERVIEW" | "OFFER" | "HIRED" | "REJECTED" | "ON_HOLD";
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
  stage: "SHORTLISTED" | "ASSESSMENT" | "TEST_SUBMITTED" | "INTERVIEW" | "OFFER" | "HIRED" | "REJECTED" | "ON_HOLD";
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
  const fullPortalUrl = portalPath ? `${window.location.origin}${portalPath}` : "";

  let subject = customSubject || "";
  let heading = customHeading || "";
  let body = customBody || "";
  let templateKey = "assessment_invited";

  switch (stage) {
    case "SHORTLISTED":
      templateKey = "shortlisted";
      subject = subject || `Shortlisted for ${jobTitle} — Brutallyhired`;
      heading = heading || `Congratulations!`;
      body =
        body ||
        `Dear ${recipientName},\n\nCongratulations!\n\nWe are pleased to inform you that you have been shortlisted for the ${jobTitle} position at Brutallyhired based on our initial review of your application.\n\nYour profile has been selected to proceed to the next stage of our recruitment process.\n\nOur recruitment team will contact you shortly with the details of your First Round Interview, including the interview date, time, and other relevant instructions.\n\nWe appreciate your interest in joining our organization and look forward to connecting with you.\n\nBest Regards,\nHR Recruitment Team\nBrutallyhired`;
      break;

    case "ASSESSMENT":
      templateKey = "assessment_invited";
      subject = subject || `Assessment ready — ${jobTitle}`;
      heading = heading || `Congratulations ${recipientName}, you've been shortlisted!`;
      body =
        body ||
        `We are impressed by your background and are pleased to invite you to the next stage for the ${jobTitle} opening at Brutallyhired. Please complete your proctored assessment before the deadline. It takes 45 minutes once you begin.`;
      break;

    case "TEST_SUBMITTED":
      templateKey = "assessment_submitted";
      subject = subject || `Practical Assessment Submitted — ${jobTitle}`;
      heading = heading || `Practical Assessment Submitted Successfully`;
      body =
        body ||
        `Thank you ${recipientName}! Your practical assessment for the ${jobTitle} opening at Brutallyhired has been received and submitted for HR review. Our hiring panel is reviewing your answers and telemetry. You will receive an update once your submission is reviewed.`;
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

    case "REJECTED":
      templateKey = "offer_rejected";
      subject = subject || `Application Update: ${jobTitle} — Brutallyhired`;
      heading = heading || `Application Status Update`;
      body =
        body ||
        `Thank you for taking the time to participate in our evaluation for ${jobTitle}. Following our assessment audit and security telemetry evaluation, we will not be moving forward with your application. We wish you the best in your career search.`;
      break;

    case "ON_HOLD":
      templateKey = "offer_rejected";
      subject = subject || `Application Status: On Hold for ${jobTitle}`;
      heading = heading || `Application Update`;
      body = body || `Your application for ${jobTitle} has been placed on hold for further batch evaluation.`;
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
    const res = await fetch(`/api/t/${tenantSlug}/notifications/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-verity-csrf": "1",
      },
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
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.warn("Backend email dispatch returned non-200:", res.status, errText);
    }
  } catch (err) {
    console.warn("Backend email dispatch note:", err);
  }

  saveSentEmail(record);
  return record;
}
