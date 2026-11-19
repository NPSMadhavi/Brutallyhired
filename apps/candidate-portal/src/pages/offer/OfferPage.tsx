import { zodResolver } from "@hookform/resolvers/zod";
import { acceptOfferSchema, declineOfferSchema, type AcceptOfferInput, type DeclineOfferInput } from "@verity/shared";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { useAcceptOffer, useDeclineOffer, useMe, useOffer, useOverview } from "@/api/hooks";
import { useTenantCtx } from "@/components/layout/TenantContext";
import { Button, ButtonAnchor, ButtonLink } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Card";
import { EmptyState, ErrorState, InlineError, PageLoader } from "@/components/ui/feedback";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/form";
import { Check, Download, File as FileIcon, Lock, Mail } from "@/components/ui/icons";
import { Avatar } from "@/components/ui/misc";
import { ApiError, fileUrl } from "@/lib/api";
import { useFormat } from "@/lib/format";

export function OfferPage() {
  const tenant = useTenantCtx();
  const { t } = useTranslation();
  const f = useFormat();
  const { appId = "" } = useParams();
  const me = useMe();
  const overview = useOverview(tenant.slug, appId);
  const offer = useOffer(tenant.slug, appId);
  const accept = useAcceptOffer(tenant.slug, appId);
  const decline = useDeclineOffer(tenant.slug, appId);
  const [mode, setMode] = useState<"idle" | "sign" | "decline">("idle");
  const signForm = useForm<AcceptOfferInput>({
    resolver: zodResolver(acceptOfferSchema),
    defaultValues: { signatureName: me.data?.displayName ?? "", agree: false as unknown as true },
  });
  const declineForm = useForm<DeclineOfferInput>({ resolver: zodResolver(declineOfferSchema), defaultValues: { reason: "" } });

  if (offer.isPending) return <PageLoader />;
  if (offer.isError) {
    if (offer.error instanceof ApiError && offer.error.status === 404) {
      return <EmptyState icon={<Lock size={26} />} title={t("errors.offer_not_found")} />;
    }
    return <ErrorState error={offer.error} />;
  }
  const o = offer.data;
  const firstName = me.data?.displayName?.split(" ")[0];
  const daysLeft = f.daysUntil(o.respondBy);

  return (
    <>
      <section className="flex flex-wrap items-end justify-between gap-6 rounded-3xl bg-ink p-8 md:p-10">
        <div className="flex max-w-[720px] flex-col gap-3">
          <span className="label-caps text-[#7FD1C4]">{t("offer.heroLabel", { job: overview.data?.job.title ?? "" })}</span>
          <h1 className="text-[34px] leading-tight text-white md:text-[40px]">{firstName ? t("offer.title", { name: firstName }) : t("offer.titleFallback")}</h1>
          <p className="text-base leading-relaxed text-[#C9D3E0]">{t("offer.sub")}</p>
        </div>
        {o.status === "SENT" && (
          <div className="flex flex-col items-end gap-1">
            <span className="text-[13px] text-[#C9D3E0]">{t("offer.replyBy")}</span>
            <span className="font-display text-2xl font-bold text-white">{f.date(o.respondBy)}</span>
            <span className="rounded-full bg-[#7FD1C4]/15 px-2.5 py-1 text-xs font-semibold text-[#7FD1C4]">{t("offer.daysLeft", { count: daysLeft })}</span>
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
          <section className="card flex flex-col gap-5 md:p-8">
            <h2 className="text-[22px]">{t("offer.glance")}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {o.terms.map((term) => (
                <div key={term.label} className="flex flex-col gap-1 rounded-2xl border border-line px-4 py-4">
                  <span className="label-caps text-[11px]">{term.label}</span>
                  <strong className="font-display text-lg">{term.value}</strong>
                </div>
              ))}
            </div>
            {o.message && (
              <div className="rounded-2xl bg-[#F7F9FC] p-4">
                <p className="label-caps mb-1.5 text-[11px]">{t("offer.message")}</p>
                <p className="whitespace-pre-line text-sm leading-relaxed text-ink-2">{o.message}</p>
              </div>
            )}
            {o.letter && (
              <div className="flex flex-wrap items-center gap-3.5 rounded-2xl border border-line px-4 py-3.5">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FDECEC] text-[#B42318]"><FileIcon /></span>
                <div className="min-w-0 flex-1"><p className="font-semibold">{t("offer.letter")}</p><p className="text-[13px] text-ink-muted">{o.letter.name} · {f.fileSize(o.letter.sizeBytes)}</p></div>
                <ButtonAnchor href={fileUrl(o.letter.id)} variant="ghost" icon={<Download size={16} />}>{t("common.download")}</ButtonAnchor>
              </div>
            )}
          </section>

          <section className="card flex flex-col gap-4 md:p-8">
            {o.status === "SENT" && mode === "idle" && (
              <>
                <h2 className="text-[22px]">{t("offer.decision")}</h2>
                <p className="text-sm text-ink-2">{t("offer.decisionBody")}</p>
                <div className="flex flex-wrap gap-2.5">
                  <Button size="lg" onClick={() => setMode("sign")}>{t("offer.accept")}</Button>
                  {o.recruiter && <ButtonAnchor href={`mailto:${o.recruiter.email}`} variant="ghost" size="lg">{t("offer.ask")}</ButtonAnchor>}
                  <Button variant="danger" onClick={() => setMode("decline")}>{t("offer.decline")}</Button>
                </div>
              </>
            )}
            {o.status === "SENT" && mode === "sign" && (
              <form className="flex flex-col gap-4" noValidate onSubmit={signForm.handleSubmit((v) => accept.mutate(v))}>
                <h2 className="text-[22px]">{t("offer.signTitle")}</h2>
                <Field label={t("offer.signLabel")} htmlFor="sig" error={signForm.formState.errors.signatureName && t("errors.validation_failed")}>
                  <Input id="sig" className="min-h-[60px] font-display text-[22px] font-semibold" autoComplete="name" {...signForm.register("signatureName")} />
                </Field>
                <Checkbox label={t("offer.agree")} {...signForm.register("agree")} error={signForm.formState.errors.agree && t("common.required")} />
                <InlineError error={accept.error} />
                <div className="flex flex-wrap gap-2.5">
                  <Button type="submit" size="lg" loading={accept.isPending}>{t("offer.signAccept")}</Button>
                  <Button variant="ghost" size="lg" onClick={() => setMode("idle")}>{t("common.back")}</Button>
                </div>
              </form>
            )}
            {o.status === "SENT" && mode === "decline" && (
              <form className="flex flex-col gap-3.5 rounded-2xl border border-danger-line bg-danger-soft p-5" noValidate onSubmit={declineForm.handleSubmit((v) => decline.mutate(v))}>
                <h2 className="text-[17px] text-danger">{t("offer.declineTitle")}</h2>
                <p className="text-sm text-danger">{t("offer.declineBody")}</p>
                <Field label={t("offer.reason")} htmlFor="reason"><Textarea id="reason" rows={3} {...declineForm.register("reason")} /></Field>
                <InlineError error={decline.error} />
                <div className="flex flex-wrap gap-2.5">
                  <Button type="submit" size="lg" className="bg-danger text-white" loading={decline.isPending}>{t("offer.declineYes")}</Button>
                  <Button variant="ghost" size="lg" onClick={() => setMode("idle")}>{t("offer.keep")}</Button>
                </div>
              </form>
            )}
            {o.status === "ACCEPTED" && (
              <div className="flex flex-wrap items-center gap-4">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-ok-soft text-ok-ink"><Check size={28} /></span>
                <div className="flex min-w-[260px] flex-1 flex-col gap-1">
                  <h2 className="text-[22px]">{t("offer.acceptedTitle")}</h2>
                  <p className="text-[15px] text-ink-muted">{t("offer.acceptedBody", { name: o.signatureName ?? "", date: o.respondedAt ? f.date(o.respondedAt) : "" })}</p>
                </div>
                <ButtonLink to={`/${tenant.slug}/applications/${appId}/onboarding`} size="lg">{t("offer.startOnboarding")}</ButtonLink>
              </div>
            )}
            {o.status === "DECLINED" && (<><h2 className="text-[22px]">{t("offer.declinedTitle")}</h2><p className="text-ink-muted">{t("offer.declinedBody")}</p></>)}
            {o.status === "EXPIRED" && (<><Pill tone="gray" className="self-start">{t("offer.expiredTitle")}</Pill><p className="text-ink-muted">{t("offer.expiredBody")}</p></>)}
          </section>
        </div>

        {o.recruiter && (
          <aside className="card flex min-w-0 flex-[1_1_320px] flex-col gap-4">
            <h2 className="text-[17px]">{t("offer.questions")}</h2>
            <div className="flex items-center gap-3">
              <Avatar name={o.recruiter.name ?? o.recruiter.email} tone="teal" />
              <div className="min-w-0"><p className="truncate font-semibold">{o.recruiter.name ?? o.recruiter.email}</p>{o.recruiter.title && <p className="text-[13px] text-ink-muted">{o.recruiter.title}</p>}</div>
            </div>
            <ButtonAnchor href={`mailto:${o.recruiter.email}`} variant="ghost" icon={<Mail size={16} />}>{t("overview.emailRecruiter", { name: o.recruiter.name?.split(" ")[0] ?? o.recruiter.email })}</ButtonAnchor>
          </aside>
        )}
      </div>
    </>
  );
}
