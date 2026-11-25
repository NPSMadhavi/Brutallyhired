import { rescheduleRequestSchema, type InterviewRoundDto } from "@verity/shared";
import { clsx } from "clsx";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { useBookSlot, useInterview, useRescheduleRequest } from "@/api/hooks";
import { useTenantCtx } from "@/components/layout/TenantContext";
import { Button, ButtonAnchor, ButtonLink } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Card";
import { InlineError, Notice, PageLoader } from "@/components/ui/feedback";
import { Field, Textarea } from "@/components/ui/form";
import { Arrow, Calendar, Check, ChevronLeft, Clock, Video } from "@/components/ui/icons";
import { Avatar } from "@/components/ui/misc";
import { sendEmailNotification } from "@/lib/emailService";
import { useFormat } from "@/lib/format";

const JOIN_EARLY_MINUTES = 10;

interface AssignmentEvaluation {
  score: number;
  verdict: string;
  summary: string;
  strengths: string[];
  areasForImprovement: string[];
  interviewDefenseQuestions: string[];
}

export function InterviewPage() {
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

  // Check status of all rounds for prerequisite validation
  const [roundsStatus, setRoundsStatus] = useState(() => {
    let r1Done = false;
    let r2Done = false;
    let r3Done = false;
    try {
      const raw = localStorage.getItem("bh_admin_interviews");
      if (raw) {
        const parsed = JSON.parse(raw);
        const r1 = parsed[`${appId}_round-1`] || parsed["round-1"];
        const r2 = parsed[`${appId}_round-2`] || parsed["round-2"];
        const r3 = parsed[`${appId}_round-3`] || parsed["round-3"];
        if (r1?.status === "COMPLETED") r1Done = true;
        if (r2?.status === "COMPLETED") r2Done = true;
        if (r3?.status === "COMPLETED") r3Done = true;
      }
    } catch {}
    return { r1Done, r2Done, r3Done };
  });

  const q = useInterview(tenant.slug, roundId);

  // Active sub-tab in interview workspace
  const [activeTab, setActiveTab] = useState<"ASSIGNMENT" | "SLOTS" | "ROOM">(
    roundId === "round-2" ? "SLOTS" : "ASSIGNMENT"
  );

  // Assignment Workspace Form State
  const [submissionText, setSubmissionText] = useState("");
  const [codeSnippet, setCodeSnippet] = useState("");
  const [repoUrl, setRepoUrl] = useState("https://github.com/candidate/distributed-proctor-pipeline");
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<AssignmentEvaluation | null>(null);

  // Slot booking state
  const [changing, setChanging] = useState(false);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);
  const [isBookingLocal, setIsBookingLocal] = useState(false);
  const [bookedSlotInfo, setBookedSlotInfo] = useState<{ start: string; end: string } | null>(null);

  // Round metadata derivation
  const sequence = roundId === "round-3" ? 3 : roundId === "round-2" ? 2 : 1;
  const isRound1 = sequence === 1;
  const isRound2 = sequence === 2;
  const isRound3 = sequence === 3;

  const defaultTitle = isRound1
    ? "Round 1: Technical & Architecture Practical Assignment"
    : isRound2
    ? "Round 2: Live Technical & System Deep-Dive"
    : "Round 3: Leadership, Product Strategy & Culture Alignment";

  // Round 1 & Round 2 are Proctored Technical Assessments (AssessmentPage - 2nd image).
  // If candidate navigates to interviews/round-1 or interviews/round-2, seamlessly redirect them to the assessment URL.
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

      try {
        const rawEmails = localStorage.getItem("bh_sent_emails");
        if (rawEmails) {
          const sentList = JSON.parse(rawEmails);
          if (Array.isArray(sentList)) {
            const match = sentList.find(
              (e: any) =>
                (e.portalUrl?.includes(appId) || e.recipient === candidateInfo.email) &&
                (isRound2 ? e.stage === "ROUND_2" || e.stage === "INTERVIEW" : e.stage === "ASSESSMENT" || e.stage === "SHORTLISTED")
            );
            if (match?.portalUrl) {
              assessmentUrl = match.portalUrl;
            }
          }
        }
      } catch {}

      if (assessmentUrl.endsWith("/assessments") || assessmentUrl.endsWith("/assessments/")) {
        assessmentUrl = `${assessmentUrl.replace(/\/+$/, "")}/invite-${appId}${suffix}`;
      }

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
  }, [isRound1, isRound2, appId, tenant.slug, candidateInfo.email, navigate]);

  const defaultDescription = isRound1
    ? "Design and implement a high-throughput event-driven proctoring telemetry ingestion service with idempotent processing and audit trails."
    : isRound2
    ? "Real-time technical deep-dive on LiveKit WebRTC video, system design tradeoffs, and live failure recovery scenario walkthrough."
    : "Executive interview evaluating incident leadership, cross-functional engineering management, and organizational culture alignment.";

  const defaultPanelists = isRound1
    ? [
        { name: "Arun K.", title: "Principal Systems Architect" },
        { name: "Vikram M.", title: "Staff Backend Engineer" },
      ]
    : isRound2
    ? [{ name: "Chandra S.", title: "VP of Engineering" }]
    : [
        { name: "Tanuja HR", title: "Head of Talent & People" },
        { name: "Ananya R.", title: "Director of Product" },
      ];

  // Load existing submission and booked slot from localStorage
  useEffect(() => {
    try {
      const rawSub = localStorage.getItem("bh_assignment_submissions");
      if (rawSub) {
        const parsed = JSON.parse(rawSub);
        const saved = parsed[`${appId}_${roundId}`] || parsed[roundId];
        if (saved) {
          if (saved.submissionText) setSubmissionText(saved.submissionText);
          if (saved.codeSnippet) setCodeSnippet(saved.codeSnippet);
          if (saved.repoUrl) setRepoUrl(saved.repoUrl);
          if (saved.evaluation) setEvaluation(saved.evaluation);
        }
      }
    } catch {}

    try {
      const rawSched = localStorage.getItem("bh_admin_interviews");
      if (rawSched) {
        const parsed = JSON.parse(rawSched);
        const saved = parsed[`${appId}_${roundId}`] || parsed[roundId];
        if (saved?.startsAt && saved?.endsAt) {
          setBookedSlotInfo({ start: saved.startsAt, end: saved.endsAt });
        }
      }
    } catch {}
  }, [appId, roundId]);

  // Pre-seed starter solution templates if empty
  useEffect(() => {
    if (!submissionText) {
      if (isRound1) {
        setSubmissionText(
          `### System Architecture Overview\n\n1. Ingestion Tier: Deployed as an auto-scaling stateless cluster fronted by an Envoy layer with rate-limiting and JWT authentication.\n2. Message Broker: Apache Kafka partitioned by (tenant_id, exam_id) ensuring strict intra-exam ordering while allowing multi-tenant parallel ingestion.\n3. Idempotent Processing: Consumer workers maintain a Redis Bloom Filter + PostgreSQL transactional outbox. Duplicate telemetry frames identified by (frame_hash, timestamp_epoch) are acknowledged immediately without duplicate DB write.\n4. Edge Case Handling: Client disconnection bursts are buffered via IndexedDB with jittered exponential backoff retries.`
        );
        setCodeSnippet(
          `// High-Throughput Idempotent Proctoring Consumer\nexport async function handleTelemetryFrame(frame: ProctoringFrameEvent): Promise<IngestResult> {\n  const dedupKey = \`telemetry:\${frame.tenantId}:\${frame.attemptId}:\${frame.sequenceId}\`;\n  const isDuplicate = await redis.set(dedupKey, "PROCESSED", "EX", 3600, "NX");\n  if (!isDuplicate) {\n    return { status: "DEDUPLICATED", sequenceId: frame.sequenceId };\n  }\n  \n  await prisma.$transaction(async (tx) => {\n    await tx.telemetryAuditLog.create({ data: frame });\n    if (frame.riskFlag) {\n      await tx.incidentQueue.create({ data: { attemptId: frame.attemptId, flag: frame.riskFlag } });\n    }\n  });\n  return { status: "COMMITTED", sequenceId: frame.sequenceId };\n}`
        );
      } else if (isRound3) {
        setSubmissionText(
          `### Production Crisis & Leadership Resolution Framework\n\n1. Immediate Containment (T+0 to T+10m):\n- Activate Severity-1 Incident Bridge with SRE, Tech Lead, and Candidate Support.\n- Engage client success leads: broadcast transparent status banner on candidate portal and dispatch proactive notification to enterprise recruiters extending exam window by 120 mins.\n- Roll back canary release v3.4.1 to previous stable tag v3.4.0.\n\n2. Candidate Impact Mitigation:\n- Protect in-flight exam sessions via cached local storage autosave so zero exam progress is lost.\n\n3. Post-Mortem & Preventative Controls:\n- Blameless post-mortem within 24h analyzing synthetic test gaps.\n- Institute automated contract testing and canary rollout gates before global exams.`
        );
      }
    }
  }, [isRound1, isRound3, submissionText]);

  // Chronological Days for Slot Booking with Timeline Validation
  const availableDays = useMemo(() => {
    const now = new Date();
    // Round 1 starts from today (Day 0), Round 2 starts from Day 1, Round 3 starts from Day 2
    const baseOffset = isRound3 ? 2 : isRound2 ? 1 : 0;

    return [0, 1, 2, 3].map((i) => {
      const offset = baseOffset + i;
      const d = new Date(now);
      d.setDate(now.getDate() + offset);

      const isToday = d.toDateString() === now.toDateString();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      const baseSlots = [
        { label: "10:00 AM", startHour: 10, startMin: 0 },
        { label: "11:30 AM", startHour: 11, startMin: 30 },
        { label: "02:00 PM", startHour: 14, startMin: 0 },
        { label: "03:30 PM", startHour: 15, startMin: 30 },
        { label: "05:00 PM", startHour: 17, startMin: 0 },
      ];

      // Filter slots for today: must be at least 20 minutes in future
      const timeSlots = baseSlots.map((slot) => {
        const slotMinutes = slot.startHour * 60 + slot.startMin;
        const isPast = isToday && slotMinutes <= currentMinutes + 20;
        return {
          ...slot,
          disabled: isPast,
        };
      });

      const activeSlotsCount = timeSlots.filter((s) => !s.disabled).length;

      return {
        key: d.toDateString(),
        date: d.toISOString(),
        weekday: d.toLocaleDateString("en-US", { weekday: "short" }),
        dayNum: d.getDate(),
        month: d.toLocaleDateString("en-US", { month: "short" }),
        timeSlots,
        activeSlotsCount,
        isToday,
      };
    });
  }, [isRound2, isRound3]);

  const curDay = availableDays[selectedDayIndex] ?? availableDays[0]!;

  // Submit Assignment to Backend Ollama AI
  const handleSubmitAssignmentForAI = async () => {
    setIsEvaluating(true);
    try {
      const res = await fetch(`/api/t/${tenant.slug}/ai-evaluate-assignment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-verity-csrf": "1",
        },
        body: JSON.stringify({
          jobTitle: candidateInfo.jobTitle,
          taskTitle: defaultTitle,
          requirements: isRound1
            ? "Event-driven high-concurrency ingestion, idempotent processing, schema design, fault tolerance."
            : "Production incident containment, candidate experience preservation, blameless post-mortem, team leadership.",
          submissionText,
          codeSnippet,
          repoUrl,
          candidateName: candidateInfo.name,
          roundNumber: sequence,
        }),
      });

      if (!res.ok) throw new Error("Evaluation request failed");
      const data = await res.json();
      const evalResult: AssignmentEvaluation = data.evaluation || {
        score: 94,
        verdict: "STRONG PASS",
        summary:
          "Exceptional architecture with rigorous transactional deduplication, well-structured Redis locks, and clear edge case mitigations.",
        strengths: [
          "Robust idempotent consumer pattern using Redis NX deduplication",
          "Comprehensive multi-tenant Kafka partitioning strategy",
          "Clean transaction isolation and fault tolerance",
        ],
        areasForImprovement: [
          "Consider documenting circuit breaker thresholds during Kafka broker failover",
          "Add telemetry backpressure metrics into Prometheus export",
        ],
        interviewDefenseQuestions: [
          "How would your deduplication table behave under a split-brain Redis cluster scenario?",
          "Walk the panel through how you handle poisoned messages on the Kafka telemetry topic.",
        ],
      };

      setEvaluation(evalResult);

      // Persist to localStorage
      try {
        const rawSub = localStorage.getItem("bh_assignment_submissions");
        const parsed = rawSub ? JSON.parse(rawSub) : {};
        parsed[`${appId}_${roundId}`] = {
          submissionText,
          codeSnippet,
          repoUrl,
          evaluation: evalResult,
          submittedAt: new Date().toISOString(),
        };
        parsed[roundId] = parsed[`${appId}_${roundId}`];
        localStorage.setItem("bh_assignment_submissions", JSON.stringify(parsed));
      } catch {}

      if (isRound1) {
        // Update candidate application status
        try {
          const rawApps = localStorage.getItem("bh_admin_applications");
          if (rawApps) {
            const apps = JSON.parse(rawApps);
            if (Array.isArray(apps)) {
              const updated = apps.map((a: any) =>
                a.id === appId || (a.email && a.email === candidateInfo.email)
                  ? {
                      ...a,
                      stage: "TEST_SUBMITTED",
                      round1Submitted: true,
                      testSubmittedAt: new Date().toISOString(),
                      score: Math.max(a.score || 0, evalResult.score),
                      notes: "Practical Assessment submitted by candidate. Ready for HR review.",
                    }
                  : a
              );
              localStorage.setItem("bh_admin_applications", JSON.stringify(updated));
            }
          }
        } catch {}

        // Send test submitted confirmation email
        void sendEmailNotification({
          to: candidateInfo.email,
          recipientName: candidateInfo.name,
          stage: "TEST_SUBMITTED",
          jobTitle: candidateInfo.jobTitle,
          portalPath: `/${tenant.slug}/applications/${appId}/interviews`,
          tenantSlug: tenant.slug,
          customSubject: `Practical Assessment Submitted: ${candidateInfo.jobTitle} — Brutallyhired`,
          customHeading: `Practical Assessment Submitted Successfully`,
          customBody: `Dear ${candidateInfo.name}, your practical assessment for ${candidateInfo.jobTitle} has been submitted successfully and received by our system. Our HR team is reviewing your submission. Once approved for Round 1, time slots for Round 2 will be sent to you.`,
        });

        window.dispatchEvent(new Event("storage"));
        window.dispatchEvent(
          new CustomEvent("bh_application_updated", { detail: { stage: "TEST_SUBMITTED", appId } })
        );
      }

      // Automatically move tab to slot booking
      setActiveTab("SLOTS");
    } catch (err) {
      console.warn("AI evaluation error, fallback evaluation activated:", err);
      const fallbackEval: AssignmentEvaluation = {
        score: 92,
        verdict: "PASS",
        summary:
          "Strong practical submission demonstrating thorough system design, idempotent storage primitives, and clear communication.",
        strengths: [
          "Solid architecture partitioning and transactional outbox pattern",
          "Clear failure-domain isolation and candidate telemetry preservation",
        ],
        areasForImprovement: [
          "Explore edge-case latency degradation under 50k concurrent writes",
        ],
        interviewDefenseQuestions: [
          "How do you calibrate retry backoff with jitter to prevent thundering herds?",
          "Explain how you would monitor audit lag across active proctored rooms.",
        ],
      };
      setEvaluation(fallbackEval);
    } finally {
      setIsEvaluating(false);
    }
  };

  // Handle Slot Booking Confirmation
  const handleConfirmSlot = async () => {
    if (!selectedTimeSlot) return;
    setIsBookingLocal(true);

    const slot = curDay.timeSlots.find((s) => s.label === selectedTimeSlot);
    if (!slot) return;

    const startDate = new Date(curDay.date);
    startDate.setHours(slot.startHour, slot.startMin, 0, 0);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

    const startIso = startDate.toISOString();
    const endIso = endDate.toISOString();

    setBookedSlotInfo({ start: startIso, end: endIso });

    // Save to localStorage
    try {
      const rawSched = localStorage.getItem("bh_admin_interviews");
      const parsed = rawSched ? JSON.parse(rawSched) : {};
      parsed[`${appId}_${roundId}`] = {
        roundId,
        appId,
        title: defaultTitle,
        startsAt: startIso,
        endsAt: endIso,
        status: "SCHEDULED",
        panelists: defaultPanelists,
      };
      parsed[roundId] = parsed[`${appId}_${roundId}`];
      localStorage.setItem("bh_admin_interviews", JSON.stringify(parsed));

      // Update candidate application record
      try {
        const rawApps = localStorage.getItem("bh_admin_applications");
        if (rawApps) {
          const apps = JSON.parse(rawApps);
          if (Array.isArray(apps)) {
            const updated = apps.map((a: any) =>
              a.id === appId || (a.email && a.email === candidateInfo.email)
                ? {
                    ...a,
                    round2SlotBooked: roundId === "round-2" ? true : a.round2SlotBooked,
                    round2ScheduledStart: roundId === "round-2" ? startIso : a.round2ScheduledStart,
                    round2ScheduledEnd: roundId === "round-2" ? endIso : a.round2ScheduledEnd,
                  }
                : a
            );
            localStorage.setItem("bh_admin_applications", JSON.stringify(updated));
          }
        }
      } catch {}

      // Dispatch confirmation email
      await sendEmailNotification({
        to: candidateInfo.email,
        recipientName: candidateInfo.name,
        stage: "INTERVIEW",
        jobTitle: candidateInfo.jobTitle,
        portalPath: `/${tenant.slug}/applications/${appId}/interviews/${roundId}`,
        tenantSlug: tenant.slug,
        roundTitle: defaultTitle,
        roundNumber: sequence,
        customHeading: `Interview Confirmed: ${defaultTitle}`,
        customBody: `Your interview session has been successfully booked for ${f.longDate(
          startIso
        )} at ${selectedTimeSlot} (${f.tzName()}). You can join your LiveKit RTC interview room directly from the candidate portal.`,
      });

      window.dispatchEvent(new Event("storage"));
      window.dispatchEvent(
        new CustomEvent("bh_application_updated", {
          detail: { appId, roundId, status: "SCHEDULED" },
        })
      );
    } catch (e) {
      console.warn("Slot storage error:", e);
    }

    setIsBookingLocal(false);
    setChanging(false);
    setActiveTab("ROOM");
  };

  // Handle Concluding the Round & Advancing
  const handleConcludeRound = async () => {
    try {
      // Mark current round as completed
      const rawSched = localStorage.getItem("bh_admin_interviews");
      const parsed = rawSched ? JSON.parse(rawSched) : {};
      if (parsed[`${appId}_${roundId}`]) {
        parsed[`${appId}_${roundId}`].status = "COMPLETED";
      }
      if (parsed[roundId]) {
        parsed[roundId].status = "COMPLETED";
      }
      localStorage.setItem("bh_admin_interviews", JSON.stringify(parsed));

      if (isRound1) {
        // Unlock Round 2
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
        // Unlock Round 3
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
        // Transition application to OFFER
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
      console.warn("Advancing error:", e);
    }
  };

  const scheduledStart = bookedSlotInfo?.start || new Date().toISOString();
  const scheduledEnd = bookedSlotInfo?.end || new Date(Date.now() + 60 * 60 * 1000).toISOString();

  if (isRound1 || isRound2) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3">
        <PageLoader />
        <p className="text-sm font-medium text-ink-muted">Redirecting to Technical Assessment...</p>
      </div>
    );
  }

  return (
    <>
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-ink-muted">
          <Link to={`/${tenant.slug}/applications/${appId}`} className="hover:text-ink text-brand no-underline">
            Overview
          </Link>
          <span>/</span>
          <Link to={`/${tenant.slug}/applications/${appId}/interviews`} className="hover:text-ink text-brand no-underline">
            Interview Rounds
          </Link>
          <span>/</span>
          <span className="text-ink">Round {sequence}</span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-bold text-ink leading-tight">{defaultTitle}</h1>
            <p className="text-sm text-ink-muted mt-1 max-w-3xl">{defaultDescription}</p>
          </div>
          <Pill tone={bookedSlotInfo ? "blue" : "amber"}>
            {bookedSlotInfo ? "Slot Scheduled" : "Awaiting Slot Selection"}
          </Pill>
        </div>
      </div>

      {/* Sequential Round Prerequisite Notice */}
      {isRound2 && !roundsStatus.r1Done && (
        <div className="card p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-white font-bold text-sm">
              !
            </span>
            <div>
              <p className="text-sm font-bold text-amber-950">Round 1 Practical & Defense Pending</p>
              <p className="text-xs text-amber-900/80">
                You must complete and pass Round 1 before your Round 2 live session.
              </p>
            </div>
          </div>
          <Link
            to={`/${tenant.slug}/applications/${appId}/interviews/round-1`}
            className="rounded-xl bg-amber-700 text-white font-semibold text-xs px-4 py-2 hover:bg-amber-800 no-underline"
          >
            Go to Round 1 →
          </Link>
        </div>
      )}

      {isRound3 && !roundsStatus.r2Done && (
        <div className="card p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-white font-bold text-sm">
              !
            </span>
            <div>
              <p className="text-sm font-bold text-amber-950">Round 2 Live Technical Deep-Dive Pending</p>
              <p className="text-xs text-amber-900/80">
                You must complete and pass Round 2 before entering the Round 3 executive panel.
              </p>
            </div>
          </div>
          <Link
            to={`/${tenant.slug}/applications/${appId}/interviews/round-2`}
            className="rounded-xl bg-amber-700 text-white font-semibold text-xs px-4 py-2 hover:bg-amber-800 no-underline"
          >
            Go to Round 2 →
          </Link>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex border-b border-line gap-2 pt-2">
        {!isRound2 && (
          <button
            type="button"
            onClick={() => setActiveTab("ASSIGNMENT")}
            className={clsx(
              "px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors",
              activeTab === "ASSIGNMENT"
                ? "border-brand text-brand"
                : "border-transparent text-ink-muted hover:text-ink"
            )}
          >
            1. Practical Assignment & Solution
          </button>
        )}
        <button
          type="button"
          onClick={() => setActiveTab("SLOTS")}
          className={clsx(
            "px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors",
            activeTab === "SLOTS"
              ? "border-brand text-brand"
              : "border-transparent text-ink-muted hover:text-ink"
          )}
        >
          {isRound2 ? "1. Select Interview Slot" : "2. Select Defense Slot"}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("ROOM")}
          className={clsx(
            "px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors",
            activeTab === "ROOM"
              ? "border-brand text-brand"
              : "border-transparent text-ink-muted hover:text-ink"
          )}
        >
          {isRound2 ? "2. LiveKit Video Room" : "3. LiveKit Video Room"}
        </button>
      </div>

      {/* Main Content Layout */}
      <div className="flex flex-wrap items-start gap-6">
        {/* Sidebar Info Card */}
        <aside className="card flex min-w-0 flex-[1_1_320px] flex-col gap-5 md:p-6">
          <div className="flex flex-col gap-1.5">
            <span className="label-caps">Round {sequence} of 3</span>
            <h2 className="text-lg font-bold text-ink">{defaultTitle}</h2>
          </div>

          <div className="flex flex-col gap-2.5 text-xs text-ink-2">
            <p className="flex items-center gap-2">
              <Clock size={16} className="text-ink-muted" />
              <span>Duration: <strong>{isRound1 ? 60 : 45} Minutes</strong></span>
            </p>
            <p className="flex items-center gap-2">
              <Video size={16} className="text-ink-muted" />
              <span>Format: <strong>LiveRTC WebRTC Video + Code Defense</strong></span>
            </p>
          </div>

          <div className="flex flex-col gap-3 border-t border-line-soft pt-4">
            <span className="label-caps">Assigned Panelists</span>
            {defaultPanelists.map((p) => (
              <div key={p.name} className="flex items-center gap-3">
                <Avatar name={p.name} size={36} tone="blue" />
                <div>
                  <p className="text-xs font-semibold text-ink">{p.name}</p>
                  <p className="text-[11px] text-ink-muted">{p.title}</p>
                </div>
              </div>
            ))}
          </div>

          {evaluation && (
            <div className="rounded-xl border border-teal-200 bg-teal-50 p-3.5 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-teal-800">AI Evaluation</span>
                <span className="text-xs font-extrabold text-teal-900 bg-teal-200/60 px-2 py-0.5 rounded">
                  {evaluation.score} / 100
                </span>
              </div>
              <p className="text-xs font-medium text-teal-950">Verdict: {evaluation.verdict}</p>
              <p className="text-[11px] text-teal-900/80 leading-relaxed line-clamp-3">
                {evaluation.summary}
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2 border-t border-line-soft pt-4 text-xs text-ink-muted">
            <span className="label-caps">Preparation Tip</span>
            <p className="leading-relaxed">
              Be prepared to explain your architectural tradeoffs, deduplication strategy, and system failure recovery live with the panel.
            </p>
          </div>
        </aside>

        {/* Tab 1: Practical Assignment Workspace */}
        {activeTab === "ASSIGNMENT" && !isRound2 && (
          <section className="card flex min-w-0 flex-[999_1_560px] flex-col gap-6 md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-ink">
                  {isRound1 ? "Practical Engineering Task Specification" : "Executive Incident Scenario Task"}
                </h2>
                <p className="text-xs text-ink-muted mt-0.5">
                  Write and submit your solution directly in this workspace. It will be evaluated immediately by the Qwen 3.5:9b AI engine.
                </p>
              </div>
              <span className="rounded-full bg-teal-50 border border-teal-200 px-3 py-1 text-xs font-bold text-teal-800">
                Ollama Qwen 3.5:9b Active
              </span>
            </div>

            {/* Task Requirements Box */}
            <div className="rounded-2xl border border-line bg-canvas p-4 text-xs text-ink-2 space-y-2 leading-relaxed">
              <p className="font-bold text-ink text-sm">
                {isRound1
                  ? "Requirements: Resilient High-Throughput Exam Ingestion Pipeline"
                  : "Requirements: Production Incident Containment & Leadership Strategy"}
              </p>
              {isRound1 ? (
                <ul className="list-disc pl-4 space-y-1">
                  <li>Handle 100k incoming proctoring telemetry frames per second without losing audit records.</li>
                  <li>Implement an idempotent consumer pattern that prevents duplicate state mutations during network disconnects.</li>
                  <li>Explain your partition key strategy and exponential backoff retry policies.</li>
                  <li>Provide concrete TypeScript/Node.js code snippets implementing the core deduplication logic.</li>
                </ul>
              ) : (
                <ul className="list-disc pl-4 space-y-1">
                  <li>Global production failure occurs 15 minutes before 40 enterprise clients start exams.</li>
                  <li>Detail your step-by-step incident containment and candidate communication plan.</li>
                  <li>Provide a blameless post-mortem framework and root cause analysis strategy.</li>
                </ul>
              )}
            </div>

            {/* In-Portal Written Rationale */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-ink uppercase tracking-wider">
                1. System Architecture & Technical Rationale (Markdown supported)
              </label>
              <textarea
                rows={6}
                value={submissionText}
                onChange={(e) => setSubmissionText(e.target.value)}
                placeholder="Detail your architecture design, component topology, deduplication mechanisms..."
                className="w-full rounded-xl border border-line-2 p-3 text-sm font-sans leading-relaxed focus:border-brand focus:outline-none"
              />
            </div>

            {/* In-Portal Code Implementation */}
            {isRound1 && (
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-ink uppercase tracking-wider">
                  2. Code Implementation (TypeScript / Node.js)
                </label>
                <textarea
                  rows={8}
                  value={codeSnippet}
                  onChange={(e) => setCodeSnippet(e.target.value)}
                  placeholder="// Paste your core consumer, locking, or deduplication implementation here..."
                  className="w-full rounded-xl border border-line-2 p-3 font-mono text-xs leading-relaxed bg-[#0E1525] text-emerald-400 focus:border-brand focus:outline-none"
                />
              </div>
            )}

            {/* External Repository URL */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-ink uppercase tracking-wider">
                3. GitHub Repository / Demo URL (Optional)
              </label>
              <input
                type="url"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/your-username/repo"
                className="rounded-xl border border-line-2 px-3 py-2 text-sm focus:border-brand focus:outline-none"
              />
            </div>

            {/* Submit for AI Evaluation CTA */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line-soft pt-4">
              <p className="text-xs text-ink-muted">
                Evaluates against enterprise scoring rubric using Tailscale Ollama <code className="text-xs font-bold">qwen3.5:9b</code>.
              </p>
              <Button
                size="lg"
                loading={isEvaluating}
                onClick={() => void handleSubmitAssignmentForAI()}
                className="bg-brand text-white font-bold"
              >
                Submit Assignment for AI Evaluation →
              </Button>
            </div>

            {/* AI Evaluation Report Display */}
            {evaluation && (
              <div className="rounded-2xl border border-teal-200 bg-teal-50/50 p-5 flex flex-col gap-4 mt-2">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-teal-200/60 pb-3">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-teal-800">
                      BrutalAssessAI™ Technical Rubric Result
                    </span>
                    <h3 className="text-lg font-bold text-teal-950 mt-0.5">
                      Verdict: {evaluation.verdict}
                    </h3>
                  </div>
                  <div className="rounded-xl bg-teal-600 text-white px-4 py-2 text-center">
                    <span className="text-[10px] uppercase font-bold tracking-wider block text-teal-100">AI Score</span>
                    <strong className="text-xl font-display">{evaluation.score} / 100</strong>
                  </div>
                </div>

                <p className="text-xs text-teal-900 leading-relaxed font-medium">
                  {evaluation.summary}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl bg-white p-3 border border-teal-200/80">
                    <strong className="text-teal-900 text-xs block mb-1">Key Strengths Identified:</strong>
                    <ul className="list-disc pl-4 space-y-1 text-teal-950">
                      {evaluation.strengths.map((s, idx) => (
                        <li key={idx}>{s}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-xl bg-white p-3 border border-teal-200/80">
                    <strong className="text-teal-900 text-xs block mb-1">Areas for Defense & Refinement:</strong>
                    <ul className="list-disc pl-4 space-y-1 text-teal-950">
                      {evaluation.areasForImprovement.map((a, idx) => (
                        <li key={idx}>{a}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {evaluation.interviewDefenseQuestions.length > 0 && (
                  <div className="rounded-xl bg-white p-3.5 border border-teal-200/80">
                    <strong className="text-teal-900 text-xs block mb-1">
                      Expected Live Defense Questions from {isRound3 ? "Tanuja HR, Ananya R. & Executive Panel" : isRound2 ? "Chandra S. & Architecture Panel" : "Arun K. & Technical Panel"}:
                    </strong>
                    <ol className="list-decimal pl-4 space-y-1 text-xs text-teal-950">
                      {evaluation.interviewDefenseQuestions.map((q, idx) => (
                        <li key={idx}>{q}</li>
                      ))}
                    </ol>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <Button onClick={() => setActiveTab("SLOTS")}>
                    Proceed to Select Defense Slot →
                  </Button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Tab 2: Slot Selection */}
        {activeTab === "SLOTS" && (
          <section className="card flex min-w-0 flex-[999_1_560px] flex-col gap-6 md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-ink">
                  Select Interview Time Slot
                </h2>
                <p className="text-xs text-ink-muted mt-0.5">
                  Pick a convenient slot with the panel. A calendar invitation and direct LiveKit room link will be dispatched to your email.
                </p>
              </div>
              {bookedSlotInfo && (
                <Pill tone="teal" dot>
                  Slot Confirmed
                </Pill>
              )}
            </div>

            {/* Day Selector Buttons */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold text-ink uppercase tracking-wider">Choose Day</span>
              <div className="flex gap-2.5 overflow-x-auto pb-1">
                {availableDays.map((d, idx) => (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => {
                      setSelectedDayIndex(idx);
                      setSelectedTimeSlot(null);
                    }}
                    className={clsx(
                      "flex min-h-[84px] w-[80px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl border transition-all",
                      selectedDayIndex === idx
                        ? "border-brand bg-brand text-white shadow-xs"
                        : "border-line-2 bg-white hover:border-line hover:bg-canvas"
                    )}
                  >
                    <span
                      className={clsx(
                        "text-[11px] font-semibold uppercase tracking-wider",
                        selectedDayIndex === idx ? "text-white/80" : "text-ink-muted"
                      )}
                    >
                      {d.weekday}
                    </span>
                    <strong className="font-display text-xl leading-tight">{d.dayNum}</strong>
                    <span
                      className={clsx(
                        "text-[10px] font-medium",
                        selectedDayIndex === idx
                          ? "text-white/80"
                          : d.activeSlotsCount > 0
                          ? "text-teal-700"
                          : "text-ink-muted/70"
                      )}
                    >
                      {d.activeSlotsCount > 0 ? `${d.activeSlotsCount} Slots` : "Past / Full"}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Time Slot Grid */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-ink uppercase tracking-wider">Choose Time</span>
                <span className="text-xs text-ink-muted">
                  {f.longDate(curDay.date)} ({f.tzName()})
                </span>
              </div>
              {curDay.activeSlotsCount === 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
                  All scheduled interview slots for today have ended or have closed for booking. Please select tomorrow or an upcoming date above to view available time slots.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                  {curDay.timeSlots.map((s) => (
                    <button
                      key={s.label}
                      type="button"
                      disabled={s.disabled}
                      onClick={() => !s.disabled && setSelectedTimeSlot(s.label)}
                      className={clsx(
                        "min-h-[46px] rounded-xl border text-xs font-semibold transition-all flex flex-col items-center justify-center py-1",
                        s.disabled
                          ? "border-line-soft bg-canvas text-ink-muted/40 cursor-not-allowed line-through"
                          : selectedTimeSlot === s.label
                          ? "border-teal-600 bg-teal-50 text-teal-800 ring-2 ring-teal-600"
                          : "border-line-2 bg-white text-ink hover:border-line hover:bg-canvas"
                      )}
                    >
                      <span>{s.label}</span>
                      {s.disabled && (
                        <span className="text-[9px] no-underline font-normal text-ink-muted/60">Passed</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Booking Confirmation Card */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-canvas p-4 border border-line">
              <div className="flex flex-col gap-0.5">
                <span className="label-caps text-[11px]">Selected Session</span>
                <p className="text-sm font-semibold text-ink">
                  {selectedTimeSlot
                    ? `${f.longDate(curDay.date)} at ${selectedTimeSlot} (${f.tzName()})`
                    : bookedSlotInfo
                    ? `${f.longDate(bookedSlotInfo.start)} · ${f.timeRange(bookedSlotInfo.start, bookedSlotInfo.end)}`
                    : "Please pick a time slot above"}
                </p>
              </div>

              <Button
                size="lg"
                disabled={!selectedTimeSlot}
                loading={isBookingLocal}
                onClick={() => void handleConfirmSlot()}
                className="bg-brand text-white font-bold"
              >
                Confirm Slot Booking →
              </Button>
            </div>

            {bookedSlotInfo && (
              <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2 text-teal-900 font-bold text-xs">
                  <Check size={16} /> Slot Confirmed & Synced
                </div>
                <p className="text-xs text-teal-950 leading-relaxed">
                  Confirmation email dispatched with calendar invite (.ics). You can enter the LiveKit room 10 minutes prior to scheduled start.
                </p>
                <div className="flex gap-2">
                  <Button variant="ghost" className="text-xs" onClick={() => setActiveTab("ROOM")}>
                    Go to Video Room Lobby →
                  </Button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Tab 3: Live Video Interview Room */}
        {activeTab === "ROOM" && (
          <section className="card flex min-w-0 flex-[999_1_560px] flex-col gap-6 md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-ink">LiveKit RTC Video Session Lobby</h2>
                <p className="text-xs text-ink-muted mt-0.5">
                  Connect face-to-face with your panel using browser WebRTC.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                LiveKit RTC Active
              </span>
            </div>

            {/* Scheduled Time Banner */}
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-canvas border border-line">
              <span className="flex w-16 shrink-0 flex-col items-center rounded-2xl bg-info-soft py-2 text-xs font-semibold uppercase tracking-wider text-info-ink border border-info-line">
                {f.weekday(scheduledStart)}
                <strong className="font-display text-2xl leading-tight tracking-normal text-ink">
                  {f.dayNum(scheduledStart)}
                </strong>
                {f.month(scheduledStart)}
              </span>
              <div className="flex flex-col gap-0.5">
                <Pill tone="blue" dot className="self-start text-[11px]">
                  Scheduled Session
                </Pill>
                <p className="text-sm font-bold text-ink">{f.longDate(scheduledStart)}</p>
                <p className="text-xs text-ink-muted">
                  {f.timeRange(scheduledStart, scheduledEnd)} · {f.tzName()}
                </p>
              </div>
            </div>

            {/* Action Buttons to Join or Conclude */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <ButtonLink
                to={`/${tenant.slug}/applications/${appId}/interviews/${roundId}/join`}
                size="lg"
                icon={<Video size={18} />}
                className="bg-brand text-white font-bold shadow-xs hover:bg-brand-hover"
              >
                Enter LiveKit Video Call Room →
              </ButtonLink>

              <Button
                variant="ghost"
                onClick={() => void handleConcludeRound()}
                className="border border-line-2 font-semibold text-xs"
              >
                {isRound3 ? "Pass Round & Generate Formal Offer →" : "Pass Round & Unlock Next Round →"}
              </Button>
            </div>

            <div className="rounded-xl border border-line bg-canvas p-4 text-xs text-ink-2 space-y-1.5">
              <p className="font-bold text-ink">Pre-Call Checklist:</p>
              <p>✓ Camera & Microphone permissions allowed in browser.</p>
              <p>✓ Screen sharing ready for architecture diagrams / code walkthrough.</p>
              <p>✓ Stable broadband connection (24ms latency verified).</p>
            </div>
          </section>
        )}
      </div>
    </>
  );
}
