import type { NextAction } from "@verity/shared";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ButtonLink } from "@/components/ui/Button";
import { Arrow, Calendar, Clipboard, Folder, Hourglass } from "@/components/ui/icons";
import { useFormat } from "@/lib/format";

/** Turns the server's next action into words and a single clear call to action. */
export function useNextStep(action: NextAction, base: string, draftPath: string | null) {
  const { t } = useTranslation();
  const f = useFormat();
  let title = "";
  let body = "";
  let cta: { to: string; label: string } | null = null;
  let icon: ReactNode = <Hourglass />;

  switch (action.type) {
    case "COMPLETE_APPLICATION":
      title = t("next.COMPLETE_APPLICATION.title");
      body = t("next.COMPLETE_APPLICATION.body");
      if (draftPath) cta = { to: draftPath, label: t("next.COMPLETE_APPLICATION.cta") };
      icon = <Arrow />;
      break;
    case "TAKE_ASSESSMENT":
      title = t("next.TAKE_ASSESSMENT.title", { title: action.title });
      body = t("next.TAKE_ASSESSMENT.body", { minutes: action.durationMinutes, due: f.dateTime(action.dueAt) });
      cta = { to: `${base}/assessments/${action.inviteId}`, label: t("next.TAKE_ASSESSMENT.cta") };
      icon = <Clipboard />;
      break;
    case "BOOK_INTERVIEW":
      title = t("next.BOOK_INTERVIEW.title", { title: action.title });
      body = action.bookByAt
        ? t("next.BOOK_INTERVIEW.bodyBy", { minutes: action.durationMinutes, date: f.date(action.bookByAt) })
        : t("next.BOOK_INTERVIEW.body", { minutes: action.durationMinutes });
      cta = { to: `${base}/interviews/${action.roundId}`, label: t("next.BOOK_INTERVIEW.cta") };
      icon = <Calendar />;
      break;
    case "ATTEND_INTERVIEW":
      title = t("next.ATTEND_INTERVIEW.title", { title: action.title });
      body = t("next.ATTEND_INTERVIEW.body", { when: `${f.longDate(action.startsAt)} · ${f.timeRange(action.startsAt, action.endsAt)}` });
      cta = { to: `${base}/interviews/${action.roundId}`, label: t("next.ATTEND_INTERVIEW.cta") };
      icon = <Calendar />;
      break;
    case "RESPOND_TO_OFFER":
      title = t("next.RESPOND_TO_OFFER.title");
      body = t("next.RESPOND_TO_OFFER.body", { date: f.date(action.respondBy) });
      cta = { to: `${base}/offer`, label: t("next.RESPOND_TO_OFFER.cta") };
      icon = <Arrow />;
      break;
    case "COMPLETE_ONBOARDING":
      title = t("next.COMPLETE_ONBOARDING.title");
      body = t("next.COMPLETE_ONBOARDING.body", { count: action.pending });
      cta = { to: `${base}/onboarding`, label: t("next.COMPLETE_ONBOARDING.cta") };
      icon = <Folder />;
      break;
    case "READY_TO_START":
      title = t("next.READY_TO_START.title");
      body = action.startDate ? t("next.READY_TO_START.body", { date: f.longDate(action.startDate) }) : t("next.READY_TO_START.bodyNoDate");
      cta = { to: `${base}/onboarding`, label: t("next.READY_TO_START.cta") };
      icon = <Folder />;
      break;
    case "CLOSED":
      title = t(`next.CLOSED.${action.reason}.title`);
      body = t(`next.CLOSED.${action.reason}.body`);
      break;
    default:
      title = t(`next.${action.type}.title`);
      body = t(`next.${action.type}.body`);
  }
  return { title, body, cta, icon };
}

export function NextStepCard({ action, base, draftPath }: { action: NextAction; base: string; draftPath: string | null }) {
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
