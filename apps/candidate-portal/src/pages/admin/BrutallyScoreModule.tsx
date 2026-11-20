import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Card, Pill } from "@/components/ui/Card";
import {
  Alert,
  Briefcase,
  Check,
  Clock,
  Eye,
  Plus,
  Shield,
  Sparkle,
  Trash,
  User,
  X,
} from "@/components/ui/icons";

export type ScreeningQuestionType = "NUMBER" | "MCQ" | "SHORT_ANSWER" | "YES_NO";

export interface ScreeningQuestion {
  id: string;
  prompt: string;
  type: ScreeningQuestionType;
  options: string[];
  correctOptionIndex?: number;
  placeholder?: string;
  expectedAnswer?: string;
  points: number;
  category?: string;
  required?: boolean;
}

export interface RoleThresholdPolicy {
  jobId: string;
  jobTitle: string;
  resumeScoreThreshold: number; // e.g. 75
  screeningScoreThreshold: number; // e.g. 70
  screeningDeadlineDays: number; // e.g. 3
  autoShortlistOnPass: boolean;
  strictProctoring: boolean;
  lastUpdated?: string;
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

interface BrutallyScoreModuleProps {
  jobs: JobItem[];
  tenant: { slug: string; name: string };
}

// Standard Universal Candidate Screening Questions:
// Basic candidate information questions applicable to all applicants:
// 1. Current CTC (₹ LPA)
// 2. Expected CTC (₹ LPA)
// 3. What is your official notice period?
// 4. Are you comfortable with the specified work location?
// 5. Total Experience
export function getStandardGlobalScreeningQuestions(): ScreeningQuestion[] {
  return [
    {
      id: "q-current-ctc",
      prompt: "Current CTC (₹ LPA)",
      type: "NUMBER",
      options: [],
      placeholder: "e.g. 8.5",
      expectedAnswer: "Current annualized CTC in Lakhs Per Annum (₹ LPA)",
      points: 20,
      category: "Compensation",
      required: true,
    },
    {
      id: "q-expected-ctc",
      prompt: "Expected CTC (₹ LPA)",
      type: "NUMBER",
      options: [],
      placeholder: "e.g. 14.0",
      expectedAnswer: "Expected annual compensation in Lakhs Per Annum (₹ LPA)",
      points: 20,
      category: "Compensation",
      required: true,
    },
    {
      id: "q-notice-period",
      prompt: "What is your official notice period?",
      type: "MCQ",
      options: [
        "Immediate Joiner (< 15 days / Serving Notice)",
        "30 Days",
        "60 Days",
        "90 Days (Standard official notice)",
      ],
      correctOptionIndex: 0,
      expectedAnswer: "Preferred: Immediate to 30 days joining window",
      points: 20,
      category: "Availability",
      required: true,
    },
    {
      id: "q-work-location",
      prompt: "Are you comfortable with the specified work location?",
      type: "MCQ",
      options: [
        "Yes, completely comfortable with the work location & hybrid schedule",
        "Yes, open to relocation",
        "Prefer 100% remote work only",
        "No, location is not feasible",
      ],
      correctOptionIndex: 0,
      expectedAnswer: "Candidate must be open to location requirements",
      points: 20,
      category: "Workplace & Relocation",
      required: true,
    },
    {
      id: "q-total-experience",
      prompt: "Total Experience",
      type: "MCQ",
      options: [
        "< 1 Year (Fresher / Entry Level)",
        "1 - 3 Years",
        "3 - 5 Years",
        "5+ Years (Mid to Senior)",
      ],
      correctOptionIndex: 1,
      placeholder: "e.g. 3 years 6 months in relevant industry role",
      expectedAnswer: "Relevant full-time professional experience",
      points: 20,
      category: "Experience",
      required: true,
    },
  ];
}

export function BrutallyScoreModule({ jobs, tenant }: BrutallyScoreModuleProps) {
  // ── 1. SECTION 1: ROLE-SPECIFIC THRESHOLDS STATE ──
  const [selectedJobId, setSelectedJobId] = useState<string>(() => {
    return jobs[0]?.id || "default";
  });

  const selectedJob = jobs.find((j) => j.id === selectedJobId) || jobs[0] || {
    id: "default",
    title: "Software Developer",
    department: "Engineering",
    location: "Visakhapatnam (Hybrid)",
    experience: "1+ years",
    keywords: "TypeScript, React, Node.js, Distributed Systems",
    workplaceType: "HYBRID",
    status: "OPEN",
    applicantCount: 1,
    externalRef: "software-developer",
  };

  const [resumeThreshold, setResumeThreshold] = useState<number>(75);
  const [screeningThreshold, setScreeningThreshold] = useState<number>(70);
  const [screeningDeadlineDays, setScreeningDeadlineDays] = useState<number>(3);
  const [autoShortlist, setAutoShortlist] = useState<boolean>(true);
  const [strictProctoring, setStrictProctoring] = useState<boolean>(true);
  const [roleNotice, setRoleNotice] = useState<string>("");

  // Load role thresholds when selected role changes
  useEffect(() => {
    const thresholdKey = `bh_role_threshold_${selectedJob.id}`;
    const savedThreshold = localStorage.getItem(thresholdKey);
    if (savedThreshold) {
      try {
        const parsed: RoleThresholdPolicy = JSON.parse(savedThreshold);
        setResumeThreshold(parsed.resumeScoreThreshold ?? 75);
        setScreeningThreshold(parsed.screeningScoreThreshold ?? 70);
        setScreeningDeadlineDays(parsed.screeningDeadlineDays ?? 3);
        setAutoShortlist(parsed.autoShortlistOnPass ?? true);
        setStrictProctoring(parsed.strictProctoring ?? true);
      } catch {
        // use defaults
      }
    } else {
      setResumeThreshold(75);
      setScreeningThreshold(70);
      setScreeningDeadlineDays(3);
      setAutoShortlist(true);
      setStrictProctoring(true);
    }
  }, [selectedJob.id]);

  const handleSaveRoleThresholds = () => {
    const policy: RoleThresholdPolicy = {
      jobId: selectedJob.id,
      jobTitle: selectedJob.title,
      resumeScoreThreshold: resumeThreshold,
      screeningScoreThreshold: screeningThreshold,
      screeningDeadlineDays,
      autoShortlistOnPass: autoShortlist,
      strictProctoring,
      lastUpdated: new Date().toISOString(),
    };
    localStorage.setItem(`bh_role_threshold_${selectedJob.id}`, JSON.stringify(policy));
    setRoleNotice(`Thresholds saved for ${selectedJob.title}!`);
    setTimeout(() => setRoleNotice(""), 3000);
  };

  // ── 2. SECTION 2: GLOBAL CANDIDATE SCREENING QUESTIONS STATE ──
  // Note: These questions are universal to candidates (CTC, Notice, Location, Experience) and not role-restricted
  const [screeningQuestions, setScreeningQuestions] = useState<ScreeningQuestion[]>(() => {
    const saved = localStorage.getItem("bh_global_screening_questions");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    return getStandardGlobalScreeningQuestions();
  });

  const [questionsNotice, setQuestionsNotice] = useState<string>("");

  const handleSaveScreeningQuestions = () => {
    localStorage.setItem("bh_global_screening_questions", JSON.stringify(screeningQuestions));
    setQuestionsNotice(`Saved ${screeningQuestions.length} global candidate screening questions!`);
    setTimeout(() => setQuestionsNotice(""), 3000);
  };

  const handleResetScreeningQuestions = () => {
    const std = getStandardGlobalScreeningQuestions();
    setScreeningQuestions(std);
    localStorage.setItem("bh_global_screening_questions", JSON.stringify(std));
    setQuestionsNotice("Reset to standard candidate screening questions (CTC, Notice, Location, Experience)!");
    setTimeout(() => setQuestionsNotice(""), 3500);
  };

  const handleAddScreeningQuestion = () => {
    const newQ: ScreeningQuestion = {
      id: `q-custom-${Date.now()}`,
      prompt: "New Candidate Question",
      type: "SHORT_ANSWER",
      options: [],
      placeholder: "Enter placeholder text...",
      expectedAnswer: "Candidate response details",
      points: 20,
      category: "General",
      required: true,
    };
    const updated = [...screeningQuestions, newQ];
    setScreeningQuestions(updated);
  };

  const handleDeleteScreeningQuestion = (id: string) => {
    const updated = screeningQuestions.filter((q) => q.id !== id);
    setScreeningQuestions(updated);
  };

  const handleUpdateScreeningQuestion = (id: string, updates: Partial<ScreeningQuestion>) => {
    const updated = screeningQuestions.map((q) => (q.id === id ? { ...q, ...updates } : q));
    setScreeningQuestions(updated);
  };

  const handleUpdateOption = (questionId: string, optionIndex: number, newValue: string) => {
    const updated = screeningQuestions.map((q) => {
      if (q.id === questionId) {
        const nextOpts = [...q.options];
        nextOpts[optionIndex] = newValue;
        return { ...q, options: nextOpts };
      }
      return q;
    });
    setScreeningQuestions(updated);
  };

  const handleAddOption = (questionId: string) => {
    const updated = screeningQuestions.map((q) => {
      if (q.id === questionId) {
        return { ...q, options: [...q.options, `New Option ${q.options.length + 1}`] };
      }
      return q;
    });
    setScreeningQuestions(updated);
  };

  const handleRemoveOption = (questionId: string, optIdx: number) => {
    const updated = screeningQuestions.map((q) => {
      if (q.id === questionId) {
        return { ...q, options: q.options.filter((_, i) => i !== optIdx) };
      }
      return q;
    });
    setScreeningQuestions(updated);
  };

  const totalPoints = screeningQuestions.reduce((sum, q) => sum + (q.points || 0), 0);

  return (
    <div className="space-y-8">
      {/* ── MODULE HEADER ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-soft text-brand">
              <Sparkle size={16} />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-ink">
              Brutally Score™ Module
            </h1>
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            Two-tier configuration: Set role-specific resume & screening score thresholds, and configure universal candidate screening questions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full border border-line bg-canvas px-3 py-1 text-xs font-semibold text-ink-2">
            2 Distinct Sections
          </span>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* SECTION 1: ROLE-SPECIFIC THRESHOLDS (Role Selector & Policy) */}
      {/* ────────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand text-xs font-bold text-brand-fg">
              1
            </span>
            <div>
              <h2 className="text-base font-bold text-ink">
                Role Score Thresholds & Qualification Policy
              </h2>
              <span className="text-[11px] text-ink-muted">
                Select a specific job opening to configure resume and screening pass cutoffs for that role.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {roleNotice && (
              <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                <Check size={13} />
                {roleNotice}
              </span>
            )}
            <Button variant="primary" onClick={handleSaveRoleThresholds} className="text-xs">
              <Check size={14} />
              <span>Save Role Thresholds</span>
            </Button>
          </div>
        </div>

        {/* Job Role Selector Card */}
        <Card className="p-4 sm:p-5 border-brand/20 bg-gradient-to-r from-canvas via-white to-brand/5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <label htmlFor="role-select" className="text-xs font-bold uppercase tracking-wider text-ink-muted block">
                Selected Job Opening
              </label>
              <div className="flex items-center gap-3">
                <select
                  id="role-select"
                  value={selectedJob.id}
                  onChange={(e) => setSelectedJobId(e.target.value)}
                  className="rounded-xl border border-line bg-surface px-3.5 py-2 text-sm font-bold text-ink shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand cursor-pointer min-w-[240px]"
                >
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.title} ({j.department || "Technology"})
                    </option>
                  ))}
                </select>
                <Pill tone={selectedJob.status === "OPEN" ? "teal" : "gray"}>
                  {selectedJob.status}
                </Pill>
              </div>
            </div>

            {/* Role Metadata Badges */}
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="rounded-xl border border-line bg-surface/80 px-3 py-2">
                <span className="text-ink-muted block text-[11px]">Department & Mode</span>
                <span className="font-semibold text-ink">
                  {selectedJob.department || "Technology"} • {selectedJob.workplaceType || "HYBRID"}
                </span>
              </div>
              <div className="rounded-xl border border-line bg-surface/80 px-3 py-2">
                <span className="text-ink-muted block text-[11px]">Work Location</span>
                <span className="font-semibold text-ink">{selectedJob.location || "Remote"}</span>
              </div>
              <div className="rounded-xl border border-line bg-surface/80 px-3 py-2">
                <span className="text-ink-muted block text-[11px]">Pipeline Volume</span>
                <span className="font-bold text-brand">{selectedJob.applicantCount} candidates</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Dual Threshold Sliders for Selected Role */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Threshold 1: Resume Score */}
          <Card className="p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-ink-muted block">
                  BrutalEngine™ Resume Fit Cutoff
                </span>
                <p className="mt-1 text-xs text-ink-muted">
                  Minimum resume match score required for {selectedJob.title} applicants to pass screening.
                </p>
              </div>
              <div className="flex items-center gap-1.5 rounded-xl border border-brand/20 bg-brand/10 px-3 py-1 text-brand font-bold text-lg font-display">
                <span>{resumeThreshold}</span>
                <span className="text-xs text-brand/70 font-sans">/ 100</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-ink-muted">Threshold Strictness:</span>
                <span
                  className={
                    resumeThreshold >= 85
                      ? "text-rose-600 font-bold"
                      : resumeThreshold >= 70
                      ? "text-brand font-bold"
                      : "text-amber-600 font-bold"
                  }
                >
                  {resumeThreshold >= 85
                    ? "Strict (Top 15% Only)"
                    : resumeThreshold >= 70
                    ? "Balanced Benchmark (Recommended)"
                    : "Lenient (High Volume)"}
                </span>
              </div>

              <input
                type="range"
                min="50"
                max="95"
                step="1"
                value={resumeThreshold}
                onChange={(e) => setResumeThreshold(Number(e.target.value))}
                className="w-full accent-brand cursor-pointer"
              />

              <div className="flex justify-between text-[11px] text-ink-muted font-mono">
                <span>50 (Lenient)</span>
                <span>75 (Default)</span>
                <span>95 (Strict)</span>
              </div>
            </div>

            <div className="rounded-xl border border-line-soft bg-canvas/40 p-3 text-xs space-y-1">
              <span className="font-semibold text-ink block">Workflow Impact:</span>
              <p className="text-ink-muted text-[11px] leading-relaxed">
                Candidates scoring <strong>&gt;= {resumeThreshold}</strong> advance to <em>UNDER REVIEW</em> and receive the screening questionnaire with the <strong>{screeningDeadlineDays}-day configurable deadline</strong>.
              </p>
            </div>
          </Card>

          {/* Threshold 2: Screening Test Score */}
          <Card className="p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-ink-muted block">
                  Screening Test Pass Cutoff
                </span>
                <p className="mt-1 text-xs text-ink-muted">
                  Minimum score required on the screening test to qualify candidate for technical interview rounds.
                </p>
              </div>
              <div className="flex items-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50 px-3 py-1 text-teal-800 font-bold text-lg font-display">
                <span>{screeningThreshold}</span>
                <span className="text-xs text-teal-600 font-sans">/ 100</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-ink-muted">Passing Standard:</span>
                <span
                  className={
                    screeningThreshold >= 80
                      ? "text-emerald-700 font-bold"
                      : screeningThreshold >= 65
                      ? "text-teal-700 font-bold"
                      : "text-amber-600 font-bold"
                  }
                >
                  {screeningThreshold >= 80
                    ? "Excellence Tier"
                    : screeningThreshold >= 65
                    ? "Standard Qualification"
                    : "Accessible Passing Bar"}
                </span>
              </div>

              <input
                type="range"
                min="40"
                max="95"
                step="1"
                value={screeningThreshold}
                onChange={(e) => setScreeningThreshold(Number(e.target.value))}
                className="w-full accent-teal-600 cursor-pointer"
              />

              <div className="flex justify-between text-[11px] text-ink-muted font-mono">
                <span>40 (Low Bar)</span>
                <span>70 (Standard)</span>
                <span>95 (Elite Only)</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
              <div className="rounded-xl border border-line-soft bg-canvas/40 p-2.5">
                <span className="text-ink-muted block text-[11px]">Screening Deadline</span>
                <select
                  value={screeningDeadlineDays}
                  onChange={(e) => setScreeningDeadlineDays(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-line bg-surface p-1 text-xs font-semibold text-ink"
                >
                  <option value={1}>1 Day Deadline</option>
                  <option value={2}>2 Days Deadline</option>
                  <option value={3}>3 Days (Diagram 1 Standard)</option>
                  <option value={5}>5 Days</option>
                  <option value={7}>7 Days</option>
                </select>
              </div>

              <div className="rounded-xl border border-line-soft bg-canvas/40 p-2.5 flex items-center justify-between">
                <div>
                  <span className="text-ink-muted block text-[11px]">Auto-Advance</span>
                  <span className="font-semibold text-ink text-xs">Direct to Interview</span>
                </div>
                <input
                  type="checkbox"
                  checked={autoShortlist}
                  onChange={(e) => setAutoShortlist(e.target.checked)}
                  className="h-4 w-4 rounded border-line text-brand focus:ring-brand cursor-pointer"
                />
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────── */}
      {/* SECTION 2: SEPARATE SCREENING TEST QUESTIONS SECTION       */}
      {/* (Universal Candidate Information Questions - Not Role-Bound) */}
      {/* ────────────────────────────────────────────────────────── */}
      <section className="space-y-4 pt-6 border-t-2 border-line">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-teal-600 text-xs font-bold text-white">
                2
              </span>
              <h2 className="text-lg font-bold text-ink">
                Candidate Screening Questions (Separate Section)
              </h2>
              <span className="rounded-full bg-teal-100 text-teal-800 px-2.5 py-0.5 text-xs font-bold">
                Universal Candidate Questionnaire
              </span>
            </div>
            <p className="text-xs text-ink-muted">
              These screening questions collect basic candidate information and eligibility details (e.g. <strong>Current CTC, Expected CTC, Notice Period, Location Comfort, Total Experience</strong>). They apply universally to candidates and can be edited below.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {questionsNotice && (
              <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                <Check size={13} />
                {questionsNotice}
              </span>
            )}
            <Button
              variant="ghost"
              onClick={handleResetScreeningQuestions}
              className="flex items-center gap-1.5 text-xs font-semibold"
              title="Reset to default screening questions list"
            >
              <Sparkle size={13} className="text-brand" />
              <span>Reset to Standard 5 Questions</span>
            </Button>
            <Button
              variant="ghost"
              onClick={handleAddScreeningQuestion}
              className="flex items-center gap-1.5 text-xs font-semibold"
            >
              <Plus size={14} />
              <span>Add Question</span>
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveScreeningQuestions}
              className="flex items-center gap-1.5 text-xs font-bold"
            >
              <Check size={14} />
              <span>Save Screening Questions</span>
            </Button>
          </div>
        </div>

        {/* Screening Questions List */}
        <div className="space-y-4">
          {screeningQuestions.map((q, index) => (
            <Card key={q.id} className="p-4 sm:p-5 border-line hover:border-line-2 transition-all">
              {/* Question Header */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-teal-600 text-xs font-bold text-white">
                    #{index + 1}
                  </span>
                  <select
                    value={q.type}
                    onChange={(e) =>
                      handleUpdateScreeningQuestion(q.id, {
                        type: e.target.value as ScreeningQuestionType,
                        options:
                          e.target.value === "MCQ" && q.options.length === 0
                            ? ["Option 1", "Option 2", "Option 3", "Option 4"]
                            : q.options,
                      })
                    }
                    className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-ink"
                  >
                    <option value="NUMBER">Number / Currency (₹ LPA)</option>
                    <option value="MCQ">Multiple Choice (Dropdown / Radio)</option>
                    <option value="SHORT_ANSWER">Short Text Answer</option>
                    <option value="YES_NO">Yes / No Radio</option>
                  </select>

                  <input
                    type="text"
                    value={q.category || "General"}
                    onChange={(e) => handleUpdateScreeningQuestion(q.id, { category: e.target.value })}
                    placeholder="Category"
                    className="rounded-md border border-line-soft bg-canvas px-2 py-0.5 text-[11px] font-semibold text-ink-2 w-28 focus:border-brand focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1">
                    <span className="text-ink-muted text-[11px]">Weight / Points:</span>
                    <input
                      type="number"
                      min="5"
                      max="100"
                      step="5"
                      value={q.points}
                      onChange={(e) =>
                        handleUpdateScreeningQuestion(q.id, { points: Number(e.target.value) })
                      }
                      className="w-14 rounded-lg border border-line bg-canvas px-2 py-1 text-xs font-bold text-teal-800 text-center"
                    />
                  </div>

                  <label className="flex items-center gap-1 text-[11px] font-semibold text-ink-muted cursor-pointer">
                    <input
                      type="checkbox"
                      checked={q.required ?? true}
                      onChange={(e) =>
                        handleUpdateScreeningQuestion(q.id, { required: e.target.checked })
                      }
                      className="rounded border-line text-brand focus:ring-brand h-3.5 w-3.5"
                    />
                    <span>Required</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => handleDeleteScreeningQuestion(q.id)}
                    className="text-ink-muted hover:text-rose-600 p-1 transition-colors"
                    title="Delete question"
                  >
                    <Trash size={14} />
                  </button>
                </div>
              </div>

              {/* Editable Question Prompt */}
              <div className="mt-3 space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted block">
                  Question Prompt (Directly Editable)
                </label>
                <input
                  type="text"
                  value={q.prompt}
                  onChange={(e) => handleUpdateScreeningQuestion(q.id, { prompt: e.target.value })}
                  placeholder="e.g. Current CTC (₹ LPA)"
                  className="w-full rounded-xl border border-line bg-surface px-3.5 py-2 text-xs font-bold text-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>

              {/* Number / Currency Preview */}
              {q.type === "NUMBER" && (
                <div className="mt-3 space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted block">
                    Candidate Input Format / Placeholder
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={q.placeholder || "e.g. 8.5"}
                      onChange={(e) =>
                        handleUpdateScreeningQuestion(q.id, { placeholder: e.target.value })
                      }
                      placeholder="Placeholder (e.g. 8.5)"
                      className="w-48 rounded-lg border border-line bg-canvas/60 px-3 py-1.5 text-xs text-ink font-mono focus:border-brand focus:outline-none"
                    />
                    <span className="text-xs font-semibold text-ink-muted">₹ Lakhs Per Annum (LPA)</span>
                  </div>
                </div>
              )}

              {/* Short Answer Preview */}
              {q.type === "SHORT_ANSWER" && (
                <div className="mt-3 space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted block">
                    Candidate Placeholder / Expected Input
                  </label>
                  <input
                    type="text"
                    value={q.placeholder || ""}
                    onChange={(e) =>
                      handleUpdateScreeningQuestion(q.id, { placeholder: e.target.value })
                    }
                    placeholder="e.g. 3 years 6 months in relevant software development"
                    className="w-full rounded-lg border border-line bg-canvas/60 px-3 py-1.5 text-xs text-ink focus:border-brand focus:outline-none"
                  />
                </div>
              )}

              {/* Multiple Choice Options Editor */}
              {q.type === "MCQ" && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted block">
                      Options & Preferred Response (Click circle to set preferred answer)
                    </label>
                    <button
                      type="button"
                      onClick={() => handleAddOption(q.id)}
                      className="text-[11px] font-semibold text-brand hover:underline flex items-center gap-1"
                    >
                      <Plus size={11} />
                      <span>Add Option</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {q.options.map((opt, optIdx) => {
                      const isCorrect = q.correctOptionIndex === optIdx;

                      return (
                        <div
                          key={optIdx}
                          className={`flex items-center gap-2 rounded-xl border p-2 text-xs transition-colors ${
                            isCorrect
                              ? "border-emerald-300 bg-emerald-50/70"
                              : "border-line bg-canvas/40 hover:bg-canvas"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateScreeningQuestion(q.id, { correctOptionIndex: optIdx })
                            }
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold transition-all ${
                              isCorrect
                                ? "border-emerald-600 bg-emerald-600 text-white"
                                : "border-line-2 bg-surface text-ink-muted hover:border-brand"
                            }`}
                            title={isCorrect ? "Preferred Option" : "Click to set as preferred"}
                          >
                            {isCorrect ? "✓" : String.fromCharCode(65 + optIdx)}
                          </button>
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => handleUpdateOption(q.id, optIdx, e.target.value)}
                            className="flex-1 bg-transparent text-xs text-ink font-medium focus:outline-none"
                            placeholder={`Option ${String.fromCharCode(65 + optIdx)}`}
                          />
                          {q.options.length > 2 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveOption(q.id, optIdx)}
                              className="text-ink-muted hover:text-rose-600 p-0.5"
                              title="Remove option"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>

        {/* Global Save Footer */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-line bg-surface p-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-ink">
              {screeningQuestions.length} Global Screening Questions Configured
            </span>
            <span className="text-ink-muted">• Asked to all candidates during the screening stage</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={handleResetScreeningQuestions} className="text-xs">
              <Sparkle size={13} className="text-brand" />
              <span>Reset Standard Questions</span>
            </Button>
            <Button variant="primary" onClick={handleSaveScreeningQuestions} className="text-xs">
              <Check size={13} />
              <span>Save Screening Questions</span>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
