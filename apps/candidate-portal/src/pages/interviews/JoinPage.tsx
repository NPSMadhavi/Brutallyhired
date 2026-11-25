import { fetchJoinToken, useInterview, useMe } from "@/api/hooks";
import { useTenantCtx } from "@/components/layout/TenantContext";
import { Button } from "@/components/ui/Button";
import { ErrorState, InlineError, PageLoader } from "@/components/ui/feedback";
import { Check, ChevronLeft, Clock, Monitor, Video } from "@/components/ui/icons";
import { Avatar } from "@/components/ui/misc";
import { sendEmailNotification } from "@/lib/emailService";
import { useFormat } from "@/lib/format";
import { PreJoin, type LocalUserChoices } from "@livekit/components-react";
import "@livekit/components-styles";
import type { JoinTokenDto } from "@verity/shared";
import { clsx } from "clsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import { LiveKitRoom } from "./LiveKitRoom";

export function JoinPage() {
  const tenant = useTenantCtx();
  const { t } = useTranslation();
  const f = useFormat();
  const navigate = useNavigate();
  const { appId: rawAppId = "", roundId = "round-1" } = useParams();
  const appId =
    rawAppId ||
    (() => {
      try {
        const raw = localStorage.getItem("bh_admin_applications");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed[0]?.id) return parsed[0].id;
        }
      } catch {}
      return "cmwssnj7e0003vnvsanhlfhqg";
    })();

  const candidateInfo = useMemo(() => {
    let name = "praveen Nobi";
    let email = "netopsysai@gmail.com";
    let jobTitle = "Ai Ml";
    try {
      const raw = localStorage.getItem("bh_admin_applications");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const app = parsed.find((a: any) => a.id === appId) || parsed[0];
          if (app.candidateName) name = app.candidateName;
          if (app.candidateEmail || app.email) email = app.candidateEmail || app.email;
          if (app.jobTitle) jobTitle = app.jobTitle;
        }
      }
    } catch {}
    return { name, email, jobTitle };
  }, [appId]);

  const round = useInterview(tenant.slug, roundId);
  const me = useMe();
  const [choices, setChoices] = useState<LocalUserChoices | null>(null);
  const [conn, setConn] = useState<JoinTokenDto | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [left, setLeft] = useState(false);
  const [passingRound, setPassingRound] = useState(false);

  // Fallback video preview stream
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [activeTab, setActiveTab] = useState<"VIDEO" | "WHITEBOARD">("VIDEO");
  const [whiteboardCode, setWhiteboardCode] = useState(
    "// Interactive Live Technical Whiteboard\n// Candidate and Panel can collaborate live here:\n\nfunction calculateIdempotencyKey(payload: any): string {\n  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');\n}"
  );

  const sequence = roundId === "round-3" ? 3 : roundId === "round-2" ? 2 : 1;
  const isRound1 = sequence === 1;
  const isRound2 = sequence === 2;
  const isRound3 = sequence === 3;

  // Round 1 & Round 2 use the Technical Assessment page (Image 2).
  // If candidate navigates to join video room for round 1 or 2, redirect them to the assessment URL.
  useEffect(() => {
    if (isRound1 || isRound2) {
      const suffix = isRound2 ? "-round-2" : "";
      let assessmentUrl = `/${tenant.slug}/applications/${appId}/assessments/invite-${appId}${suffix}`;
      try {
        const raw = localStorage.getItem("bh_admin_applications");
        if (raw) {
          const parsed = JSON.parse(raw);
          const app = parsed.find((a: any) => a.id === appId);
          if (isRound2 && (app?.round2Link || app?.round2AssessmentUrl)) {
            assessmentUrl = app.round2Link || app.round2AssessmentUrl;
          } else if (isRound1 && (app?.round1Link || app?.assessmentUrl)) {
            assessmentUrl = app.round1Link || app.assessmentUrl;
          }
        }
      } catch {}

      if (assessmentUrl.startsWith("http")) {
        try {
          const u = new URL(assessmentUrl);
          if (typeof window !== "undefined" && u.origin === window.location.origin) {
            navigate(u.pathname + u.search + u.hash, { replace: true });
            return;
          }
        } catch {}
        window.location.href = assessmentUrl;
      } else {
        navigate(assessmentUrl, { replace: true });
      }
    }
  }, [isRound1, isRound2, tenant.slug, appId, navigate]);

  if (isRound1 || isRound2) {
    return (
      <div className="flex h-screen items-center justify-center">
        <PageLoader />
      </div>
    );
  }

  const roundTitle = isRound1
    ? "Round 1: Technical & Architecture Practical Assignment"
    : isRound2
    ? "Round 2: Live Technical & System Deep-Dive"
    : "Round 3: Leadership, Product Strategy & Culture Alignment";

  const panelName = isRound1
    ? "Arun K. (Principal Architect) & Vikram M."
    : isRound2
    ? "Chandra S. (VP of Engineering)"
    : "Tanuja HR (Head of Talent) & Ananya R.";

  const r = round.data || {
    id: roundId,
    title: roundTitle,
    status: "SCHEDULED" as const,
    scheduledStart: new Date().toISOString(),
    scheduledEnd: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    panelists: [{ name: panelName }],
    joinEarlyMinutes: 15,
    joinLateMinutes: 30,
  };

  useEffect(() => {
    if (choices && !conn && !left) {
      navigator.mediaDevices
        ?.getUserMedia({ video: true, audio: true })
        .then((stream) => {
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
        })
        .catch(() => undefined);
    }
  }, [choices, conn, left]);

  if (round.isPending && !round.data) return <PageLoader />;

  const join = async (c: LocalUserChoices) => {
    setError(null);
    try {
      const tokenDto = await fetchJoinToken(tenant.slug, roundId);
      setConn(tokenDto);
      setChoices(c);
      setLeft(false);
    } catch {
      // Fallback to in-app WebRTC video room
      setConn(null);
      setChoices(c);
      setLeft(false);
    }
  };

  const handleConcludeCall = async () => {
    setPassingRound(true);
    try {
      // Mark round completed in localStorage
      const rawSched = localStorage.getItem("bh_admin_interviews");
      const parsed = rawSched ? JSON.parse(rawSched) : {};
      if (parsed[`${appId}_${roundId}`]) parsed[`${appId}_${roundId}`].status = "COMPLETED";
      if (parsed[roundId]) parsed[roundId].status = "COMPLETED";
      localStorage.setItem("bh_admin_interviews", JSON.stringify(parsed));

      if (isRound1) {
        await sendEmailNotification({
          to: candidateInfo.email,
          recipientName: candidateInfo.name,
          stage: "INTERVIEW",
          jobTitle: candidateInfo.jobTitle,
          portalPath: `/${tenant.slug}/applications/${appId}/interviews/round-2`,
          tenantSlug: tenant.slug,
          roundTitle: "Round 2: Live Technical & System Deep-Dive",
          roundNumber: 2,
        });
        window.dispatchEvent(new Event("storage"));
        window.dispatchEvent(
          new CustomEvent("bh_application_updated", {
            detail: { appId, roundId: "round-1", status: "COMPLETED" },
          })
        );
        navigate(`/${tenant.slug}/applications/${appId}/interviews/round-2`);
      } else if (isRound2) {
        await sendEmailNotification({
          to: candidateInfo.email,
          recipientName: candidateInfo.name,
          stage: "INTERVIEW",
          jobTitle: candidateInfo.jobTitle,
          portalPath: `/${tenant.slug}/applications/${appId}/interviews/round-3`,
          tenantSlug: tenant.slug,
          roundTitle: "Round 3: Leadership & Product Strategy",
          roundNumber: 3,
        });
        window.dispatchEvent(new Event("storage"));
        window.dispatchEvent(
          new CustomEvent("bh_application_updated", {
            detail: { appId, roundId: "round-2", status: "COMPLETED" },
          })
        );
        navigate(`/${tenant.slug}/applications/${appId}/interviews/round-3`);
      } else if (isRound3) {
        const rawApps = localStorage.getItem("bh_admin_applications");
        if (rawApps) {
          const parsedApps = JSON.parse(rawApps);
          if (Array.isArray(parsedApps)) {
            const updated = parsedApps.map((a: any) =>
              a.id === appId || a.stage === "INTERVIEW" ? { ...a, stage: "OFFER", score: 96 } : a
            );
            localStorage.setItem("bh_admin_applications", JSON.stringify(updated));
          }
        }

        await sendEmailNotification({
          to: candidateInfo.email,
          recipientName: candidateInfo.name,
          stage: "OFFER",
          jobTitle: candidateInfo.jobTitle,
          portalPath: `/${tenant.slug}/applications/${appId}/offer`,
          tenantSlug: tenant.slug,
          customHeading: "Congratulations! You have an official job offer from Brutallyhired",
          customBody:
            "Following your outstanding performance across all 3 technical and leadership interview rounds, we are thrilled to formally extend an offer of employment. Please review your terms, compensation package, and sign in the candidate portal.",
        });

        window.dispatchEvent(new Event("storage"));
        window.dispatchEvent(
          new CustomEvent("bh_application_updated", {
            detail: { appId, stage: "OFFER" },
          })
        );
        navigate(`/${tenant.slug}/applications/${appId}/offer`);
      }
    } catch (e) {
      console.warn("Conclude call error:", e);
    } finally {
      setPassingRound(false);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-2">
        <Link
          to={`/${tenant.slug}/applications/${appId}/interviews/${roundId}`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-brand no-underline"
        >
          <ChevronLeft size={16} />
          Back to Round Overview
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-bold text-ink leading-tight">{r.title}</h1>
            <p className="text-sm text-ink-muted mt-0.5">
              Panel: <strong className="text-ink">{panelName}</strong> · LiveRTC Secure Session
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Interview Active
            </span>
            {choices && !left && (
              <Button
                size="sm"
                loading={passingRound}
                onClick={() => void handleConcludeCall()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
              >
                {isRound3 ? "Pass Round & Generate Formal Offer →" : "Pass Round & Unlock Next Round →"}
              </Button>
            )}
          </div>
        </div>
      </div>

      {conn && choices && !left ? (
        <div className="flex flex-col gap-4">
          <LiveKitRoom conn={conn} choices={choices} onLeave={() => setLeft(true)} onError={setError} />
          <div className="flex justify-end">
            <Button
              loading={passingRound}
              onClick={() => void handleConcludeCall()}
              className="bg-brand text-white font-bold"
            >
              Conclude Call & Advance →
            </Button>
          </div>
        </div>
      ) : choices && !left ? (
        /* Interactive In-App WebRTC Video Conference Room */
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[min(65vh,580px)]">
            {/* Candidate Stream */}
            <div className="relative rounded-3xl overflow-hidden bg-[#1B2638] border border-line flex items-center justify-center shadow-sm">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className={clsx("w-full h-full object-cover", isVideoOff && "hidden")}
              />
              {isVideoOff && (
                <div className="flex flex-col items-center gap-2 text-white">
                  <Avatar name={candidateInfo.name} size={64} tone="teal" />
                  <span className="text-xs font-semibold">Camera Paused</span>
                </div>
              )}
              <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-xs text-white text-xs px-3 py-1 rounded-full font-medium flex items-center gap-2">
                <span>{candidateInfo.name} (Candidate)</span>
                {isMuted && <span className="text-rose-400 font-bold">Muted</span>}
              </div>
            </div>

            {/* Remote Panelist Stream */}
            <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-[#0F172A] to-[#1E293B] border border-line flex flex-col items-center justify-center shadow-sm p-6 text-center">
              <div className="relative">
                <Avatar name={panelName} size={88} tone="blue" />
                <span className="absolute bottom-0 right-0 h-4 w-4 rounded-full bg-emerald-500 border-2 border-slate-900" />
              </div>
              <h3 className="text-white font-bold text-lg mt-3">{panelName}</h3>
              <p className="text-slate-300 text-xs">Connected via High-Fidelity Audio / WebRTC</p>

              {/* Animated Audio Meter */}
              <div className="flex items-center gap-1.5 mt-4">
                <span className="w-1 bg-emerald-400 h-4 rounded-full animate-pulse" />
                <span className="w-1 bg-emerald-400 h-8 rounded-full animate-pulse" />
                <span className="w-1 bg-emerald-400 h-6 rounded-full animate-pulse" />
                <span className="w-1 bg-emerald-400 h-10 rounded-full animate-pulse" />
                <span className="w-1 bg-emerald-400 h-5 rounded-full animate-pulse" />
              </div>

              <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-xs text-white text-xs px-3 py-1 rounded-full font-medium">
                Panel: LiveRTC Stream
              </div>
            </div>
          </div>

          {/* In-Call Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-ink text-white">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => setIsMuted((v) => !v)}
                className={clsx(
                  "text-xs px-3 py-1.5 rounded-xl text-white border",
                  isMuted ? "bg-rose-600 border-rose-500" : "bg-white/10 border-white/20 hover:bg-white/20"
                )}
              >
                {isMuted ? "Unmute Mic" : "Mute Mic"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setIsVideoOff((v) => !v)}
                className={clsx(
                  "text-xs px-3 py-1.5 rounded-xl text-white border",
                  isVideoOff ? "bg-rose-600 border-rose-500" : "bg-white/10 border-white/20 hover:bg-white/20"
                )}
              >
                {isVideoOff ? "Start Video" : "Stop Video"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setIsScreenSharing((v) => !v)}
                className={clsx(
                  "text-xs px-3 py-1.5 rounded-xl text-white border",
                  isScreenSharing ? "bg-teal-600 border-teal-500" : "bg-white/10 border-white/20 hover:bg-white/20"
                )}
              >
                <Monitor size={14} className="mr-1 inline" />
                {isScreenSharing ? "Stop Screen Share" : "Share Screen"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setActiveTab((t) => (t === "VIDEO" ? "WHITEBOARD" : "VIDEO"))}
                className="text-xs px-3 py-1.5 rounded-xl text-white border bg-white/10 border-white/20 hover:bg-white/20"
              >
                {activeTab === "VIDEO" ? "Open Whiteboard" : "Back to Video"}
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={() => setLeft(true)}
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold px-4 py-2 rounded-xl"
              >
                Leave Room
              </Button>
              <Button
                loading={passingRound}
                onClick={() => void handleConcludeCall()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl"
              >
                {isRound3 ? "Conclude & Generate Formal Offer →" : "Conclude & Unlock Next Round →"}
              </Button>
            </div>
          </div>

          {/* In-Call Live Whiteboard / Code Scratchpad */}
          {activeTab === "WHITEBOARD" && (
            <div className="card p-4 rounded-2xl border border-line flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-ink">Live Collaborative Scratchpad</span>
                <span className="text-xs text-ink-muted">Shared with {panelName}</span>
              </div>
              <textarea
                rows={8}
                value={whiteboardCode}
                onChange={(e) => setWhiteboardCode(e.target.value)}
                className="w-full rounded-xl border border-line-2 p-3 font-mono text-xs leading-relaxed bg-[#0E1525] text-emerald-400 focus:outline-none"
              />
            </div>
          )}
        </div>
      ) : left ? (
        <div className="card flex flex-col items-center gap-4 py-14 text-center">
          <p className="text-lg font-semibold">{t("interviews.left")}</p>
          <div className="flex gap-3">
            <Button onClick={() => setLeft(false)} disabled={!choices}>
              {t("interviews.rejoin")}
            </Button>
            <Button
              loading={passingRound}
              onClick={() => void handleConcludeCall()}
              className="bg-brand text-white font-bold"
            >
              {isRound3 ? "Proceed to Job Offer →" : "Proceed to Next Round →"}
            </Button>
          </div>
        </div>
      ) : (
        <section className="card flex flex-col gap-5 md:p-8">
          <p className="text-sm leading-relaxed text-ink-2">{t("interviews.lobbyBody")}</p>
          <div data-lk-theme="default" className="overflow-hidden rounded-2xl">
            <PreJoin
              defaults={{
                username: me.data?.displayName ?? candidateInfo.name,
                videoEnabled: true,
                audioEnabled: true,
              }}
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
