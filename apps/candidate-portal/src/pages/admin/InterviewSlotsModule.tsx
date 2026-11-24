import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { Card, Pill } from "@/components/ui/Card";
import {
  Alert,
  Briefcase,
  Calendar,
  Check,
  Clock,
  Copy,
  Download,
  Eye,
  File,
  Mail,
  Plus,
  Shield,
  Sparkle,
  Trash,
  User,
  Users,
  Video,
  X,
} from "@/components/ui/icons";
import { sendEmailNotification } from "@/lib/emailService";

export interface InterviewSlotItem {
  id: string;
  jobId: string;
  jobTitle: string;
  roundNumber: number;
  roundName: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  durationMinutes: number;
  interviewerName: string;
  interviewerEmail: string;
  mode: "LIVEKIT_VIDEO" | "GOOGLE_MEET" | "IN_PERSON";
  status: "AVAILABLE" | "BOOKED" | "COMPLETED";
  bookedCandidateId?: string;
  bookedCandidateName?: string;
  bookedCandidateEmail?: string;
  meetingLink?: string;
  notes?: string;
  createdAt: string;
}

interface JobItem {
  id: string;
  title: string;
  department?: string;
  location?: string;
  experience?: string;
  keywords?: string;
  workplaceType?: string;
  status: string;
  applicantCount: number;
  externalRef: string;
}

interface ApplicationItem {
  id: string;
  candidateName?: string;
  email: string;
  phone?: string;
  city?: string;
  experience?: string;
  jobTitle: string;
  department?: string;
  stage: string;
  score: number;
  submittedAt: string;
}

interface InterviewSlotsModuleProps {
  jobs: JobItem[];
  applications: ApplicationItem[];
  tenant: { slug: string; name: string };
}

// Standard Assessment Rounds for slot assignment
const STANDARD_ROUNDS = [
  { roundNumber: 1, name: "Round 1: Technical & Architecture Practical Assignment", duration: 60 },
  { roundNumber: 2, name: "Round 2: Live Technical & System Deep-Dive", duration: 45 },
  { roundNumber: 3, name: "Round 3: Leadership, Product Strategy & Culture Alignment", duration: 45 },
];

function getTomorrowDateString(offsetDays = 1): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function InterviewSlotsModule({ jobs, applications, tenant }: InterviewSlotsModuleProps) {
  // Selected Job Role
  const [selectedJobId, setSelectedJobId] = useState<string>(() => jobs[0]?.id || "default");
  const selectedJob = jobs.find((j) => j.id === selectedJobId) || jobs[0] || {
    id: "default",
    title: "Software Developer",
    department: "Engineering",
    location: "Visakhapatnam (Hybrid)",
    experience: "1+ years",
    keywords: "TypeScript, React, Node.js",
    workplaceType: "HYBRID",
    status: "OPEN",
    applicantCount: 1,
    externalRef: "software-developer",
  };

  // Selected Round Number (1, 2, 3)
  const [selectedRoundNum, setSelectedRoundNum] = useState<number>(1);
  const selectedRound = STANDARD_ROUNDS.find((r) => r.roundNumber === selectedRoundNum) || STANDARD_ROUNDS[0]!;

  // Slots State
  const [slots, setSlots] = useState<InterviewSlotItem[]>(() => {
    try {
      const saved = localStorage.getItem("bh_interview_slots_all");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}

    // Initial realistic sample slots
    const tomorrow = getTomorrowDateString(1);
    const dayAfter = getTomorrowDateString(2);
    return [
      {
        id: "slot-sample-1",
        jobId: jobs[0]?.id || "default",
        jobTitle: jobs[0]?.title || "Software Developer",
        roundNumber: 1,
        roundName: "Round 1: Technical Assessment (MCQ)",
        date: tomorrow,
        startTime: "10:00",
        endTime: "11:00",
        durationMinutes: 60,
        interviewerName: "Tanuja HR",
        interviewerEmail: "hr@brutallyhired.com",
        mode: "LIVEKIT_VIDEO",
        status: "BOOKED",
        bookedCandidateId: applications[0]?.id || "app-101",
        bookedCandidateName: applications[0]?.candidateName || "Rahul Sharma",
        bookedCandidateEmail: applications[0]?.email || "rahul.sharma@example.com",
        meetingLink: `https://meet.livekit.io/brutallyhired-r1-tech-${Date.now().toString(36)}`,
        createdAt: new Date().toISOString(),
      },
      {
        id: "slot-sample-2",
        jobId: jobs[0]?.id || "default",
        jobTitle: jobs[0]?.title || "Software Developer",
        roundNumber: 1,
        roundName: "Round 1: Technical Assessment (MCQ)",
        date: tomorrow,
        startTime: "14:00",
        endTime: "15:00",
        durationMinutes: 60,
        interviewerName: "Lead System Architect",
        interviewerEmail: "tech.lead@brutallyhired.com",
        mode: "LIVEKIT_VIDEO",
        status: "AVAILABLE",
        meetingLink: `https://meet.livekit.io/brutallyhired-r1-tech-open`,
        createdAt: new Date().toISOString(),
      },
      {
        id: "slot-sample-3",
        jobId: jobs[0]?.id || "default",
        jobTitle: jobs[0]?.title || "Software Developer",
        roundNumber: 2,
        roundName: "Round 2: Practical Task (Coding / Project)",
        date: dayAfter,
        startTime: "11:30",
        endTime: "12:30",
        durationMinutes: 60,
        interviewerName: "Principal Engineer",
        interviewerEmail: "eng.panel@brutallyhired.com",
        mode: "LIVEKIT_VIDEO",
        status: "AVAILABLE",
        meetingLink: `https://meet.livekit.io/brutallyhired-r2-practical`,
        createdAt: new Date().toISOString(),
      },
      {
        id: "slot-sample-4",
        jobId: jobs[0]?.id || "default",
        jobTitle: jobs[0]?.title || "Software Developer",
        roundNumber: 3,
        roundName: "Round 3: Manager Round (Leadership & Culture)",
        date: dayAfter,
        startTime: "16:00",
        endTime: "17:00",
        durationMinutes: 60,
        interviewerName: "Engineering Director",
        interviewerEmail: "director@brutallyhired.com",
        mode: "LIVEKIT_VIDEO",
        status: "AVAILABLE",
        meetingLink: `https://meet.livekit.io/brutallyhired-r3-manager`,
        createdAt: new Date().toISOString(),
      },
    ];
  });

  // New Slot Form State
  const [newSlotDate, setNewSlotDate] = useState<string>(getTomorrowDateString(1));
  const [newSlotStartTime, setNewSlotStartTime] = useState<string>("10:00");
  const [newSlotEndTime, setNewSlotEndTime] = useState<string>("11:00");
  const [newSlotInterviewer, setNewSlotInterviewer] = useState<string>("Tanuja HR");
  const [newSlotEmail, setNewSlotEmail] = useState<string>("hr@brutallyhired.com");
  const [newSlotMode, setNewSlotMode] = useState<"LIVEKIT_VIDEO" | "GOOGLE_MEET" | "IN_PERSON">("LIVEKIT_VIDEO");

  const [notice, setNotice] = useState<string>("");
  const [copiedSlotId, setCopiedSlotId] = useState<string | null>(null);

  // Filter slots for active Job and Round
  const currentSlots = useMemo(() => {
    return slots.filter((s) => s.jobId === selectedJob.id && s.roundNumber === selectedRoundNum);
  }, [slots, selectedJob.id, selectedRoundNum]);

  // Save all slots to localStorage
  const handleSaveSlots = () => {
    localStorage.setItem("bh_interview_slots_all", JSON.stringify(slots));
    setNotice(`Saved ${slots.length} interview slots across all rounds!`);
    setTimeout(() => setNotice(""), 3500);
  };

  // Add individual slot
  const handleAddSlot = (e: React.FormEvent) => {
    e.preventDefault();
    const token = Math.random().toString(36).substring(2, 9);
    const newSlot: InterviewSlotItem = {
      id: `slot-${Date.now()}`,
      jobId: selectedJob.id,
      jobTitle: selectedJob.title,
      roundNumber: selectedRoundNum,
      roundName: selectedRound.name,
      date: newSlotDate,
      startTime: newSlotStartTime,
      endTime: newSlotEndTime,
      durationMinutes: 60,
      interviewerName: newSlotInterviewer.trim() || "Tanuja HR",
      interviewerEmail: newSlotEmail.trim() || "hr@brutallyhired.com",
      mode: newSlotMode,
      status: "AVAILABLE",
      meetingLink: `https://meet.livekit.io/bh-${selectedJob.id.slice(0, 6)}-r${selectedRoundNum}-${token}`,
      createdAt: new Date().toISOString(),
    };

    const updated = [newSlot, ...slots];
    setSlots(updated);
    localStorage.setItem("bh_interview_slots_all", JSON.stringify(updated));
    setNotice(`Added new interview slot on ${newSlotDate} at ${newSlotStartTime}!`);
    setTimeout(() => setNotice(""), 3500);
  };

  // Generate 4 standard daily slots automatically
  const handleGenerateStandardSlots = () => {
    const times = [
      { start: "10:00", end: "11:00" },
      { start: "11:30", end: "12:30" },
      { start: "14:00", end: "15:00" },
      { start: "16:00", end: "17:00" },
    ];

    const generated: InterviewSlotItem[] = times.map((t, idx) => ({
      id: `slot-std-${Date.now()}-${idx}`,
      jobId: selectedJob.id,
      jobTitle: selectedJob.title,
      roundNumber: selectedRoundNum,
      roundName: selectedRound.name,
      date: newSlotDate,
      startTime: t.start,
      endTime: t.end,
      durationMinutes: 60,
      interviewerName: newSlotInterviewer,
      interviewerEmail: newSlotEmail,
      mode: "LIVEKIT_VIDEO",
      status: "AVAILABLE",
      meetingLink: `https://meet.livekit.io/bh-${selectedJob.id.slice(0, 4)}-r${selectedRoundNum}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
    }));

    const updated = [...generated, ...slots];
    setSlots(updated);
    localStorage.setItem("bh_interview_slots_all", JSON.stringify(updated));
    setNotice(`⚡ Generated 4 daily interview slots for ${selectedRound.name} on ${newSlotDate}!`);
    setTimeout(() => setNotice(""), 3500);
  };

  // Delete slot
  const handleDeleteSlot = (slotId: string) => {
    const updated = slots.filter((s) => s.id !== slotId);
    setSlots(updated);
    localStorage.setItem("bh_interview_slots_all", JSON.stringify(updated));
  };

  // Assign candidate to slot and send booking confirmation
  const handleAssignCandidateToSlot = async (slotId: string, candidateId: string) => {
    const candidate = applications.find((a) => a.id === candidateId);
    if (!candidate) return;

    const updated = slots.map((s) => {
      if (s.id === slotId) {
        return {
          ...s,
          status: "BOOKED" as const,
          bookedCandidateId: candidate.id,
          bookedCandidateName: candidate.candidateName || "Candidate",
          bookedCandidateEmail: candidate.email,
        };
      }
      return s;
    });

    setSlots(updated);
    localStorage.setItem("bh_interview_slots_all", JSON.stringify(updated));

    // Send interview invitation email to candidate
    try {
      const slot = slots.find((s) => s.id === slotId);
      await sendEmailNotification({
        to: candidate.email,
        recipientName: candidate.candidateName || "Candidate",
        stage: "INTERVIEW",
        jobTitle: selectedJob.title,
        portalPath: `/${tenant.slug}/interviews`,
        tenantSlug: tenant.slug,
        customHeading: `Interview Slot Confirmed: ${selectedRound.name}`,
        customBody: `Your interview slot for ${selectedRound.name} (${selectedJob.title}) has been confirmed for ${slot?.date || "Upcoming"} at ${slot?.startTime || "10:00 AM"}. Panel Host: ${slot?.interviewerName || "Interview Panel"}. Meeting Room: ${slot?.meetingLink || "LiveKit Proctored Room"}.`,
      });
      setNotice(`✓ Assigned ${candidate.candidateName} and emailed slot confirmation!`);
    } catch {
      setNotice(`✓ Assigned ${candidate.candidateName} to slot.`);
    }

    setTimeout(() => setNotice(""), 3500);
  };

  // Copy slot meeting link
  const handleCopyMeetingLink = (slot: InterviewSlotItem) => {
    const link = slot.meetingLink || `https://meet.livekit.io/bh-room-${slot.id}`;
    navigator.clipboard.writeText(link);
    setCopiedSlotId(slot.id);
    setTimeout(() => setCopiedSlotId(null), 2500);
  };

  return (
    <div className="space-y-6">
      {/* ── MODULE HEADER ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Interview Slots</h1>
          <p className="text-sm text-ink-muted">
            Configure, manage, and book date and time slots for specific job roles and assessment rounds.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {notice && (
            <div className="flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-1.5 text-xs font-bold text-emerald-800 shadow-xs">
              <Check size={14} />
              <span>{notice}</span>
            </div>
          )}
          <Button variant="primary" onClick={handleSaveSlots} className="text-xs font-bold shadow-sm">
            <Check size={14} />
            <span>Save All Slots</span>
          </Button>
        </div>
      </div>

      {/* ── CONTEXT SELECTION BAR: JOB ROLE & SPECIFIC ROUND ── */}
      <Card className="p-4 sm:p-5 border-brand/20 bg-gradient-to-r from-canvas via-white to-brand/5 shadow-sm space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-line pb-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* 1. Job Role Selector */}
            <div>
              <span className="text-[11px] font-bold text-ink-muted uppercase tracking-wider block mb-1">
                1. Select Job Role:
              </span>
              <select
                value={selectedJob.id}
                onChange={(e) => setSelectedJobId(e.target.value)}
                className="rounded-xl border border-line bg-surface px-3 py-2 text-xs font-bold text-ink focus:border-brand focus:outline-none min-w-[220px] shadow-xs cursor-pointer"
              >
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title} ({j.department || "Technology"})
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Specific Assessment Round Selector */}
            <div>
              <span className="text-[11px] font-bold text-ink-muted uppercase tracking-wider block mb-1">
                2. Select Assessment Round:
              </span>
              <div className="flex items-center bg-surface border border-line rounded-xl p-1 shadow-xs">
                {STANDARD_ROUNDS.map((r) => {
                  const isSelected = selectedRoundNum === r.roundNumber;
                  return (
                    <button
                      key={r.roundNumber}
                      type="button"
                      onClick={() => setSelectedRoundNum(r.roundNumber)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        isSelected
                          ? "bg-brand text-brand-fg shadow-xs"
                          : "text-ink-muted hover:text-ink hover:bg-canvas"
                      }`}
                    >
                      Round {r.roundNumber} ({r.name.split(":")[1]?.trim() || r.name})
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="text-right text-xs">
            <span className="font-bold text-ink block">{selectedRound.name}</span>
            <span className="text-ink-muted text-[11px]">
              Configuring slots for <strong>{selectedJob.title}</strong>
            </span>
          </div>
        </div>

        {/* ── CREATE NEW INTERVIEW SLOT FORM ── */}
        <form onSubmit={handleAddSlot} className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-muted block">
              Set Date & Time Slots for {selectedRound.name}
            </span>
            <button
              type="button"
              onClick={handleGenerateStandardSlots}
              className="text-xs font-bold text-brand hover:underline flex items-center gap-1"
            >
              <Sparkle size={13} />
              <span>⚡ Generate 4 Standard Daily Slots</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            {/* Date */}
            <div>
              <label className="text-[10px] font-bold text-ink-muted uppercase block mb-1">Interview Date:</label>
              <input
                type="date"
                value={newSlotDate}
                onChange={(e) => setNewSlotDate(e.target.value)}
                className="w-full rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink focus:border-brand focus:outline-none"
                required
              />
            </div>

            {/* Start Time */}
            <div>
              <label className="text-[10px] font-bold text-ink-muted uppercase block mb-1">Start Time:</label>
              <input
                type="time"
                value={newSlotStartTime}
                onChange={(e) => setNewSlotStartTime(e.target.value)}
                className="w-full rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink focus:border-brand focus:outline-none"
                required
              />
            </div>

            {/* End Time */}
            <div>
              <label className="text-[10px] font-bold text-ink-muted uppercase block mb-1">End Time:</label>
              <input
                type="time"
                value={newSlotEndTime}
                onChange={(e) => setNewSlotEndTime(e.target.value)}
                className="w-full rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink focus:border-brand focus:outline-none"
                required
              />
            </div>

            {/* Interviewer Host */}
            <div>
              <label className="text-[10px] font-bold text-ink-muted uppercase block mb-1">Interviewer Host:</label>
              <input
                type="text"
                value={newSlotInterviewer}
                onChange={(e) => setNewSlotInterviewer(e.target.value)}
                className="w-full rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink focus:border-brand focus:outline-none"
                placeholder="e.g. Tanuja HR"
                required
              />
            </div>

            {/* Platform Mode */}
            <div>
              <label className="text-[10px] font-bold text-ink-muted uppercase block mb-1">Meeting Mode:</label>
              <select
                value={newSlotMode}
                onChange={(e) => setNewSlotMode(e.target.value as any)}
                className="w-full rounded-xl border border-line bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink focus:border-brand focus:outline-none"
              >
                <option value="LIVEKIT_VIDEO">LiveKit Proctored Video</option>
                <option value="GOOGLE_MEET">Google Meet</option>
                <option value="IN_PERSON">In-Person Meeting</option>
              </select>
            </div>

            {/* Add Slot Button */}
            <div className="flex items-end">
              <Button type="submit" variant="primary" className="w-full text-xs font-bold py-2 shadow-xs">
                <Plus size={13} />
                <span>Add Slot</span>
              </Button>
            </div>
          </div>
        </form>
      </Card>

      {/* ── CONFIGURED INTERVIEW SLOTS TABLE / GRID ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-ink">
              Configured Slots for {selectedRound.name} ({currentSlots.length} Slots)
            </h3>
            <span className="text-xs text-ink-muted">• Job: {selectedJob.title}</span>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-ink-muted">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              Available: {currentSlots.filter((s) => s.status === "AVAILABLE").length}
            </span>
            <span className="flex items-center gap-1.5 text-ink-muted">
              <span className="h-2.5 w-2.5 rounded-full bg-brand" />
              Booked: {currentSlots.filter((s) => s.status === "BOOKED").length}
            </span>
          </div>
        </div>

        {currentSlots.length === 0 ? (
          <Card className="p-8 text-center space-y-3">
            <Calendar size={32} className="mx-auto text-ink-muted" />
            <h4 className="font-bold text-sm text-ink">
              No interview slots configured yet for {selectedRound.name}
            </h4>
            <p className="text-xs text-ink-muted max-w-md mx-auto">
              Use the form above to specify interview dates and time windows, or click "Generate 4 Standard Daily Slots"
              for quick setup.
            </p>
            <Button variant="ghost" onClick={handleGenerateStandardSlots} className="text-xs font-bold">
              <Sparkle size={13} />
              <span>Generate 4 Standard Daily Slots</span>
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {currentSlots.map((slot) => {
              const isBooked = slot.status === "BOOKED";
              return (
                <Card
                  key={slot.id}
                  className={`p-4 space-y-3 border transition-all ${
                    isBooked
                      ? "border-brand/40 bg-brand/5 shadow-xs"
                      : "border-line hover:border-line-2 bg-surface"
                  }`}
                >
                  {/* Slot Top Bar: Date & Status Badge */}
                  <div className="flex items-center justify-between border-b border-line pb-2.5">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={14} className="text-brand" />
                      <span className="text-xs font-bold text-ink">{slot.date}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isBooked ? (
                        <span className="rounded-full bg-brand/10 text-brand px-2 py-0.5 text-[10px] font-extrabold uppercase">
                          ● Booked
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-extrabold uppercase">
                          ● Open
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteSlot(slot.id)}
                        className="text-ink-muted hover:text-rose-600 p-0.5 transition-colors"
                        title="Delete slot"
                      >
                        <Trash size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Time Window */}
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-brand shrink-0" />
                    <span className="text-sm font-extrabold text-ink">
                      {slot.startTime} – {slot.endTime}
                    </span>
                    <span className="text-[11px] text-ink-muted">({slot.durationMinutes} mins)</span>
                  </div>

                  {/* Host Interviewer & Mode */}
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-1 text-ink-muted">
                      <User size={12} />
                      <span>Host:</span>
                      <strong className="text-ink">{slot.interviewerName}</strong>
                    </div>
                    <div className="flex items-center gap-1 text-ink-muted">
                      <Video size={12} />
                      <span>Mode:</span>
                      <span className="font-semibold text-ink-2">
                        {slot.mode === "LIVEKIT_VIDEO" ? "LiveKit Video Room" : slot.mode}
                      </span>
                    </div>
                  </div>

                  {/* Booking or Candidate Assignment */}
                  <div className="rounded-xl bg-canvas/70 p-2.5 text-xs space-y-1.5 border border-line/60">
                    {isBooked ? (
                      <div>
                        <span className="text-[10px] font-bold text-ink-muted uppercase block">
                          Assigned Candidate:
                        </span>
                        <span className="font-bold text-ink text-xs block">
                          {slot.bookedCandidateName || "Candidate"}
                        </span>
                        <span className="text-[11px] text-ink-muted block truncate">
                          {slot.bookedCandidateEmail}
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-ink-muted uppercase block">
                          Book Candidate into Slot:
                        </span>
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              handleAssignCandidateToSlot(slot.id, e.target.value);
                            }
                          }}
                          defaultValue=""
                          className="w-full rounded-lg border border-line bg-surface px-2 py-1 text-xs font-semibold text-ink focus:border-brand focus:outline-none"
                        >
                          <option value="" disabled>
                            -- Select Candidate to Book --
                          </option>
                          {applications.map((app) => (
                            <option key={app.id} value={app.id}>
                              {app.candidateName || "Candidate"} ({app.jobTitle})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Bottom Actions: Copy Meeting Link / Join Room */}
                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => handleCopyMeetingLink(slot)}
                      className="text-[11px] font-semibold text-brand hover:underline flex items-center gap-1"
                    >
                      <Copy size={12} />
                      <span>{copiedSlotId === slot.id ? "Copied!" : "Copy Slot Link"}</span>
                    </button>

                    <a
                      href={slot.meetingLink || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 hover:bg-emerald-100 transition-colors"
                    >
                      <Video size={12} />
                      <span>Join Room</span>
                    </a>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
