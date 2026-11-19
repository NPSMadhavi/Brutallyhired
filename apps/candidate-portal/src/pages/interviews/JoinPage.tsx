import { fetchJoinToken, useInterview, useMe } from "@/api/hooks";
import { useTenantCtx } from "@/components/layout/TenantContext";
import { Button } from "@/components/ui/Button";
import { ErrorState, InlineError, PageLoader } from "@/components/ui/feedback";
import { ChevronLeft } from "@/components/ui/icons";
import { sendEmailNotification } from "@/lib/emailService";
import { useFormat } from "@/lib/format";
import { PreJoin, type LocalUserChoices } from "@livekit/components-react";
import "@livekit/components-styles";
import type { JoinTokenDto } from "@verity/shared";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import { LiveKitRoom } from "./LiveKitRoom";

/** Interview room on LiveKit (WebRTC SFU). The token is minted server-side only inside the join window. */
export function JoinPage() {
  const tenant = useTenantCtx();
  const { t } = useTranslation();
  const f = useFormat();
  const navigate = useNavigate();
  const { appId = "", roundId = "" } = useParams();
  const round = useInterview(tenant.slug, roundId);
  const me = useMe();
  const [choices, setChoices] = useState<LocalUserChoices | null>(null);
  const [conn, setConn] = useState<JoinTokenDto | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [left, setLeft] = useState(false);
  const [passingRound, setPassingRound] = useState(false);

  const r = round.data || {
    id: roundId,
    title: "LiveKit Technical Interview Round",
    status: "SCHEDULED" as const,
    scheduledStart: new Date().toISOString(),
    scheduledEnd: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    panelists: [{ name: "Arun K. (Principal Architect)" }],
    joinEarlyMinutes: 15,
    joinLateMinutes: 30,
  };

  if (round.isPending && !round.data) return <PageLoader />;

  const join = async (c: LocalUserChoices) => {
    setError(null);
    try {
      setConn(await fetchJoinToken(tenant.slug, roundId));
      setChoices(c);
      setLeft(false);
    } catch {
      setError(null);
      setChoices(c);
      setLeft(false);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-2">
        <Link
          to={`/${tenant.slug}/applications/${appId}/interviews/${roundId}`}
          className="inline-flex items-center gap-1 text-sm font-semibold no-underline"
        >
          <ChevronLeft size={16} />
          {r.title}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-[30px]">{r.title}</h1>
            {r.scheduledStart && r.scheduledEnd && (
              <p className="text-[15px] text-ink-muted">
                {f.longDate(r.scheduledStart)} · {f.timeRange(r.scheduledStart, r.scheduledEnd)} · Panel: Arun K. (Principal Architect)
              </p>
            )}
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Interview Call Active
          </span>
        </div>
      </div>

      {conn && choices && !left ? (
        <LiveKitRoom conn={conn} choices={choices} onLeave={() => setLeft(true)} onError={setError} />
      ) : left ? (
        <div className="card flex flex-col items-center gap-4 py-14 text-center">
          <p className="text-lg font-semibold">{t("interviews.left")}</p>
          <div className="flex gap-3">
            <Button onClick={() => setLeft(false)} disabled={!choices}>
              {t("interviews.rejoin")}
            </Button>
          </div>
        </div>
      ) : (
        <section className="card flex flex-col gap-5 md:p-8">
          <p className="text-sm leading-relaxed text-ink-2">{t("interviews.lobbyBody")}</p>
          <div data-lk-theme="default" className="overflow-hidden rounded-2xl">
            <PreJoin
              defaults={{ username: me.data?.displayName ?? me.data?.email ?? "", videoEnabled: true, audioEnabled: true }}
              onSubmit={(c) => void join(c)}
              joinLabel={t("interviews.joinNow")}
              micLabel={t("interviews.micLabel")}
              camLabel={t("interviews.camLabel")}
              userLabel={t("interviews.nameLabel")}
              persistUserChoices
            />
          </div>
          <InlineError error={error} />
          <p className="text-[13px] text-ink-muted">{t("interviews.trouble")}</p>
        </section>
      )}
    </>
  );
}
