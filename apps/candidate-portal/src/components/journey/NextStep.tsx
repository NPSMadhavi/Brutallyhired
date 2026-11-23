import type { NextAction } from "@verity/shared";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ButtonLink } from "@/components/ui/Button";
import { Arrow, Calendar, Clipboard, Folder, Hourglass } from "@/components/ui/icons";
import { useFormat } from "@/lib/format";

/** Turns the server's next action into words and a single clear call to action. */
export function useNextStep(action: NextAction | null | undefined, base: string, draftPath: string | null) {
  const { t } = useTranslation();
  const f = useFormat();
  let title = "";
  let body = "";
  let cta: { to: string; label: string } | null = null;
  let icon: ReactNode = <Hourglass />;

  if (!action) {
    return {
      title: t("next.AWAIT_REVIEW.title", "A recruiter is reviewing your application"),
      body: t("next.AWAIT_REVIEW.body", "We’ll let you know as soon as there’s news. Nothing is rejected automatically."),
      cta: null,
      icon: <Hourglass />,
    };
  }

  const actType = (action as any).type || (action as any).kind;

  switch (actType) {
    case "AWAIT_REVIEW":
      title = t("next.AWAIT_REVIEW.title", "A recruiter is reviewing your application");
      body = t("next.AWAIT_REVIEW.body", "We’ll let you know as soon as there’s news. Nothing is rejected automatically.");
      icon = <Hourglass />;
      break;
    case "AWAIT_ASSESSMENT_REVIEW":
      title = t("next.AWAIT_ASSESSMENT_REVIEW.title", "Assessment submitted");
      body = t("next.AWAIT_ASSESSMENT_REVIEW.body", "The hiring team is reviewing it. We’ll be in touch about next steps.");
      icon = <Hourglass />;
      break;
    case "AWAIT_DECISION":
      title = t("next.AWAIT_DECISION.title", "The hiring team is deciding next steps");
      body = t("next.AWAIT_DECISION.body", "We’ll be in touch soon.");
      icon = <Hourglass />;
      break;
    case "COMPLETE_APPLICATION":
      title = t("next.COMPLETE_APPLICATION.title");
      body = t("next.COMPLETE_APPLICATION.body");
      if (draftPath) cta = { to: draftPath, label: t("next.COMPLETE_APPLICATION.cta") };
      icon = <Arrow />;
      break;
    case "SCREENING_TEST":
      title = "Screening test";
      body = "Complete your screening test evaluation to qualify for shortlisting.";
      cta = { to: `${base}/assessments`, label: "Start Screening Test" };
      icon = <Clipboard />;
      break;
    case "SHORTLISTED":
      title = "Shortlisted for next steps";
      body = "Congratulations! You have been shortlisted. The recruitment team is preparing your interview schedule.";
      cta = null;
      icon = <Hourglass />;
      break;
    case "TAKE_ASSESSMENT":
    case "ASSESSMENT":
      title = t("next.TAKE_ASSESSMENT.title", { title: (action as any).title || "Screening Test" });
      body = (action as any).dueAt
        ? t("next.TAKE_ASSESSMENT.body", { minutes: (action as any).durationMinutes || 30, due: f.dateTime((action as any).dueAt) })
        : "Complete the screening test evaluation once you are ready.";
      cta = {
        to: (action as any).path || `${base}/assessments/${(action as any).inviteId || ""}`,
        label: (action as any).label || t("next.TAKE_ASSESSMENT.cta"),
      };
      icon = <Clipboard />;
      break;
    case "INTERVIEW_SCHEDULE":
    case "INTERVIEWS":
    case "BOOK_INTERVIEW":
    case "ATTEND_INTERVIEW":
    case "INTERVIEW":
      title = "Interview Schedule (Round 1, Round 2, Round 3)";
      body = (action as any).startsAt
        ? `Interview scheduled: ${f.longDate((action as any).startsAt)} · ${f.timeRange((action as any).startsAt, (action as any).endsAt)}`
        : "Your interview schedule is active for Round 1, Round 2, and Round 3. Access your video rounds and interview schedule.";
      cta = {
        to: (action as any).path || `${base}/interviews/${(action as any).roundId || ""}`,
        label: (action as any).label || "View Interview Schedule",
      };
      icon = <Calendar />;
      break;
    case "RESPOND_TO_OFFER":
    case "OFFER":
      title = t("next.RESPOND_TO_OFFER.title");
      body = (action as any).respondBy
        ? t("next.RESPOND_TO_OFFER.body", { date: f.date((action as any).respondBy) })
        : "Your formal employment offer letter is ready for review and acceptance.";
      cta = { to: (action as any).path || `${base}/offer`, label: (action as any).label || t("next.RESPOND_TO_OFFER.cta") };
      icon = <Arrow />;
      break;
    case "COMPLETE_ONBOARDING":
      title = t("next.COMPLETE_ONBOARDING.title");
      body = t("next.COMPLETE_ONBOARDING.body", { count: (action as any).pending || 0 });
      cta = { to: `${base}/onboarding`, label: t("next.COMPLETE_ONBOARDING.cta") };
      icon = <Folder />;
      break;
    case "READY_TO_START":
      title = t("next.READY_TO_START.title");
      body = (action as any).startDate ? t("next.READY_TO_START.body", { date: f.longDate((action as any).startDate) }) : t("next.READY_TO_START.bodyNoDate");
      cta = { to: `${base}/onboarding`, label: t("next.READY_TO_START.cta") };
      icon = <Folder />;
      break;
    case "CLOSED":
      const reason = (action as any).reason || "NOT_SELECTED";
      title = t(`next.CLOSED.${reason}.title`, "Application closed");
      body = t(`next.CLOSED.${reason}.body`, "This application is closed. Thank you for your interest.");
      break;
    default:
      title = t(`next.${actType}.title`, "Application under review");
      body = t(`next.${actType}.body`, "The recruitment team is reviewing your profile.");
  }
  return { title, body, cta, icon };
}

export function NextStepCard({ action, base, draftPath }: { action: NextAction | null | undefined; base: string; draftPath: string | null }) {
  const { t } = useTranslation();
  const s = useNextStep(action, base, draftPath);
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-brand/20 bg-brand/[0.05] px-6 py-5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-fg">{s.icon}</span>
      <div className="flex min-w-0 flex-1 basis-80 flex-col gap-1">
        <span className="label-caps text-brand">{t("overview.nextStep")}</span>
        <p className="text-[19px] font-semibold">{s.title}</p>
        <p className="text-sm text-ink-muted">{s.body}</p>
      </div>
      {s.cta && (
        <ButtonLink to={s.cta.to} size="lg">
          {s.cta.label}
        </ButtonLink>
      )}
    </div>
  );
}
