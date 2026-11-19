import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { useMe, useOverview } from "@/api/hooks";
import { BrandMark } from "@/components/layout/BrandMark";
import { Footer } from "@/components/layout/Footer";
import { useTenantCtx } from "@/components/layout/TenantContext";
import { ButtonAnchor, ButtonLink } from "@/components/ui/Button";
import { ErrorState, PageLoader } from "@/components/ui/feedback";
import { Calendar, Check, Clipboard } from "@/components/ui/icons";

export function SubmittedPage() {
  const tenant = useTenantCtx();
  const { t } = useTranslation();
  const { appId = "" } = useParams();
  const overview = useOverview(tenant.slug, appId);
  const me = useMe();

  let o = overview.data;
  if (!o) {
    const local = localStorage.getItem(`bh_draft_${appId}`);
    if (local) {
      try {
        const parsed = JSON.parse(local);
        o = {
          id: appId,
          reference: parsed.reference || `APP-${appId.slice(-6)}`,
          stage: "SUBMITTED",
          job: parsed.job || { title: "Software Developer", location: "Hybrid" },
          events: [],
        } as any;
      } catch {}
    }
  }

  if (overview.isPending && !o) return <PageLoader />;
  if (overview.isError && !o) return <main className="page py-16"><ErrorState error={overview.error} /></main>;
  if (!o) return <PageLoader />;
  const steps = [
    { icon: <Check />, title: t("apply.submitted.n1Title"), body: t("apply.submitted.n1Body"), tone: "bg-info-soft text-info-ink" },
    { icon: <Clipboard />, title: t("apply.submitted.n2Title"), body: t("apply.submitted.n2Body"), tone: "bg-warn-soft text-warn-ink" },
    { icon: <Calendar />, title: t("apply.submitted.n3Title"), body: t("apply.submitted.n3Body"), tone: "bg-ok-soft text-ok-ink" },
  ];
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-white">
        <div className="page flex min-h-[72px] items-center"><BrandMark /></div>
      </header>
      <main className="mx-auto flex w-full max-w-[880px] flex-col items-center gap-7 px-6 py-16 text-center">
        <span className="flex h-[88px] w-[88px] items-center justify-center rounded-full bg-ok-soft text-ok-ink shadow-[0_0_0_12px_#F0FAF7]"><Check size={44} /></span>
        <div className="flex flex-col items-center gap-3">
          <h1 className="text-4xl">{t("apply.submitted.title")}</h1>
          <p className="max-w-[560px] text-[17px] leading-relaxed text-ink-2">{t("apply.submitted.body", { job: o.job.title, tenant: tenant.name })}</p>
          <p className="text-[13px] text-ink-muted">{t("apply.submitted.reference", { reference: o.reference })}{me.data ? ` · ${me.data.email}` : ""}</p>
        </div>
        <section className="card flex w-full flex-col gap-6 text-left md:p-8">
          <h2 className="text-[17px]">{t("apply.submitted.nextTitle")}</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {steps.map((s) => (
              <div key={s.title} className="flex flex-col gap-2.5 rounded-2xl bg-[#F7F9FC] p-4">
                <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${s.tone}`}>{s.icon}</span>
                <p className="font-semibold">{s.title}</p>
                <p className="text-[13px] leading-relaxed text-ink-muted">{s.body}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-line-soft pt-5">
            <p className="min-w-[260px] flex-1 text-sm leading-relaxed text-ink-2">{t("apply.submitted.emailNote")}</p>
            {tenant.careersUrl && <ButtonAnchor href={tenant.careersUrl} variant="ghost" size="lg">{t("apply.submitted.backToCareers")}</ButtonAnchor>}
            <ButtonLink to={`/${tenant.slug}/applications/${o.id}`} size="lg">{t("apply.submitted.track")}</ButtonLink>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
