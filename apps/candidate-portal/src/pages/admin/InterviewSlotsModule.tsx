import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Plus,
  Sparkle,
  Trash,
  User,
  Users,
  Video,
  Eye,
  Alert,
  X,
  Filter,
} from "@/components/ui/icons";
import { sendEmailNotification } from "@/lib/emailService";

export type MeetingMode = "LIVEKIT_VIDEO" | "GOOGLE_MEET" | "MS_TEAMS" | "OFFLINE";
export type SlotFilter = "ALL" | "SELECTED_DATE" | "UPCOMING" | "COMPLETED";

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
  mode: MeetingMode;
  status: "AVAILABLE" | "BOOKED" | "COMPLETED" | "CANCELLED";
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

export const PRESET_INTERVIEWERS = [
  { name: "Tanuja HR", email: "hr@brutallyhired.com", title: "Talent Acquisition Lead" },
  { name: "Arun K. (Principal Architect)", email: "arun@brutallyhired.com", title: "Principal System Architect" },
  { name: "Vikram M. (Staff Engineer)", email: "vikram@brutallyhired.com", title: "Staff Backend Engineer" },
  { name: "Sarah L. (Engineering Lead)", email: "sarah@brutallyhired.com", title: "Engineering Lead" },
  { name: "Lead System Architect", email: "architect@brutallyhired.com", title: "Lead Architect" },
  { name: "CUSTOM", email: "", title: "+ Custom Interviewer..." },
];

function formatTime12h(timeStr: string): string {
  if (!timeStr) return "";
  const [hStr = "0", mStr = "00"] = timeStr.split(":");
  let h = parseInt(hStr, 10);
  const m = mStr.padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

function formatSelectedDateHuman(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    if (!y || !m || !d) return dateStr;
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  } catch {
    return dateStr;
  }
}

export function getMeetingModeLabel(mode: MeetingMode): string {
  switch (mode) {
    case "LIVEKIT_VIDEO":
      return "LiveKit Video Room";
    case "GOOGLE_MEET":
      return "Google Meet";
    case "MS_TEAMS":
      return "Microsoft Teams";
    case "OFFLINE":
      return "Offline / In-Person";
    default:
      return "LiveKit Video Room";
  }
}

export function generateMeetingLink(mode: MeetingMode, jobId: string, roundNum: number): string {
  const token = Math.random().toString(36).substring(2, 9);
  switch (mode) {
    case "LIVEKIT_VIDEO":
      return `https://meet.livekit.io/bh-${jobId.slice(0, 4)}-r${roundNum}-${token}`;
    case "GOOGLE_MEET":
      return `https://meet.google.com/bh-${token.slice(0, 3)}-${token.slice(3, 7)}`;
    case "MS_TEAMS":
      return `https://teams.microsoft.com/l/meetup-join/19:meeting_${token}@thread.v2/0`;
    case "OFFLINE":
      return "Brutallyhired HQ, 4th Floor, Executive Interview Suite A";
    default:
      return `https://meet.livekit.io/bh-${jobId.slice(0, 4)}-r${roundNum}-${token}`;
  }
}

/**
 * Checks for overlapping time slots for the same interviewer on the same date.
 * Returns overlap status and descriptive reason if a clash or duplicate is found.
 */
export function checkInterviewerOverlap(
  newSlot: { date: string; startTime: string; endTime: string; interviewerName: string; interviewerEmail?: string; id?: string },
  allSlots: InterviewSlotItem[],
): { hasOverlap: boolean; reason?: string; conflictingSlot?: InterviewSlotItem } {
  const [sH = 0, sM = 0] = newSlot.startTime.split(":").map(Number);
  const [eH = 0, eM = 0] = newSlot.endTime.split(":").map(Number);
  const newStart = sH * 60 + sM;
  const newEnd = eH * 60 + eM;

  const newHostName = newSlot.interviewerName.trim().toLowerCase();
  const newHostEmail = (newSlot.interviewerEmail || "").trim().toLowerCase();

  for (const slot of allSlots) {
    if (newSlot.id && slot.id === newSlot.id) continue;
    if (slot.status === "COMPLETED" || slot.status === "CANCELLED") continue;
    if (slot.date !== newSlot.date) continue;

    const sameHost =
      (newHostEmail && slot.interviewerEmail && slot.interviewerEmail.toLowerCase() === newHostEmail) ||
      (newHostName && slot.interviewerName && slot.interviewerName.toLowerCase() === newHostName);

    if (sameHost) {
      const [exSH = 0, exSM = 0] = slot.startTime.split(":").map(Number);
      const [exEH = 0, exEM = 0] = slot.endTime.split(":").map(Number);
      const exStart = exSH * 60 + exSM;
      const exEnd = exEH * 60 + exEM;

      // Duplicate check (exact same start and end)
      if (exStart === newStart && exEnd === newEnd) {
        return {
          hasOverlap: true,
          reason: `Duplicate slot: A slot from ${formatTime12h(slot.startTime)} to ${formatTime12h(slot.endTime)} already exists for ${slot.interviewerName}.`,
          conflictingSlot: slot,
        };
      }

      // Overlap check (any interval intersection)
      if (Math.max(newStart, exStart) < Math.min(newEnd, exEnd)) {
        return {
          hasOverlap: true,
          reason: `Schedule clash: ${slot.interviewerName} already has an interview scheduled from ${formatTime12h(slot.startTime)} to ${formatTime12h(slot.endTime)} on this date (${slot.roundName}).`,
          conflictingSlot: slot,
        };
      }
    }
  }

  return { hasOverlap: false };
}

const EditIcon = ({ size = 14, className = "" }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const MoreVertical = ({ size = 14, className = "" }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="1.5" />
    <circle cx="12" cy="5" r="1.5" />
    <circle cx="12" cy="19" r="1.5" />
  </svg>
);

const CalendarSync = ({ size = 14, className = "" }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
    <path d="M16 21h5v-5" />
  </svg>
);

export function InterviewSlotsModule({ jobs, applications, tenant }: InterviewSlotsModuleProps) {
  const pad = (n: number) => String(n).padStart(2, "0");

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

  // Calendar State: default to November 2026 and 2026-11-25
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => new Date(2026, 10, 1));
  const [selectedDate, setSelectedDate] = useState<string>("2026-11-25");

  // Slots State
  const [slots, setSlots] = useState<InterviewSlotItem[]>(() => {
    try {
      const saved = localStorage.getItem("bh_interview_slots_all");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}

    const sampleDate = "2026-11-25";
    return [
      {
        id: "slot-sample-1",
        jobId: jobs[0]?.id || "default",
        jobTitle: jobs[0]?.title || "Software Developer",
        roundNumber: 1,
        roundName: "Round 1: Technical & Architecture Practical Assignment",
        date: sampleDate,
        startTime: "10:00",
        endTime: "11:00",
        durationMinutes: 60,
        interviewerName: "Tanuja HR",
        interviewerEmail: "hr@brutallyhired.com",
        mode: "LIVEKIT_VIDEO",
        status: "COMPLETED",
        meetingLink: `https://meet.livekit.io/brutallyhired-r1-tech-100`,
        createdAt: new Date().toISOString(),
      },
      {
        id: "slot-sample-2",
        jobId: jobs[0]?.id || "default",
        jobTitle: jobs[0]?.title || "Software Developer",
        roundNumber: 1,
        roundName: "Round 1: Technical & Architecture Practical Assignment",
        date: sampleDate,
        startTime: "11:30",
        endTime: "12:30",
        durationMinutes: 60,
        interviewerName: "Tanuja HR",
        interviewerEmail: "hr@brutallyhired.com",
        mode: "LIVEKIT_VIDEO",
        status: "AVAILABLE",
        meetingLink: `https://meet.livekit.io/brutallyhired-r1-tech-1130`,
        createdAt: new Date().toISOString(),
      },
      {
        id: "slot-sample-3",
        jobId: jobs[0]?.id || "default",
        jobTitle: jobs[0]?.title || "Software Developer",
        roundNumber: 1,
        roundName: "Round 1: Technical & Architecture Practical Assignment",
        date: sampleDate,
        startTime: "14:00",
        endTime: "15:00",
        durationMinutes: 60,
        interviewerName: "Tanuja HR",
        interviewerEmail: "hr@brutallyhired.com",
        mode: "LIVEKIT_VIDEO",
        status: "BOOKED",
        bookedCandidateId: applications[0]?.id || "app-101",
        bookedCandidateName: applications[0]?.candidateName || "Amirti Tanuja",
        bookedCandidateEmail: applications[0]?.email || "amirtitanuja12@gmail.com",
        meetingLink: `https://meet.livekit.io/brutallyhired-r1-tech-1400`,
        createdAt: new Date().toISOString(),
      },
      {
        id: "slot-sample-4",
        jobId: jobs[0]?.id || "default",
        jobTitle: jobs[0]?.title || "Software Developer",
        roundNumber: 1,
        roundName: "Round 1: Technical & Architecture Practical Assignment",
        date: sampleDate,
        startTime: "16:00",
        endTime: "17:00",
        durationMinutes: 60,
        interviewerName: "Tanuja HR",
        interviewerEmail: "hr@brutallyhired.com",
        mode: "LIVEKIT_VIDEO",
        status: "AVAILABLE",
        meetingLink: `https://meet.livekit.io/brutallyhired-r1-tech-1600`,
        createdAt: new Date().toISOString(),
      },
      {
        id: "slot-sample-5",
        jobId: jobs[0]?.id || "default",
        jobTitle: jobs[0]?.title || "Software Developer",
        roundNumber: 1,
        roundName: "Round 1: Technical & Architecture Practical Assignment",
        date: sampleDate,
        startTime: "17:00",
        endTime: "18:00",
        durationMinutes: 60,
        interviewerName: "Tanuja HR",
        interviewerEmail: "hr@brutallyhired.com",
        mode: "GOOGLE_MEET",
        status: "AVAILABLE",
        meetingLink: `https://meet.google.com/bh-abc-defg`,
        createdAt: new Date().toISOString(),
      },
      {
        id: "slot-sample-6",
        jobId: jobs[0]?.id || "default",
        jobTitle: jobs[0]?.title || "Software Developer",
        roundNumber: 1,
        roundName: "Round 1: Technical & Architecture Practical Assignment",
        date: sampleDate,
        startTime: "18:00",
        endTime: "19:00",
        durationMinutes: 60,
        interviewerName: "Tanuja HR",
        interviewerEmail: "hr@brutallyhired.com",
        mode: "MS_TEAMS",
        status: "AVAILABLE",
        meetingLink: `https://teams.microsoft.com/l/meetup-join/19:sample`,
        createdAt: new Date().toISOString(),
      },
      {
        id: "slot-sample-7",
        jobId: jobs[0]?.id || "default",
        jobTitle: jobs[0]?.title || "Software Developer",
        roundNumber: 1,
        roundName: "Round 1: Technical & Architecture Practical Assignment",
        date: "2026-11-24",
        startTime: "10:00",
        endTime: "11:00",
        durationMinutes: 60,
        interviewerName: "Tanuja HR",
        interviewerEmail: "hr@brutallyhired.com",
        mode: "LIVEKIT_VIDEO",
        status: "COMPLETED",
        meetingLink: `https://meet.livekit.io/brutallyhired-r1-tech-24`,
        createdAt: new Date().toISOString(),
      },
      {
        id: "slot-sample-8",
        jobId: jobs[0]?.id || "default",
        jobTitle: jobs[0]?.title || "Software Developer",
        roundNumber: 1,
        roundName: "Round 1: Technical & Architecture Practical Assignment",
        date: "2026-11-26",
        startTime: "11:00",
        endTime: "12:00",
        durationMinutes: 60,
        interviewerName: "Tanuja HR",
        interviewerEmail: "hr@brutallyhired.com",
        mode: "OFFLINE",
        status: "AVAILABLE",
        meetingLink: "Brutallyhired HQ, 4th Floor, Suite A",
        createdAt: new Date().toISOString(),
      },
    ];
  });

  // Generator State
  const [selectedInterviewerPreset, setSelectedInterviewerPreset] = useState<string>("Tanuja HR");
  const [genInterviewer, setGenInterviewer] = useState<string>("Tanuja HR");
  const [genEmail, setGenEmail] = useState<string>("hr@brutallyhired.com");
  const [genMode, setGenMode] = useState<MeetingMode>("LIVEKIT_VIDEO");
  const [genStartTime, setGenStartTime] = useState<string>("10:00");
  const [genEndTime, setGenEndTime] = useState<string>("17:00");
  const [genIntervalMinutes, setGenIntervalMinutes] = useState<number>(60);
  const [genBreakMinutes, setGenBreakMinutes] = useState<number>(10);

  // Filter State for Configured Slots
  const [slotFilter, setSlotFilter] = useState<SlotFilter>("ALL");

  // Notifications and Active Menus
  const [notice, setNotice] = useState<string>("");
  const [copiedSlotId, setCopiedSlotId] = useState<string | null>(null);
  const [activeMenuSlotId, setActiveMenuSlotId] = useState<string | null>(null);

  // Modals State
  const [viewingSlot, setViewingSlot] = useState<InterviewSlotItem | null>(null);
  const [bookingSlot, setBookingSlot] = useState<InterviewSlotItem | null>(null);
  const [deletingSlot, setDeletingSlot] = useState<InterviewSlotItem | null>(null);
  const [reschedulingSlot, setReschedulingSlot] = useState<InterviewSlotItem | null>(null);
  const [cancellingSlot, setCancellingSlot] = useState<InterviewSlotItem | null>(null);
  const [completingSlot, setCompletingSlot] = useState<InterviewSlotItem | null>(null);

  // Reschedule Form Fields
  const [rescheduleDate, setRescheduleDate] = useState<string>("");
  const [rescheduleStartTime, setRescheduleStartTime] = useState<string>("");
  const [rescheduleEndTime, setRescheduleEndTime] = useState<string>("");
  const [rescheduleReason, setRescheduleReason] = useState<string>("");

  // Cancel Form Fields
  const [cancelReason, setCancelReason] = useState<string>("Candidate schedule adjustment request");
  const [cancelReleaseSlot, setCancelReleaseSlot] = useState<boolean>(true);

  // Complete Form Fields
  const [completeNotes, setCompleteNotes] = useState<string>("");

  // Close menus on outside click
  useEffect(() => {
    const handleGlobalClick = () => setActiveMenuSlotId(null);
    window.addEventListener("click", handleGlobalClick);
    return () => window.removeEventListener("click", handleGlobalClick);
  }, []);

  // ── BACKEND INTEGRATION: Fetch slots from DB on mount ──
  useEffect(() => {
    let active = true;
    async function loadBackendSlots() {
      try {
        const res = await fetch(`/api/t/${tenant.slug}/interview-slots`);
        if (res.ok) {
          const data = await res.json();
          if (active && data?.slots && Array.isArray(data.slots) && data.slots.length > 0) {
            setSlots(data.slots);
            localStorage.setItem("bh_interview_slots_all", JSON.stringify(data.slots));
          }
        }
      } catch (err) {
        console.warn("Backend slots fetch note:", err);
      }
    }
    loadBackendSlots();
    return () => {
      active = false;
    };
  }, [tenant.slug]);

  // Synchronize state and persist to backend and database
  const syncSlots = async (updatedList: InterviewSlotItem[]) => {
    setSlots(updatedList);
    localStorage.setItem("bh_interview_slots_all", JSON.stringify(updatedList));

    try {
      await fetch(`/api/t/${tenant.slug}/interview-slots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slots: updatedList }),
      });
    } catch (err) {
      console.warn("Backend slots sync warning:", err);
    }
  };

  // Helper to determine if a slot's time window has elapsed
  const isSlotElapsed = (slot: InterviewSlotItem): boolean => {
    try {
      const [y, m, d] = slot.date.split("-").map(Number);
      const [h = 23, min = 59] = (slot.endTime || "23:59").split(":").map(Number);
      if (!y || !m || !d) return false;
      const slotEnd = new Date(y, m - 1, d, h, min, 0);
      return slotEnd.getTime() < Date.now();
    } catch {
      return false;
    }
  };

  const isSlotCompleted = (slot: InterviewSlotItem): boolean => {
    return slot.status === "COMPLETED";
  };

  // Filter slots for active Job and Round
  const currentSlots = useMemo(() => {
    return slots.filter((s) => s.jobId === selectedJob.id && s.roundNumber === selectedRoundNum);
  }, [slots, selectedJob.id, selectedRoundNum]);

  // Slots specifically for the selected date on the calendar
  const dateSlots = useMemo(() => {
    return currentSlots.filter((s) => s.date === selectedDate);
  }, [currentSlots, selectedDate]);

  // Filtered slots for bottom section
  const filteredSlots = useMemo(() => {
    switch (slotFilter) {
      case "SELECTED_DATE":
        return currentSlots.filter((s) => s.date === selectedDate);
      case "UPCOMING":
        return currentSlots.filter((s) => !isSlotElapsed(s) && s.status !== "COMPLETED");
      case "COMPLETED":
        return currentSlots.filter((s) => s.status === "COMPLETED");
      case "ALL":
      default:
        return currentSlots;
    }
  }, [currentSlots, slotFilter, selectedDate]);

  // Group filtered slots by date
  const groupedSlotsByDate = useMemo(() => {
    const groups: Record<string, InterviewSlotItem[]> = {};
    for (const slot of filteredSlots) {
      const existing = groups[slot.date];
      if (existing) {
        existing.push(slot);
      } else {
        groups[slot.date] = [slot];
      }
    }
    // Sort slots within each date chronologically by startTime
    for (const d of Object.keys(groups)) {
      const list = groups[d];
      if (list) {
        list.sort((a, b) => a.startTime.localeCompare(b.startTime));
      }
    }
    return groups;
  }, [filteredSlots]);

  // Recent dates visible at top (descending chronological order)
  const sortedDates = useMemo(() => {
    return Object.keys(groupedSlotsByDate).sort((a, b) => b.localeCompare(a));
  }, [groupedSlotsByDate]);

  // Accordion Expand/Collapse State (keyed by date string YYYY-MM-DD)
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});

  // Date-wise pagination state
  const [datePage, setDatePage] = useState<number>(1);
  const DATES_PER_PAGE = 5;
  const totalDatePages = Math.max(1, Math.ceil(sortedDates.length / DATES_PER_PAGE));

  // Reset or adjust page if out of bounds
  useEffect(() => {
    if (datePage > totalDatePages) {
      setDatePage(1);
    }
  }, [totalDatePages, datePage]);

  // Sliced dates for current page
  const paginatedDates = useMemo(() => {
    const start = (datePage - 1) * DATES_PER_PAGE;
    return sortedDates.slice(start, start + DATES_PER_PAGE);
  }, [sortedDates, datePage]);

  // Accordion toggle helper: check if date is expanded in the bottom section
  const isDateExpanded = (d: string): boolean => {
    return !!expandedDates[d];
  };

  // When clicking on a particular date in the bottom section:
  // ONLY toggle that date's dropdown in the bottom part.
  // Independent from calendar (does NOT change calendar selection or selectedDate).
  const handleToggleDate = (d: string) => {
    setExpandedDates((prev) => ({
      ...prev,
      [d]: !prev[d],
    }));
  };

  const handleExpandAll = () => {
    const next: Record<string, boolean> = {};
    sortedDates.forEach((d) => {
      next[d] = true;
    });
    setExpandedDates(next);
  };

  const handleCollapseAll = () => {
    const next: Record<string, boolean> = {};
    sortedDates.forEach((d) => {
      next[d] = false;
    });
    setExpandedDates(next);
  };

  // Handle Preset Interviewer Selection
  const handleSelectInterviewerPreset = (val: string) => {
    setSelectedInterviewerPreset(val);
    if (val === "CUSTOM") {
      setGenInterviewer("");
      setGenEmail("");
    } else {
      const found = PRESET_INTERVIEWERS.find((p) => p.name === val);
      if (found) {
        setGenInterviewer(found.name);
        setGenEmail(found.email);
      }
    }
  };

  // Save all slots to backend & database
  const handleSaveSlots = async () => {
    await syncSlots(slots);
    setNotice(`Saved ${slots.length} interview slots to database across all rounds!`);
    setTimeout(() => setNotice(""), 3500);
  };

  // Generate Slots by Time Interval for the Selected Date with Break Duration & Overlap Prevention
  const handleGenerateSlotsByInterval = async () => {
    if (!selectedDate) {
      setNotice("Please select a date on the calendar first!");
      setTimeout(() => setNotice(""), 3000);
      return;
    }

    const hostName = genInterviewer.trim() || "Tanuja HR";
    const hostEmail = genEmail.trim() || "hr@brutallyhired.com";

    const [startH = 10, startM = 0] = genStartTime.split(":").map(Number);
    const [endH = 17, endM = 0] = genEndTime.split(":").map(Number);
    const startTotal = startH * 60 + startM;
    const endTotal = endH * 60 + endM;

    if (endTotal <= startTotal) {
      setNotice("End time must be later than start time!");
      setTimeout(() => setNotice(""), 3000);
      return;
    }

    const interval = Number(genIntervalMinutes) || 60;
    const breakBuffer = Number(genBreakMinutes) || 0;

    const toTime = (m: number) => {
      const h = Math.floor(m / 60);
      const min = m % 60;
      return `${pad(h)}:${pad(min)}`;
    };

    const newSlots: InterviewSlotItem[] = [];
    let cur = startTotal;
    let skippedCount = 0;
    let conflictReason = "";

    while (cur + interval <= endTotal) {
      const sTime = toTime(cur);
      const eTime = toTime(cur + interval);

      // Check for overlapping or duplicate interviews for the same interviewer
      const candidateSlot = {
        date: selectedDate,
        startTime: sTime,
        endTime: eTime,
        interviewerName: hostName,
        interviewerEmail: hostEmail,
      };

      const overlapCheck = checkInterviewerOverlap(candidateSlot, [...slots, ...newSlots]);
      if (overlapCheck.hasOverlap) {
        skippedCount++;
        conflictReason = overlapCheck.reason || "Time conflict";
      } else {
        newSlots.push({
          id: `slot-${Date.now()}-${newSlots.length}-${Math.random().toString(36).slice(2, 6)}`,
          jobId: selectedJob.id,
          jobTitle: selectedJob.title,
          roundNumber: selectedRoundNum,
          roundName: selectedRound.name,
          date: selectedDate,
          startTime: sTime,
          endTime: eTime,
          durationMinutes: interval,
          interviewerName: hostName,
          interviewerEmail: hostEmail,
          mode: genMode,
          status: "AVAILABLE",
          meetingLink: generateMeetingLink(genMode, selectedJob.id, selectedRoundNum),
          createdAt: new Date().toISOString(),
        });
      }

      cur += interval + breakBuffer;
    }

    if (newSlots.length === 0) {
      if (skippedCount > 0) {
        setNotice(`⚠️ ${conflictReason || "Interviewer time conflict prevented duplicate slots."}`);
      } else {
        setNotice("Interval is too long for the selected time window.");
      }
      setTimeout(() => setNotice(""), 4500);
      return;
    }

    const updated = [...slots, ...newSlots];
    await syncSlots(updated);

    if (skippedCount > 0) {
      setNotice(`⚡ Generated ${newSlots.length} slots on ${selectedDate} (${skippedCount} skipped due to interviewer schedule overlap).`);
    } else {
      setNotice(`⚡ Generated ${newSlots.length} interview slots on ${selectedDate}!`);
    }
    setTimeout(() => setNotice(""), 4000);
  };

  // Delete slot
  const handleDeleteSlot = async (slotId: string) => {
    const updated = slots.filter((s) => s.id !== slotId);
    await syncSlots(updated);
  };

  // Assign candidate to slot and send booking confirmation email
  const handleAssignCandidateToSlot = async (slotId: string, candidateId: string) => {
    const candidate = applications.find((a) => a.id === candidateId);
    if (!candidate) return;

    const slot = slots.find((s) => s.id === slotId);
    if (!slot) return;

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

    await syncSlots(updated);
    setBookingSlot(null);

    // Sync to bh_admin_interviews & candidate application
    try {
      const rawSched = localStorage.getItem("bh_admin_interviews");
      let parsed: Record<string, any> = {};
      if (rawSched) {
        try {
          const loaded = JSON.parse(rawSched);
          if (loaded && !Array.isArray(loaded)) parsed = loaded;
        } catch {}
      }
      const [sh = "10", sm = "00"] = slot.startTime.split(":");
      const [eh = "11", em = "00"] = slot.endTime.split(":");
      const sDate = new Date(`${slot.date}T${sh.padStart(2, "0")}:${sm.padStart(2, "0")}:00`);
      const eDate = new Date(`${slot.date}T${eh.padStart(2, "0")}:${em.padStart(2, "0")}:00`);
      const roundKey = `round-${selectedRound.roundNumber}`;
      parsed[`${candidate.id}_${roundKey}`] = {
        roundId: roundKey,
        appId: candidate.id,
        title: selectedRound.name,
        startsAt: sDate.toISOString(),
        endsAt: eDate.toISOString(),
        status: "SCHEDULED",
        panelists: slot.interviewerName,
      };
      parsed[roundKey] = parsed[`${candidate.id}_${roundKey}`];
      localStorage.setItem("bh_admin_interviews", JSON.stringify(parsed));

      const rawApps = localStorage.getItem("bh_admin_applications");
      if (rawApps) {
        const apps = JSON.parse(rawApps);
        if (Array.isArray(apps)) {
          const upApps = apps.map((a: any) =>
            a.id === candidate.id
              ? {
                  ...a,
                  stage: "INTERVIEW",
                  round1Passed: selectedRound.roundNumber >= 2 ? true : a.round1Passed,
                  round2Unlocked: selectedRound.roundNumber >= 2 ? true : a.round2Unlocked,
                  round2SlotBooked: selectedRound.roundNumber === 2 ? true : a.round2SlotBooked,
                }
              : a
          );
          localStorage.setItem("bh_admin_applications", JSON.stringify(upApps));
        }
      }
      window.dispatchEvent(new Event("storage"));
      window.dispatchEvent(new CustomEvent("bh_application_updated", { detail: { appId: candidate.id } }));
    } catch (err) {
      console.warn("Sync error in InterviewSlotsModule:", err);
    }

    // Send automatic booking confirmation email with meeting link
    try {
      const modeText = getMeetingModeLabel(slot.mode);
      const linkOrLoc =
        slot.mode === "OFFLINE"
          ? "Location: Brutallyhired HQ, Floor 4, Executive Interview Suite A"
          : `Meeting Room Link: ${slot.meetingLink || "LiveKit Proctored Room"}`;

      await sendEmailNotification({
        to: candidate.email,
        recipientName: candidate.candidateName || "Candidate",
        stage: "INTERVIEW",
        jobTitle: selectedJob.title,
        portalPath: `/${tenant.slug}/interviews`,
        tenantSlug: tenant.slug,
        customSubject: `Confirmed: Interview for ${selectedJob.title} (${selectedRound.name})`,
        customHeading: `Your Interview Slot is Confirmed!`,
        customBody: `Your interview for ${selectedRound.name} (${selectedJob.title}) has been confirmed for ${slot.date} from ${formatTime12h(slot.startTime)} to ${formatTime12h(slot.endTime)}. Interviewer Host: ${slot.interviewerName}. Meeting Mode: ${modeText}. ${linkOrLoc}.`,
      });
      setNotice(`✓ Assigned ${candidate.candidateName} & emailed slot confirmation!`);
    } catch {
      setNotice(`✓ Assigned ${candidate.candidateName} to slot.`);
    }

    setTimeout(() => setNotice(""), 3500);
  };

  // HR Reschedule Interview
  const handleOpenReschedule = (slot: InterviewSlotItem) => {
    setReschedulingSlot(slot);
    setRescheduleDate(slot.date);
    setRescheduleStartTime(slot.startTime);
    setRescheduleEndTime(slot.endTime);
    setRescheduleReason("");
  };

  const handleConfirmReschedule = async () => {
    if (!reschedulingSlot || !rescheduleDate || !rescheduleStartTime || !rescheduleEndTime) return;

    // Check overlap for new time
    const overlapCheck = checkInterviewerOverlap(
      {
        id: reschedulingSlot.id,
        date: rescheduleDate,
        startTime: rescheduleStartTime,
        endTime: rescheduleEndTime,
        interviewerName: reschedulingSlot.interviewerName,
        interviewerEmail: reschedulingSlot.interviewerEmail,
      },
      slots,
    );

    if (overlapCheck.hasOverlap) {
      setNotice(`⚠️ Cannot reschedule: ${overlapCheck.reason}`);
      setTimeout(() => setNotice(""), 4500);
      return;
    }

    const updated = slots.map((s) => {
      if (s.id === reschedulingSlot.id) {
        return {
          ...s,
          date: rescheduleDate,
          startTime: rescheduleStartTime,
          endTime: rescheduleEndTime,
          status: "BOOKED" as const,
        };
      }
      return s;
    });

    await syncSlots(updated);

    // Call backend reschedule endpoint and send email
    try {
      await fetch(`/api/t/${tenant.slug}/interview-slots/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slotId: reschedulingSlot.id,
          newDate: rescheduleDate,
          newStartTime: rescheduleStartTime,
          newEndTime: rescheduleEndTime,
          reason: rescheduleReason,
          candidateEmail: reschedulingSlot.bookedCandidateEmail,
          candidateName: reschedulingSlot.bookedCandidateName,
          jobTitle: reschedulingSlot.jobTitle,
          roundName: reschedulingSlot.roundName,
          meetingLink: reschedulingSlot.meetingLink,
          interviewerName: reschedulingSlot.interviewerName,
        }),
      });

      if (reschedulingSlot.bookedCandidateEmail) {
        await sendEmailNotification({
          to: reschedulingSlot.bookedCandidateEmail,
          recipientName: reschedulingSlot.bookedCandidateName || "Candidate",
          stage: "INTERVIEW",
          jobTitle: reschedulingSlot.jobTitle,
          portalPath: `/${tenant.slug}/interviews`,
          tenantSlug: tenant.slug,
          customSubject: `Rescheduled: Interview for ${reschedulingSlot.jobTitle} (${reschedulingSlot.roundName})`,
          customHeading: `Your Interview Has Been Rescheduled`,
          customBody: `Your interview session for ${reschedulingSlot.jobTitle} (${reschedulingSlot.roundName}) has been rescheduled to ${rescheduleDate} from ${formatTime12h(rescheduleStartTime)} to ${formatTime12h(rescheduleEndTime)}.${rescheduleReason ? ` Reason: ${rescheduleReason}.` : ""} Interviewer: ${reschedulingSlot.interviewerName}. Meeting Mode: ${getMeetingModeLabel(reschedulingSlot.mode)}. Meeting Link: ${reschedulingSlot.meetingLink || "Please view in candidate portal"}.`,
        });
      }
    } catch (e) {
      console.warn("Reschedule notification error", e);
    }

    setNotice(`✓ Interview rescheduled to ${rescheduleDate} & candidate emailed.`);
    setReschedulingSlot(null);
    setTimeout(() => setNotice(""), 3500);
  };

  // HR Cancel Booked Interview
  const handleOpenCancel = (slot: InterviewSlotItem) => {
    setCancellingSlot(slot);
    setCancelReason("Candidate requested rescheduling / schedule conflict");
    setCancelReleaseSlot(true);
  };

  const handleConfirmCancel = async () => {
    if (!cancellingSlot) return;

    let updated: InterviewSlotItem[];
    if (cancelReleaseSlot) {
      // Release slot as Available for other candidates
      updated = slots.map((s) => {
        if (s.id === cancellingSlot.id) {
          return {
            ...s,
            status: "AVAILABLE" as const,
            bookedCandidateId: undefined,
            bookedCandidateName: undefined,
            bookedCandidateEmail: undefined,
          };
        }
        return s;
      });
    } else {
      // Remove slot entirely
      updated = slots.filter((s) => s.id !== cancellingSlot.id);
    }

    await syncSlots(updated);

    // Call backend cancel endpoint and send cancellation email
    try {
      await fetch(`/api/t/${tenant.slug}/interview-slots/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slotId: cancellingSlot.id,
          reason: cancelReason,
          releaseSlot: cancelReleaseSlot,
          candidateEmail: cancellingSlot.bookedCandidateEmail,
          candidateName: cancellingSlot.bookedCandidateName,
          jobTitle: cancellingSlot.jobTitle,
          roundName: cancellingSlot.roundName,
        }),
      });

      if (cancellingSlot.bookedCandidateEmail) {
        await sendEmailNotification({
          to: cancellingSlot.bookedCandidateEmail,
          recipientName: cancellingSlot.bookedCandidateName || "Candidate",
          stage: "INTERVIEW",
          jobTitle: cancellingSlot.jobTitle,
          portalPath: `/${tenant.slug}/interviews`,
          tenantSlug: tenant.slug,
          customSubject: `Cancelled: Interview for ${cancellingSlot.jobTitle} (${cancellingSlot.roundName})`,
          customHeading: `Interview Cancellation Notice`,
          customBody: `We are writing to inform you that your interview for ${cancellingSlot.jobTitle} (${cancellingSlot.roundName}) originally scheduled for ${cancellingSlot.date} at ${formatTime12h(cancellingSlot.startTime)} has been cancelled.${cancelReason ? ` Reason: ${cancelReason}.` : ""} Our talent team will be in touch regarding next steps.`,
        });
      }
    } catch (e) {
      console.warn("Cancel notification error", e);
    }

    setNotice(`✓ Interview cancelled & cancellation email sent to candidate.`);
    setCancellingSlot(null);
    setTimeout(() => setNotice(""), 3500);
  };

  // HR Mark Interview as Completed (Requires explicit HR confirmation)
  const handleOpenComplete = (slot: InterviewSlotItem) => {
    setCompletingSlot(slot);
    setCompleteNotes(slot.notes || "");
  };

  const handleConfirmComplete = async () => {
    if (!completingSlot) return;

    const updated = slots.map((s) => {
      if (s.id === completingSlot.id) {
        return {
          ...s,
          status: "COMPLETED" as const,
          notes: completeNotes || s.notes,
        };
      }
      return s;
    });

    await syncSlots(updated);

    try {
      await fetch(`/api/t/${tenant.slug}/interview-slots/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slotId: completingSlot.id,
          notes: completeNotes,
          candidateEmail: completingSlot.bookedCandidateEmail,
          roundName: completingSlot.roundName,
          jobTitle: completingSlot.jobTitle,
        }),
      });
    } catch (e) {
      console.warn("Complete backend error", e);
    }

    setNotice(`✓ Interview marked as Completed.`);
    setCompletingSlot(null);
    setTimeout(() => setNotice(""), 3500);
  };

  // Copy slot meeting link
  const handleCopyMeetingLink = (slot: InterviewSlotItem) => {
    const link = slot.meetingLink || `https://meet.livekit.io/bh-room-${slot.id}`;
    navigator.clipboard.writeText(link);
    setCopiedSlotId(slot.id);
    setTimeout(() => setCopiedSlotId(null), 2500);
  };

  // ── CALENDAR COMPUTATION ──
  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth(); // 0-based
  const monthName = calendarMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Days grid
  const daysArray = useMemo(() => {
    const list: Array<{ dayNum: number; dateStr: string } | null> = [];
    for (let i = 0; i < firstDayIndex; i++) {
      list.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = `${year}-${pad(month + 1)}-${pad(d)}`;
      list.push({ dayNum: d, dateStr: dStr });
    }
    return list;
  }, [year, month, firstDayIndex, daysInMonth]);

  // Statistics for selected date table
  const selectedDateStats = useMemo(() => {
    const available = dateSlots.filter((s) => s.status === "AVAILABLE").length;
    const booked = dateSlots.filter((s) => s.status === "BOOKED").length;
    const completed = dateSlots.filter((s) => s.status === "COMPLETED").length;
    return { available, booked, completed, total: dateSlots.length };
  }, [dateSlots]);

  // Statistics for configured slots bottom bar
  const totalRoundStats = useMemo(() => {
    const available = currentSlots.filter((s) => s.status === "AVAILABLE").length;
    const booked = currentSlots.filter((s) => s.status === "BOOKED").length;
    const completed = currentSlots.filter((s) => s.status === "COMPLETED").length;
    const upcoming = currentSlots.filter((s) => !isSlotElapsed(s) && s.status !== "COMPLETED").length;
    const onSelectedDate = currentSlots.filter((s) => s.date === selectedDate).length;
    return { available, booked, completed, upcoming, onSelectedDate, total: currentSlots.length };
  }, [currentSlots, selectedDate]);

  return (
    <div className="space-y-6">
      {/* ── 1. HEADER (Calendar icon in purple box, Title, Save button) ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-600 shadow-xs">
            <Calendar size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-ink font-display">Interview Slots</h1>
            <p className="text-xs text-ink-muted">
              Configure, manage, and book date and time slots for specific job roles and assessment rounds.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {notice && (
            <div className="flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-1.5 text-xs font-bold text-emerald-800 shadow-xs">
              <Check size={14} />
              <span>{notice}</span>
            </div>
          )}
          <button
            type="button"
            onClick={handleSaveSlots}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-xs font-bold shadow-sm transition-colors cursor-pointer"
          >
            <Check size={14} />
            <span>Save All Slots</span>
          </button>
        </div>
      </div>

      {/* ── 2. TOP CONTEXT BAR: SELECT JOB ROLE & ASSESSMENT ROUND ── */}
      <div className="rounded-2xl border border-line bg-white p-4 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center gap-5">
          {/* Select Job Role */}
          <div className="shrink-0">
            <span className="text-[11px] font-bold text-ink-muted block mb-1.5">Select Job Role</span>
            <select
              value={selectedJob.id}
              onChange={(e) => setSelectedJobId(e.target.value)}
              className="rounded-xl border border-line bg-white px-3 py-2 text-xs font-bold text-ink focus:border-indigo-500 focus:outline-none min-w-[240px] shadow-xs cursor-pointer"
            >
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title} ({j.department || "Technology"})
                </option>
              ))}
            </select>
          </div>

          {/* Divider */}
          <div className="hidden lg:block h-10 w-[1px] bg-line" />

          {/* Select Assessment Round */}
          <div className="flex-1">
            <span className="text-[11px] font-bold text-ink-muted block mb-1.5">Select Assessment Round</span>
            <div className="flex flex-wrap items-center gap-2">
              {STANDARD_ROUNDS.map((r) => {
                const isSelected = selectedRoundNum === r.roundNumber;
                return (
                  <button
                    key={r.roundNumber}
                    type="button"
                    onClick={() => setSelectedRoundNum(r.roundNumber)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isSelected
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "bg-canvas text-ink-muted hover:text-ink hover:bg-line/60 border border-line/60"
                    }`}
                  >
                    Round {r.roundNumber} ({r.name.split(":")[1]?.trim() || r.name})
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. MIDDLE 3-COLUMN DASHBOARD (Calendar | Generate Form | Slots Table) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* ── COLUMN 1: MINI MONTH CALENDAR ── */}
        <div className="lg:col-span-4 rounded-2xl border border-line bg-white p-5 shadow-xs flex flex-col justify-between">
          <div>
            {/* Month Navigator Header */}
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={() => setCalendarMonth(new Date(year, month - 1, 1))}
                className="p-1.5 text-slate-700 hover:text-ink hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                title="Previous Month"
              >
                <ChevronLeft size={18} />
              </button>

              <div className="font-bold text-sm sm:text-base text-ink font-display">{monthName}</div>

              <button
                type="button"
                onClick={() => setCalendarMonth(new Date(year, month + 1, 1))}
                className="p-1.5 text-slate-700 hover:text-ink hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                title="Next Month"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Days of week header */}
            <div className="grid grid-cols-7 text-center text-xs font-medium text-slate-500 mb-2.5">
              <span>Sun</span>
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2 text-xs">
              {daysArray.map((cell, idx) => {
                if (!cell) {
                  return <div key={`empty-${idx}`} className="h-[48px] sm:h-[54px]" />;
                }

                const isSelected = cell.dateStr === selectedDate;
                const cellSlots = currentSlots.filter((s) => s.date === cell.dateStr);
                const hasSlots = cellSlots.length > 0;
                const hasBooked = cellSlots.some((s) => s.status === "BOOKED");
                const hasAvailable = cellSlots.some((s) => s.status === "AVAILABLE" && !isSlotElapsed(s));
                const allCompleted = hasSlots && cellSlots.every((s) => s.status === "COMPLETED");

                let cellStyle = "bg-[#F8F9FA] border-slate-200/90 text-slate-800 hover:bg-slate-100/70 hover:border-slate-300";
                let dayNumStyle = "text-sm font-semibold text-slate-800";
                let slotsSubtext = null;

                if (isSelected) {
                  cellStyle = "bg-[#4F46E5] border-[#4F46E5] text-white shadow-xs";
                  dayNumStyle = "text-sm font-bold text-white";
                  if (hasSlots) {
                    slotsSubtext = (
                      <span className="text-[10px] font-medium text-indigo-100 leading-none mt-1">
                        {cellSlots.length} slot{cellSlots.length > 1 ? "s" : ""}
                      </span>
                    );
                  }
                } else if (hasBooked) {
                  cellStyle = "bg-[#F3E8FF] border-[#E9D5FF] text-purple-700 hover:bg-[#EDE9FE]";
                  dayNumStyle = "text-sm font-bold text-slate-800";
                  slotsSubtext = (
                    <span className="text-[10px] font-semibold text-purple-600 leading-none mt-1">
                      {cellSlots.length} slot{cellSlots.length > 1 ? "s" : ""}
                    </span>
                  );
                } else if (hasAvailable) {
                  cellStyle = "bg-[#ECFDF5] border-[#A7F3D0] text-emerald-700 hover:bg-[#D1FAE5]";
                  dayNumStyle = "text-sm font-bold text-slate-800";
                  slotsSubtext = (
                    <span className="text-[10px] font-semibold text-emerald-600 leading-none mt-1">
                      {cellSlots.length} slot{cellSlots.length > 1 ? "s" : ""}
                    </span>
                  );
                } else if (allCompleted) {
                  cellStyle = "bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200/70";
                  dayNumStyle = "text-sm font-bold text-slate-800";
                  slotsSubtext = (
                    <span className="text-[10px] font-semibold text-slate-500 leading-none mt-1">
                      {cellSlots.length} slot{cellSlots.length > 1 ? "s" : ""}
                    </span>
                  );
                }

                return (
                  <button
                    key={cell.dateStr}
                    type="button"
                    onClick={() => setSelectedDate(cell.dateStr)}
                    className={`h-[48px] sm:h-[54px] rounded-xl border flex flex-col items-center justify-center p-1 transition-all cursor-pointer relative ${cellStyle}`}
                  >
                    <span className={dayNumStyle}>{cell.dayNum}</span>
                    {slotsSubtext}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom Legend */}
          <div className="pt-4 border-t border-slate-200/80 flex flex-wrap items-center gap-4 text-xs font-medium text-slate-600 mt-5">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#4F46E5]" />
              Selected
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#9333EA]" />
              Booked
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#10B981]" />
              Available
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#94A3B8]" />
              Completed
            </span>
          </div>
        </div>

        {/* ── COLUMN 2: GENERATE INTERVIEW SLOTS FORM ── */}
        <div className="lg:col-span-3 rounded-2xl border border-line bg-white p-5 shadow-xs flex flex-col justify-between">
          <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center gap-1.5 text-ink font-bold text-sm">
              <Sparkle size={16} className="text-indigo-600" />
              <span>Generate Interview Slots</span>
            </div>

            {/* Selected Date */}
            <div>
              <label className="text-[11px] font-bold text-ink-muted block mb-1">Selected Date</label>
              <div className="relative flex items-center">
                <Calendar size={14} className="absolute left-3 text-indigo-500 pointer-events-none" />
                <input
                  type="text"
                  readOnly
                  value={formatSelectedDateHuman(selectedDate)}
                  className="w-full rounded-xl border border-line bg-canvas/40 pl-9 pr-3 py-1.5 text-xs font-bold text-ink cursor-default"
                />
              </div>
            </div>

            {/* Interviewer Selection */}
            <div>
              <label className="text-[11px] font-bold text-ink-muted block mb-1">Select Interviewer Host</label>
              <div className="relative flex items-center">
                <User size={14} className="absolute left-3 text-indigo-500 pointer-events-none" />
                <select
                  value={selectedInterviewerPreset}
                  onChange={(e) => handleSelectInterviewerPreset(e.target.value)}
                  className="w-full rounded-xl border border-line bg-white pl-9 pr-3 py-1.5 text-xs font-bold text-ink focus:border-indigo-500 focus:outline-none cursor-pointer"
                >
                  {PRESET_INTERVIEWERS.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name === "CUSTOM" ? p.title : `${p.name} (${p.title})`}
                    </option>
                  ))}
                </select>
              </div>

              {selectedInterviewerPreset === "CUSTOM" && (
                <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                  <input
                    type="text"
                    placeholder="Host Name"
                    value={genInterviewer}
                    onChange={(e) => setGenInterviewer(e.target.value)}
                    className="rounded-lg border border-line px-2 py-1 text-xs text-ink focus:border-indigo-500 focus:outline-none"
                  />
                  <input
                    type="email"
                    placeholder="Host Email"
                    value={genEmail}
                    onChange={(e) => setGenEmail(e.target.value)}
                    className="rounded-lg border border-line px-2 py-1 text-xs text-ink focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              )}
            </div>

            {/* Meeting Mode Selection */}
            <div>
              <label className="text-[11px] font-bold text-ink-muted block mb-1">Meeting Mode</label>
              <div className="relative flex items-center">
                <Video size={14} className="absolute left-3 text-indigo-500 pointer-events-none" />
                <select
                  value={genMode}
                  onChange={(e) => setGenMode(e.target.value as MeetingMode)}
                  className="w-full rounded-xl border border-line bg-white pl-9 pr-3 py-1.5 text-xs font-bold text-ink focus:border-indigo-500 focus:outline-none cursor-pointer"
                >
                  <option value="LIVEKIT_VIDEO">LiveKit Video Room</option>
                  <option value="GOOGLE_MEET">Google Meet</option>
                  <option value="MS_TEAMS">Microsoft Teams</option>
                  <option value="OFFLINE">Offline / In-Person</option>
                </select>
              </div>
            </div>

            {/* Start & End Times */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-bold text-ink-muted block mb-1">Start Time</label>
                <div className="relative flex items-center">
                  <Clock size={14} className="absolute left-2.5 text-indigo-500 pointer-events-none" />
                  <input
                    type="time"
                    value={genStartTime}
                    onChange={(e) => setGenStartTime(e.target.value)}
                    className="w-full rounded-xl border border-line bg-white pl-8 pr-2 py-1.5 text-xs font-bold text-ink focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-ink-muted block mb-1">End Time</label>
                <div className="relative flex items-center">
                  <Clock size={14} className="absolute left-2.5 text-indigo-500 pointer-events-none" />
                  <input
                    type="time"
                    value={genEndTime}
                    onChange={(e) => setGenEndTime(e.target.value)}
                    className="w-full rounded-xl border border-line bg-white pl-8 pr-2 py-1.5 text-xs font-bold text-ink focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Time Interval & Break Duration */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-bold text-ink-muted block mb-1">Slot Duration</label>
                <select
                  value={genIntervalMinutes}
                  onChange={(e) => setGenIntervalMinutes(Number(e.target.value))}
                  className="w-full rounded-xl border border-line bg-white px-2.5 py-1.5 text-xs font-bold text-ink focus:border-indigo-500 focus:outline-none cursor-pointer"
                >
                  <option value={15}>15 mins</option>
                  <option value={30}>30 mins</option>
                  <option value={45}>45 mins</option>
                  <option value={60}>60 mins</option>
                  <option value={90}>90 mins</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-ink-muted block mb-1">Break Duration</label>
                <select
                  value={genBreakMinutes}
                  onChange={(e) => setGenBreakMinutes(Number(e.target.value))}
                  className="w-full rounded-xl border border-line bg-white px-2.5 py-1.5 text-xs font-bold text-ink focus:border-indigo-500 focus:outline-none cursor-pointer"
                >
                  <option value={0}>0 min (None)</option>
                  <option value={5}>5 mins</option>
                  <option value={10}>10 mins</option>
                  <option value={15}>15 mins</option>
                  <option value={30}>30 mins</option>
                </select>
              </div>
            </div>
          </div>

          {/* Generate Button */}
          <button
            type="button"
            onClick={handleGenerateSlotsByInterval}
            className="w-full mt-3 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 text-xs font-bold shadow-sm transition-all cursor-pointer"
          >
            <Calendar size={14} />
            <span>Generate Slots</span>
          </button>
        </div>

        {/* ── COLUMN 3: INTERVIEW SLOTS TABLE FOR SELECTED DATE ── */}
        <div className="lg:col-span-5 rounded-2xl border border-line bg-white p-5 shadow-xs flex flex-col justify-between">
          <div>
            {/* Header: Title and Stats */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-line pb-3 mb-3">
              <h3 className="text-xs font-bold text-ink">
                Interview Slots for {formatSelectedDateHuman(selectedDate)} ({dateSlots.length} Slots)
              </h3>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1 font-bold text-emerald-700 text-[11px]">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Available: {selectedDateStats.available}
                </span>
                <span className="flex items-center gap-1 font-bold text-purple-700 text-[11px]">
                  <span className="h-2 w-2 rounded-full bg-purple-500" />
                  Booked: {selectedDateStats.booked}
                </span>
                <span className="flex items-center gap-1 font-bold text-slate-500 text-[11px]">
                  <span className="h-2 w-2 rounded-full bg-slate-400" />
                  Completed: {selectedDateStats.completed}
                </span>
              </div>
            </div>

            {/* Table */}
            {dateSlots.length === 0 ? (
              <div className="py-12 text-center text-xs text-ink-muted">
                No slots configured for {selectedDate}. Use the generator to add slots!
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[340px] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-line/60 text-[11px] font-bold text-ink-muted">
                      <th className="py-2 pr-3">Time Slot</th>
                      <th className="py-2 px-3">Host</th>
                      <th className="py-2 px-3">Mode</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 pl-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/40">
                    {dateSlots.map((slot) => {
                      const completed = isSlotCompleted(slot);
                      const isBooked = slot.status === "BOOKED";
                      const isAvailable = slot.status === "AVAILABLE";
                      const elapsed = isSlotElapsed(slot);

                      return (
                        <tr
                          key={slot.id}
                          className={`transition-colors ${
                            isBooked ? "bg-purple-50/70" : "hover:bg-canvas/50"
                          }`}
                        >
                          {/* Time Slot */}
                          <td className="py-2.5 pr-3 font-bold text-ink whitespace-nowrap">
                            {formatTime12h(slot.startTime)} – {formatTime12h(slot.endTime)}
                          </td>

                          {/* Host */}
                          <td className="py-2.5 px-3 text-ink whitespace-nowrap">
                            <span className="flex items-center gap-1">
                              <User size={12} className="text-ink-muted" />
                              <span className="truncate max-w-[110px]" title={slot.interviewerName}>
                                {slot.interviewerName}
                              </span>
                            </span>
                          </td>

                          {/* Mode */}
                          <td className="py-2.5 px-3 text-ink-muted whitespace-nowrap">
                            <span className="flex items-center gap-1">
                              {slot.mode === "OFFLINE" ? (
                                <Users size={12} className="text-amber-600" />
                              ) : (
                                <Video size={12} className="text-indigo-500" />
                              )}
                              <span>{getMeetingModeLabel(slot.mode).split(" ")[0]}</span>
                            </span>
                          </td>

                          {/* Status */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {completed ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                                <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                                Completed
                              </span>
                            ) : isBooked ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700">
                                <span className="h-1.5 w-1.5 rounded-full bg-purple-600" />
                                Booked
                              </span>
                            ) : elapsed ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                                Expired
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                Available
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Eye icon to view details */}
                              <button
                                type="button"
                                onClick={() => setViewingSlot(slot)}
                                className="p-1 rounded hover:bg-line text-ink-muted hover:text-indigo-600 transition-colors cursor-pointer"
                                title="View Details"
                              >
                                <Eye size={13} />
                              </button>

                              {/* Book Candidate (if available and not elapsed) */}
                              {isAvailable && !elapsed && (
                                <button
                                  type="button"
                                  onClick={() => setBookingSlot(slot)}
                                  className="p-1 rounded hover:bg-line text-ink-muted hover:text-indigo-600 transition-colors cursor-pointer"
                                  title="Book Candidate"
                                >
                                  <EditIcon size={13} />
                                </button>
                              )}

                              {/* Reschedule Button if booked */}
                              {isBooked && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenReschedule(slot)}
                                  className="p-1 rounded hover:bg-indigo-50 text-ink-muted hover:text-indigo-600 transition-colors cursor-pointer"
                                  title="Reschedule Interview"
                                >
                                  <CalendarSync size={13} />
                                </button>
                              )}

                              {/* Trash icon */}
                              {!isBooked && (
                                <button
                                  type="button"
                                  onClick={() => setDeletingSlot(slot)}
                                  className="p-1 rounded hover:bg-rose-50 text-ink-muted hover:text-rose-600 transition-colors cursor-pointer"
                                  title="Delete Slot"
                                >
                                  <Trash size={13} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 4. BOTTOM SECTION: CONFIGURED SLOTS (DATE-WISE COLLAPSIBLE ACCORDION) ── */}
      <div className="space-y-4 pt-2">
        {/* Header with Filter Pills & Expand/Collapse All */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-ink font-display">
              Configured Slots for {selectedRound.name}
            </h3>
            <span className="text-xs text-ink-muted">• Job: {selectedJob.title}</span>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Filter Tabs: All Slots, Selected Date, Upcoming, Completed */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setSlotFilter("ALL");
                  setDatePage(1);
                }}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  slotFilter === "ALL"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-canvas text-ink-muted hover:text-ink hover:bg-line border border-line"
                }`}
              >
                All Slots ({totalRoundStats.total})
              </button>

              <button
                type="button"
                onClick={() => {
                  setSlotFilter("SELECTED_DATE");
                  setDatePage(1);
                }}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  slotFilter === "SELECTED_DATE"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-canvas text-ink-muted hover:text-ink hover:bg-line border border-line"
                }`}
              >
                Selected Date ({totalRoundStats.onSelectedDate})
              </button>

              <button
                type="button"
                onClick={() => {
                  setSlotFilter("UPCOMING");
                  setDatePage(1);
                }}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  slotFilter === "UPCOMING"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-canvas text-ink-muted hover:text-ink hover:bg-line border border-line"
                }`}
              >
                Upcoming ({totalRoundStats.upcoming})
              </button>

              <button
                type="button"
                onClick={() => {
                  setSlotFilter("COMPLETED");
                  setDatePage(1);
                }}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  slotFilter === "COMPLETED"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-canvas text-ink-muted hover:text-ink hover:bg-line border border-line"
                }`}
              >
                Completed ({totalRoundStats.completed})
              </button>
            </div>

            {/* Quick Accordion Toggles */}
            {sortedDates.length > 0 && (
              <div className="hidden sm:flex items-center gap-1 border-l border-line pl-3">
                <button
                  type="button"
                  onClick={handleExpandAll}
                  className="px-2.5 py-1 text-[11px] font-bold text-ink-muted hover:text-indigo-600 hover:bg-canvas rounded-lg transition-colors cursor-pointer"
                  title="Expand All Dates"
                >
                  Expand All
                </button>
                <span className="text-line text-xs">|</span>
                <button
                  type="button"
                  onClick={handleCollapseAll}
                  className="px-2.5 py-1 text-[11px] font-bold text-ink-muted hover:text-indigo-600 hover:bg-canvas rounded-lg transition-colors cursor-pointer"
                  title="Collapse All Dates"
                >
                  Collapse All
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Date-wise Accordion Container */}
        {sortedDates.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-white p-12 text-center text-xs text-ink-muted">
            No interview slots found matching filter: <strong>{slotFilter}</strong>.
          </div>
        ) : (
          <div className="space-y-3">
            {paginatedDates.map((d) => {
              const dSlots = groupedSlotsByDate[d] || [];
              const dTotal = dSlots.length;
              const dAvailable = dSlots.filter((s) => s.status === "AVAILABLE" && !isSlotElapsed(s)).length;
              const dBooked = dSlots.filter((s) => s.status === "BOOKED").length;
              const dCompleted = dSlots.filter((s) => s.status === "COMPLETED").length;
              const isExpanded = isDateExpanded(d);

              return (
                <div
                  key={d}
                  className={`rounded-2xl border bg-white shadow-xs overflow-hidden transition-all ${
                    isExpanded
                      ? "border-indigo-300 ring-2 ring-indigo-500/10"
                      : "border-line hover:border-line-2"
                  }`}
                >
                  {/* Collapsible Date Header */}
                  <button
                    type="button"
                    onClick={() => handleToggleDate(d)}
                    className={`w-full flex flex-col md:flex-row md:items-center md:justify-between p-3.5 sm:p-4 text-left transition-colors cursor-pointer gap-3 select-none ${
                      isExpanded
                        ? "bg-indigo-50/40 border-b border-indigo-100"
                        : "hover:bg-canvas/40"
                    }`}
                  >
                    {/* Left: Calendar Icon + Date + Badges */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
                          isExpanded
                            ? "border-indigo-300 bg-indigo-600 text-white shadow-xs"
                            : "border-line bg-canvas text-ink-muted"
                        }`}
                      >
                        <Calendar size={16} />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-ink font-display">
                            {formatSelectedDateHuman(d)}
                          </span>
                          <span className="text-xs text-ink-muted font-mono">({d})</span>
                        </div>
                        <p className="text-[11px] text-ink-muted mt-0.5">
                          {dTotal === 1 ? "1 interview slot configured" : `${dTotal} interview slots configured`}
                        </p>
                      </div>
                    </div>

                    {/* Right: Summary Status Counters + Expand/Collapse Chevron */}
                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                        Total: {dTotal}
                      </span>

                      <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full text-[11px] border border-emerald-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Available: {dAvailable}
                      </span>

                      <span className="inline-flex items-center gap-1 font-bold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full text-[11px] border border-purple-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-purple-600" />
                        Booked: {dBooked}
                      </span>

                      <span className="inline-flex items-center gap-1 font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full text-[11px] border border-slate-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                        Completed: {dCompleted}
                      </span>

                      <div
                        className={`ml-1 flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
                          isExpanded
                            ? "bg-indigo-100 text-indigo-700"
                            : "bg-canvas text-ink-muted"
                        }`}
                      >
                        <ChevronRight
                          size={16}
                          className={`transition-transform duration-200 ${
                            isExpanded ? "transform rotate-90 text-indigo-700" : ""
                          }`}
                        />
                      </div>
                    </div>
                  </button>

                  {/* Accordion Body: Compact Interview Slots Table */}
                  {isExpanded && (
                    <div className="bg-white">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-line/60 bg-canvas/30 text-[11px] font-bold text-ink-muted">
                              <th className="py-2.5 px-4 whitespace-nowrap">Time Window</th>
                              <th className="py-2.5 px-3 whitespace-nowrap">Interviewer Host</th>
                              <th className="py-2.5 px-3 whitespace-nowrap">Meeting Mode</th>
                              <th className="py-2.5 px-3">Candidate Assignment</th>
                              <th className="py-2.5 px-3 whitespace-nowrap">Status</th>
                              <th className="py-2.5 px-4 text-right whitespace-nowrap">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-line/40">
                            {dSlots.map((slot) => {
                              const isBooked = slot.status === "BOOKED";
                              const completed = isSlotCompleted(slot);
                              const elapsed = isSlotElapsed(slot);

                              return (
                                <tr
                                  key={slot.id}
                                  className={`transition-colors ${
                                    isBooked ? "bg-purple-50/40 hover:bg-purple-50/70" : "hover:bg-canvas/50"
                                  }`}
                                >
                                  {/* Time Window */}
                                  <td className="py-3 px-4 whitespace-nowrap">
                                    <div className="flex items-center gap-2">
                                      <Clock size={14} className="text-indigo-500 shrink-0" />
                                      <span className="font-bold text-ink">
                                        {formatTime12h(slot.startTime)} – {formatTime12h(slot.endTime)}
                                      </span>
                                      <span className="text-[11px] text-ink-muted font-normal">
                                        ({slot.durationMinutes}m)
                                      </span>
                                    </div>
                                  </td>

                                  {/* Interviewer Host */}
                                  <td className="py-3 px-3 whitespace-nowrap">
                                    <div className="flex items-center gap-1.5 text-ink">
                                      <User size={13} className="text-ink-muted shrink-0" />
                                      <span className="font-semibold">{slot.interviewerName}</span>
                                    </div>
                                  </td>

                                  {/* Meeting Mode */}
                                  <td className="py-3 px-3 whitespace-nowrap">
                                    <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
                                      {slot.mode === "OFFLINE" ? (
                                        <Users size={13} className="text-amber-600 shrink-0" />
                                      ) : (
                                        <Video size={13} className="text-indigo-500 shrink-0" />
                                      )}
                                      <span className="font-medium">{getMeetingModeLabel(slot.mode)}</span>
                                    </span>
                                  </td>

                                  {/* Candidate Details or Quick Booking */}
                                  <td className="py-3 px-3 min-w-[220px]">
                                    {isBooked ? (
                                      <div className="flex flex-col text-xs">
                                        <span className="font-bold text-ink">{slot.bookedCandidateName}</span>
                                        <span className="text-[11px] text-ink-muted truncate max-w-[220px]">
                                          {slot.bookedCandidateEmail}
                                        </span>
                                      </div>
                                    ) : elapsed ? (
                                      <span className="text-[11px] text-slate-400 italic">Slot time has elapsed</span>
                                    ) : (
                                      <select
                                        onChange={(e) => {
                                          if (e.target.value) handleAssignCandidateToSlot(slot.id, e.target.value);
                                        }}
                                        defaultValue=""
                                        className="rounded-lg border border-line bg-canvas/40 px-2.5 py-1 text-xs font-semibold text-ink focus:border-indigo-500 focus:outline-none cursor-pointer w-full max-w-[210px]"
                                      >
                                        <option value="" disabled>
                                          -- Book Candidate --
                                        </option>
                                        {applications.map((app) => (
                                          <option key={app.id} value={app.id}>
                                            {app.candidateName || "Candidate"} ({app.jobTitle})
                                          </option>
                                        ))}
                                      </select>
                                    )}
                                  </td>

                                  {/* Status Badge */}
                                  <td className="py-3 px-3 whitespace-nowrap">
                                    {completed ? (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                                        <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                                        Completed
                                      </span>
                                    ) : isBooked ? (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700">
                                        <span className="h-1.5 w-1.5 rounded-full bg-purple-600" />
                                        Booked
                                      </span>
                                    ) : elapsed ? (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                                        Expired
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                        Available
                                      </span>
                                    )}
                                  </td>

                                  {/* Actions */}
                                  <td className="py-3 px-4 text-right whitespace-nowrap">
                                    <div className="flex items-center justify-end gap-1.5">
                                      {/* Copy Link */}
                                      <button
                                        type="button"
                                        onClick={() => handleCopyMeetingLink(slot)}
                                        className="p-1.5 rounded-lg border border-line hover:bg-canvas text-ink-muted hover:text-indigo-600 transition-colors cursor-pointer"
                                        title="Copy Meeting Link"
                                      >
                                        <Copy size={13} />
                                      </button>

                                      {/* Join Room (if video link) */}
                                      {slot.mode !== "OFFLINE" ? (
                                        <a
                                          href={slot.meetingLink || "#"}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 hover:bg-emerald-100 transition-colors"
                                          title="Join Live Room"
                                        >
                                          <Video size={12} />
                                          <span>Join</span>
                                        </a>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200">
                                          <Users size={12} />
                                          <span>HQ</span>
                                        </span>
                                      )}

                                      {/* Reschedule (for booked) */}
                                      {isBooked && (
                                        <button
                                          type="button"
                                          onClick={() => handleOpenReschedule(slot)}
                                          className="p-1.5 rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                                          title="Reschedule Interview"
                                        >
                                          <CalendarSync size={13} />
                                        </button>
                                      )}

                                      {/* Mark Completed (for booked and not completed) */}
                                      {isBooked && !completed && (
                                        <button
                                          type="button"
                                          onClick={() => handleOpenComplete(slot)}
                                          className="p-1.5 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                                          title="Confirm Interview Completion"
                                        >
                                          <Check size={13} />
                                        </button>
                                      )}

                                      {/* 3-dots Menu for Delete, Cancel, View */}
                                      <div className="relative">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveMenuSlotId(activeMenuSlotId === slot.id ? null : slot.id);
                                          }}
                                          className="p-1.5 rounded-lg border border-line hover:bg-canvas text-ink-muted hover:text-ink transition-colors cursor-pointer"
                                          title="More Actions"
                                        >
                                          <MoreVertical size={13} />
                                        </button>

                                        {activeMenuSlotId === slot.id && (
                                          <div
                                            onClick={(e) => e.stopPropagation()}
                                            className="absolute right-0 top-8 z-30 w-44 rounded-xl border border-line bg-white p-1 shadow-lg animate-in fade-in zoom-in-95 text-left space-y-0.5"
                                          >
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setActiveMenuSlotId(null);
                                                setViewingSlot(slot);
                                              }}
                                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-muted hover:text-ink hover:bg-canvas transition-colors cursor-pointer"
                                            >
                                              <Eye size={13} />
                                              <span>View Details</span>
                                            </button>

                                            {isBooked && (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setActiveMenuSlotId(null);
                                                  handleOpenCancel(slot);
                                                }}
                                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 transition-colors cursor-pointer"
                                              >
                                                <X size={13} />
                                                <span>Cancel Interview</span>
                                              </button>
                                            )}

                                            <button
                                              type="button"
                                              onClick={() => {
                                                setActiveMenuSlotId(null);
                                                setDeletingSlot(slot);
                                              }}
                                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                            >
                                              <Trash size={13} />
                                              <span>Delete Slot</span>
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Date-wise Pagination Controls */}
        {totalDatePages > 1 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-line text-xs">
            <span className="text-ink-muted">
              Showing dates <strong>{(datePage - 1) * DATES_PER_PAGE + 1}</strong> to{" "}
              <strong>{Math.min(sortedDates.length, datePage * DATES_PER_PAGE)}</strong> of{" "}
              <strong>{sortedDates.length}</strong> scheduled dates
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={datePage === 1}
                onClick={() => setDatePage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-xl border border-line bg-white font-bold text-ink hover:bg-canvas disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                Previous
              </button>

              {Array.from({ length: totalDatePages }, (_, i) => i + 1).map((pg) => (
                <button
                  key={pg}
                  type="button"
                  onClick={() => setDatePage(pg)}
                  className={`h-8 w-8 rounded-xl font-bold transition-all cursor-pointer ${
                    datePage === pg
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "border border-line bg-white text-ink hover:bg-canvas"
                  }`}
                >
                  {pg}
                </button>
              ))}

              <button
                type="button"
                disabled={datePage === totalDatePages}
                onClick={() => setDatePage((p) => Math.min(totalDatePages, p + 1))}
                className="px-3 py-1.5 rounded-xl border border-line bg-white font-bold text-ink hover:bg-canvas disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── MODAL: RESCHEDULE INTERVIEW ── */}
      {reschedulingSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-line space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-200">
                  <CalendarSync size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-ink font-display">Reschedule Interview</h3>
                  <p className="text-[11px] text-ink-muted">Candidate will receive an automatic update email.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReschedulingSlot(null)}
                className="text-ink-muted hover:text-ink p-1 rounded-lg hover:bg-canvas transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="rounded-xl bg-slate-50 border border-line p-3 space-y-1 text-xs">
              <div className="text-ink-muted">
                Candidate: <strong className="text-ink">{reschedulingSlot.bookedCandidateName}</strong> ({reschedulingSlot.bookedCandidateEmail})
              </div>
              <div className="text-ink-muted">
                Current Slot: <strong>{reschedulingSlot.date}</strong> ({formatTime12h(reschedulingSlot.startTime)} – {formatTime12h(reschedulingSlot.endTime)})
              </div>
              <div className="text-ink-muted">
                Interviewer Host: <strong>{reschedulingSlot.interviewerName}</strong>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] font-bold text-ink-muted block mb-1">New Interview Date</label>
                <input
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full rounded-xl border border-line p-2 text-xs font-bold text-ink focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-ink-muted block mb-1">New Start Time</label>
                  <input
                    type="time"
                    value={rescheduleStartTime}
                    onChange={(e) => setRescheduleStartTime(e.target.value)}
                    className="w-full rounded-xl border border-line p-2 text-xs font-bold text-ink focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-ink-muted block mb-1">New End Time</label>
                  <input
                    type="time"
                    value={rescheduleEndTime}
                    onChange={(e) => setRescheduleEndTime(e.target.value)}
                    className="w-full rounded-xl border border-line p-2 text-xs font-bold text-ink focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-ink-muted block mb-1">Reason for Rescheduling (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Interviewer urgent schedule adjustment"
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  className="w-full rounded-xl border border-line p-2 text-xs text-ink focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-line flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setReschedulingSlot(null)} className="text-xs font-bold">
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmReschedule}
                className="text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Confirm Reschedule & Email Candidate
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: CANCEL BOOKED INTERVIEW ── */}
      {cancellingSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-line space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl border border-amber-200">
                  <Alert size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-ink font-display">Cancel Booked Interview</h3>
                  <p className="text-[11px] text-ink-muted">Candidate will be notified via email.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCancellingSlot(null)}
                className="text-ink-muted hover:text-ink p-1 rounded-lg hover:bg-canvas transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="rounded-xl bg-slate-50 border border-line p-3 space-y-1 text-xs">
              <div>Candidate: <strong>{cancellingSlot.bookedCandidateName}</strong> ({cancellingSlot.bookedCandidateEmail})</div>
              <div>Interview: <strong>{cancellingSlot.date}</strong> ({formatTime12h(cancellingSlot.startTime)} – {formatTime12h(cancellingSlot.endTime)})</div>
              <div>Round: <strong>{cancellingSlot.roundName}</strong></div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] font-bold text-ink-muted block mb-1">Reason for Cancellation</label>
                <textarea
                  rows={2}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full rounded-xl border border-line p-2 text-xs text-ink focus:border-indigo-500 focus:outline-none"
                  placeholder="Explain why this interview is cancelled..."
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="releaseSlot"
                  checked={cancelReleaseSlot}
                  onChange={(e) => setCancelReleaseSlot(e.target.checked)}
                  className="rounded border-line text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="releaseSlot" className="text-xs text-ink font-semibold cursor-pointer">
                  Release this time slot back to Available (keep in schedule)
                </label>
              </div>
            </div>

            <div className="pt-2 border-t border-line flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCancellingSlot(null)} className="text-xs font-bold">
                Keep Interview
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmCancel}
                className="text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white border-amber-600"
              >
                Confirm Cancellation
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: CONFIRM INTERVIEW COMPLETION ── */}
      {completingSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-line space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-200">
                  <Check size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-ink font-display">Confirm Interview Completion</h3>
                  <p className="text-[11px] text-ink-muted">Interviews are completed only after HR confirmation.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCompletingSlot(null)}
                className="text-ink-muted hover:text-ink p-1 rounded-lg hover:bg-canvas transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="rounded-xl bg-slate-50 border border-line p-3 space-y-1 text-xs">
              <div>Candidate: <strong>{completingSlot.bookedCandidateName}</strong></div>
              <div>Round: <strong>{completingSlot.roundName}</strong></div>
              <div>Conducted on: <strong>{completingSlot.date}</strong> ({formatTime12h(completingSlot.startTime)} – {formatTime12h(completingSlot.endTime)})</div>
              <div>Interviewer: <strong>{completingSlot.interviewerName}</strong></div>
            </div>

            <div className="space-y-2 text-xs">
              <label className="text-[11px] font-bold text-ink-muted block">
                Evaluation Notes / Comments (Optional)
              </label>
              <textarea
                rows={3}
                value={completeNotes}
                onChange={(e) => setCompleteNotes(e.target.value)}
                placeholder="Candidate demonstrated strong system architecture fundamentals..."
                className="w-full rounded-xl border border-line p-2 text-xs text-ink focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="pt-2 border-t border-line flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCompletingSlot(null)} className="text-xs font-bold">
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmComplete}
                className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Confirm as Completed
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: VIEW SLOT DETAILS ── */}
      {viewingSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-line space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="font-bold text-base text-ink font-display">Interview Slot Details</h3>
              <button
                type="button"
                onClick={() => setViewingSlot(null)}
                className="text-ink-muted hover:text-ink p-1 rounded-lg hover:bg-canvas transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-ink-muted block text-[10px] font-bold uppercase">Date & Time</span>
                <span className="text-sm font-bold text-ink">
                  {formatSelectedDateHuman(viewingSlot.date)} ({formatTime12h(viewingSlot.startTime)} – {formatTime12h(viewingSlot.endTime)})
                </span>
              </div>

              <div>
                <span className="text-ink-muted block text-[10px] font-bold uppercase">Assessment Round</span>
                <span className="text-xs font-semibold text-ink">{viewingSlot.roundName}</span>
              </div>

              <div>
                <span className="text-ink-muted block text-[10px] font-bold uppercase">Status</span>
                <span className="inline-block mt-0.5 font-bold">{viewingSlot.status}</span>
              </div>

              {viewingSlot.bookedCandidateName && (
                <div className="rounded-xl bg-purple-50 p-3 border border-purple-200 space-y-1">
                  <span className="text-purple-700 font-bold block text-[10px] uppercase">Booked Candidate</span>
                  <div className="text-xs font-bold text-ink">{viewingSlot.bookedCandidateName}</div>
                  <div className="text-[11px] text-ink-muted">{viewingSlot.bookedCandidateEmail}</div>
                </div>
              )}

              <div>
                <span className="text-ink-muted block text-[10px] font-bold uppercase">Interviewer Host</span>
                <span className="text-xs font-semibold text-ink">{viewingSlot.interviewerName} ({viewingSlot.interviewerEmail})</span>
              </div>

              <div>
                <span className="text-ink-muted block text-[10px] font-bold uppercase">Meeting Mode & Location</span>
                <span className="text-xs font-bold text-ink">{getMeetingModeLabel(viewingSlot.mode)}</span>
                <div className="mt-1">
                  {viewingSlot.mode === "OFFLINE" ? (
                    <span className="text-xs text-ink font-semibold">{viewingSlot.meetingLink}</span>
                  ) : (
                    <a
                      href={viewingSlot.meetingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold text-indigo-600 hover:underline break-all"
                    >
                      {viewingSlot.meetingLink}
                    </a>
                  )}
                </div>
              </div>

              {viewingSlot.notes && (
                <div className="rounded-xl bg-slate-50 p-2.5 border border-line text-xs">
                  <span className="text-ink-muted font-bold block text-[10px] uppercase">Notes / Evaluation:</span>
                  <p className="text-ink mt-0.5">{viewingSlot.notes}</p>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-line flex justify-end gap-2">
              {viewingSlot.status === "BOOKED" && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    const target = viewingSlot;
                    setViewingSlot(null);
                    handleOpenReschedule(target);
                  }}
                  className="text-xs font-bold text-indigo-600"
                >
                  Reschedule
                </Button>
              )}
              <Button variant="primary" onClick={() => setViewingSlot(null)} className="text-xs font-bold bg-indigo-600 text-white">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: BOOK CANDIDATE ── */}
      {bookingSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-line space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="font-bold text-base text-ink font-display">Book Candidate into Slot</h3>
              <button
                type="button"
                onClick={() => setBookingSlot(null)}
                className="text-ink-muted hover:text-ink p-1 rounded-lg hover:bg-canvas transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="text-xs text-ink-muted">
              Select a candidate to book into the slot on <strong>{bookingSlot.date}</strong> ({formatTime12h(bookingSlot.startTime)} – {formatTime12h(bookingSlot.endTime)}):
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-ink-muted uppercase block">Candidates</label>
              <select
                id="booking-select"
                className="w-full rounded-xl border border-line bg-white p-2.5 text-xs font-bold text-ink focus:border-indigo-500 focus:outline-none cursor-pointer"
              >
                {applications.map((app) => (
                  <option key={app.id} value={app.id}>
                    {app.candidateName || "Candidate"} — {app.jobTitle} ({app.email})
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-2 border-t border-line flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setBookingSlot(null)} className="text-xs font-bold">
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  const sel = document.getElementById("booking-select") as HTMLSelectElement;
                  if (sel?.value) handleAssignCandidateToSlot(bookingSlot.id, sel.value);
                }}
                className="text-xs font-bold bg-indigo-600 text-white"
              >
                Confirm Booking
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: CONFIRM DELETE SLOT ── */}
      {deletingSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-line space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-rose-50 text-rose-600 rounded-xl border border-rose-200">
                  <Trash size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-ink font-display">Delete Interview Slot</h3>
                  <p className="text-[11px] text-ink-muted">Are you sure you want to remove this interview slot?</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeletingSlot(null)}
                className="text-ink-muted hover:text-ink p-1 rounded-lg hover:bg-canvas transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="rounded-xl bg-slate-50 border border-line p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-ink-muted text-[11px] font-semibold">Date:</span>
                <span className="font-bold text-ink">{deletingSlot.date}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-muted text-[11px] font-semibold">Time Window:</span>
                <span className="font-bold text-ink">
                  {formatTime12h(deletingSlot.startTime)} – {formatTime12h(deletingSlot.endTime)} ({deletingSlot.durationMinutes} mins)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-muted text-[11px] font-semibold">Assessment Round:</span>
                <span className="font-semibold text-ink">{deletingSlot.roundName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-muted text-[11px] font-semibold">Interviewer Host:</span>
                <span className="font-semibold text-ink">{deletingSlot.interviewerName}</span>
              </div>
              {deletingSlot.bookedCandidateName && (
                <div className="mt-2 rounded-lg bg-rose-50 p-2.5 border border-rose-200 text-rose-700 text-[11px] font-semibold">
                  ⚠️ Warning: This slot is booked for <strong>{deletingSlot.bookedCandidateName}</strong> ({deletingSlot.bookedCandidateEmail}). Deleting will cancel their booking.
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-line flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setDeletingSlot(null)}
                className="text-xs font-bold"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  handleDeleteSlot(deletingSlot.id);
                  setDeletingSlot(null);
                  setNotice("✓ Slot deleted successfully.");
                  setTimeout(() => setNotice(""), 3000);
                }}
                className="text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white"
              >
                Delete Slot
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
