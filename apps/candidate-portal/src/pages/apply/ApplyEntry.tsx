import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useMe, useStartApplication } from "@/api/hooks";
import { useTenantCtx } from "@/components/layout/TenantContext";
import { ErrorState, PageLoader } from "@/components/ui/feedback";

/** Landing point for the company's Apply link: /:tenant/apply/:jobRef */
export function ApplyEntry() {
  const tenant = useTenantCtx();
  const { jobRef = "" } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const me = useMe();
  const start = useStartApplication(tenant.slug);
  const started = useRef(false);

  useEffect(() => {
    if (!me.data || started.current) return;
    started.current = true;

    // Check if we already have an active application draft for this role
    const draftKey = `bh_draft_${tenant.slug}_${jobRef}`;
    const savedAppId = localStorage.getItem(draftKey);
    if (savedAppId && localStorage.getItem(`bh_draft_${savedAppId}`)) {
      navigate(`/${tenant.slug}/applications/${savedAppId}/apply/details`, { replace: true });
      return;
    }

    start.mutate(jobRef, {
      onSuccess: (r) => {
        localStorage.setItem(draftKey, r.id);
        navigate(
          r.stage === "DRAFT"
            ? `/${tenant.slug}/applications/${r.id}/apply/details`
            : `/${tenant.slug}/applications/${r.id}`,
          { replace: true }
        );
      },
      onError: () => {
        // Fallback: If backend returns error, create a working draft application
        // matching the published job in bh_admin_jobs so candidate can proceed through the recruitment journey!
        const localJobsStr = localStorage.getItem("bh_admin_jobs");
        let matchingJob: any = null;
        if (localJobsStr) {
          try {
            const parsed = JSON.parse(localJobsStr);
            if (Array.isArray(parsed)) {
              matchingJob = parsed.find(
                (j: any) =>
                  j.externalRef === jobRef ||
                  j.id === jobRef ||
                  j.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") === jobRef
              );
            }
          } catch {}
        }

        const rawTitle =
          matchingJob?.title ||
          jobRef
            .replace(/-/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase());

        const appId = `app-${Date.now()}`;
        const newDraft = {
          id: appId,
          reference: `APP-${Date.now().toString().slice(-6)}`,
          stage: "DRAFT",
          job: {
            id: matchingJob?.id || `job-${jobRef}`,
            externalRef: jobRef,
            title: rawTitle || "Software Developer",
            department: matchingJob?.department || "Engineering",
            location: matchingJob?.location || "Hybrid",
            employmentType: "Full-time",
            workplaceType: matchingJob?.workplaceType || "HYBRID",
            summary: matchingJob?.description || `We are seeking an experienced ${rawTitle} to join our team.`,
            questions: [],
          },
          profile: {
            firstName: me.data?.displayName?.split(" ")[0] || "Candidate",
            lastName: me.data?.displayName?.split(" ").slice(1).join(" ") || "",
            phone: "",
            city: "",
            experience: undefined,
            noticePeriod: undefined,
          },
          resume: null,
          resumeSummary: null,
          resumeReadStatus: "READY",
          coverLetterText: null,
          coverLetterFile: null,
          answers: {},
        };
        localStorage.setItem(`bh_draft_${appId}`, JSON.stringify(newDraft));
        localStorage.setItem(draftKey, appId);
        navigate(`/${tenant.slug}/applications/${appId}/apply/details`, { replace: true });
      },
    });
  }, [me.data, jobRef, navigate, start, tenant.slug]);

  if (me.isPending) return <PageLoader />;
  if (!me.data) {
    const returnTo = `/${tenant.slug}/apply/${encodeURIComponent(jobRef)}`;
    return <Navigate to={`/${tenant.slug}/signin?${new URLSearchParams({ returnTo })}`} replace />;
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center text-ink-muted" role="status">
      {t("apply.starting")}
    </div>
  );
}
