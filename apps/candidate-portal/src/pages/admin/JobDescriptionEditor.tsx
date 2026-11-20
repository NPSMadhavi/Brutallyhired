import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Arrow,
  Check,
  ChevronLeft,
  Eye,
  Globe,
  Sparkle,
  X,
} from "@/components/ui/icons";
import { Modal } from "@/components/ui/feedback";

export interface JobDescriptionEditorProps {
  jobTitle: string;
  department: string;
  location: string;
  experience: string;
  workplaceType: "REMOTE" | "HYBRID" | "ONSITE";
  keywords: string;
  publishedChannels: string[];
  initialHtml: string;
  onSaveDraft: (finalHtml: string) => Promise<void> | void;
  onPublish: (finalHtml: string, channels: string[]) => Promise<void> | void;
  onRegenerate: () => string;
  onBack: () => void;
}

export function JobDescriptionEditor({
  jobTitle,
  department,
  location,
  experience,
  workplaceType,
  keywords,
  publishedChannels,
  initialHtml,
  onSaveDraft,
  onPublish,
  onRegenerate,
  onBack,
}: JobDescriptionEditorProps) {
  const [mode, setMode] = useState<"EDIT" | "PREVIEW">("EDIT");
  const [contentHtml, setContentHtml] = useState(initialHtml);
  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"SAVED" | "SAVING" | "UNSAVED">("SAVED");
  const [lastSaved, setLastSaved] = useState<Date | null>(new Date());
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const [unsavedPromptOpen, setUnsavedPromptOpen] = useState(false);
  const [channels, setChannels] = useState<string[]>(
    publishedChannels.length > 0 ? publishedChannels : ["Brutallyhired Portal", "LinkedIn", "Indeed"]
  );
  const [regenerateConfirmOpen, setRegenerateConfirmOpen] = useState(false);

  const editorRef = useRef<HTMLDivElement>(null);

  // Sync initial content
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== contentHtml) {
      editorRef.current.innerHTML = contentHtml;
    }
  }, [contentHtml]);

  // Handle direct contentEditable input
  const handleEditorInput = () => {
    if (editorRef.current) {
      setContentHtml(editorRef.current.innerHTML);
      setIsDirty(true);
      setSaveStatus("UNSAVED");
    }
  };

  // Execute formatting command
  const format = (cmd: string, value: string | undefined = undefined) => {
    document.execCommand(cmd, false, value);
    if (editorRef.current) {
      editorRef.current.focus();
      handleEditorInput();
    }
  };

  // Insert structured section shortcut
  const insertSection = (headingText: string, defaultBodyHtml: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    const sectionHtml = `\n<h2>${headingText}</h2>\n${defaultBodyHtml}\n`;
    document.execCommand("insertHTML", false, sectionHtml);
    handleEditorInput();
  };

  // Save Draft
  const handleSave = async () => {
    setSaveStatus("SAVING");
    try {
      await onSaveDraft(contentHtml);
      setIsDirty(false);
      setSaveStatus("SAVED");
      setLastSaved(new Date());
    } catch {
      setSaveStatus("UNSAVED");
    }
  };

  // Safe Back Navigation
  const handleAttemptBack = () => {
    if (isDirty) {
      setUnsavedPromptOpen(true);
    } else {
      onBack();
    }
  };

  // Confirm Publish
  const handleConfirmPublish = async () => {
    setPublishConfirmOpen(false);
    await onPublish(contentHtml, channels);
  };

  // Calculate approximate word count
  const wordCount = contentHtml.replace(/<[^>]+>/g, " ").trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#F3F5F8] text-ink overflow-hidden animate-fadeIn">
      {/* ── STICKY TOP ACTION BAR ─────────────────────────────────────── */}
      <header className="sticky top-0 z-30 flex min-h-[64px] flex-wrap items-center justify-between gap-3 border-b border-line bg-white px-4 md:px-8 py-2.5 shadow-xs">
        {/* Left: Back & Breadcrumb */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleAttemptBack}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-line text-ink-2 hover:bg-canvas hover:text-ink transition-colors"
            title="Back to Requisition Details"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="flex flex-col">
            <div className="flex items-center gap-2 text-xs text-ink-muted">
              <span>Requisitions</span>
              <span>/</span>
              <span className="font-semibold text-ink truncate max-w-[200px] sm:max-w-xs">{jobTitle || "New Opening"}</span>
              <span>/</span>
              <span className="text-teal-700 font-medium">Job Description Preview & Editor</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="font-display text-sm font-bold text-ink truncate max-w-sm">
                {jobTitle || "Untitled Requisition"}
              </span>
              <span className="text-[11px] text-ink-muted hidden sm:inline">
                ({wordCount} words)
              </span>
            </div>
          </div>
        </div>

        {/* Center: Save status indicator */}
        <div className="hidden lg:flex items-center gap-2 text-xs font-medium">
          {saveStatus === "SAVED" ? (
            <span className="inline-flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              <Check size={13} />
              <span>All changes saved to database</span>
              {lastSaved && (
                <span className="text-[10px] text-emerald-600 opacity-80">
                  ({lastSaved.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})
                </span>
              )}
            </span>
          ) : saveStatus === "SAVING" ? (
            <span className="inline-flex items-center gap-1.5 text-brand bg-brand/5 px-2.5 py-1 rounded-full border border-brand/20">
              <span className="h-2 w-2 rounded-full bg-brand animate-ping" />
              <span>Saving draft...</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <span>Unsaved edits</span>
            </span>
          )}
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2.5">
          {/* Mode Switcher Pill */}
          <div className="flex rounded-xl bg-slate-100 p-0.5 border border-line">
            <button
              type="button"
              onClick={() => setMode("EDIT")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                mode === "EDIT"
                  ? "bg-white text-teal-800 shadow-xs"
                  : "text-ink-muted hover:text-ink"
              }`}
              title="Edit JD directly with inline rich-text editor"
            >
              <span>✏️</span>
              <span>Edit Mode</span>
            </button>
            <button
              type="button"
              onClick={() => setMode("PREVIEW")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                mode === "PREVIEW"
                  ? "bg-white text-teal-800 shadow-xs"
                  : "text-ink-muted hover:text-ink"
              }`}
              title="Preview candidate-facing view"
            >
              <Eye size={14} />
              <span>Candidate Preview</span>
            </button>
          </div>

          {/* Regenerate with AI button */}
          <button
            type="button"
            onClick={() => setRegenerateConfirmOpen(true)}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-line-2 bg-white px-3 py-1.5 text-xs font-bold text-ink-2 hover:border-brand hover:text-brand hover:bg-brand/5 transition-all"
            title="Re-run AI draft generation"
          >
            <Sparkle size={14} />
            <span>Regenerate</span>
          </button>

          {/* Save Draft button */}
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saveStatus === "SAVING"}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-bold text-ink hover:bg-slate-50 transition-all disabled:opacity-50"
          >
            <span>💾</span>
            <span>Save Draft</span>
          </button>

          {/* Publish Opening (Primary CTA) */}
          <button
            type="button"
            onClick={() => setPublishConfirmOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold px-4 py-1.5 text-xs shadow-sm hover:shadow transition-all"
          >
            <span>Publish Opening</span>
            <Arrow size={14} />
          </button>
        </div>
      </header>

      {/* ── WYSIWYG FORMATTING TOOLBAR (ACTIVE IN EDIT MODE) ─────────── */}
      {mode === "EDIT" ? (
        <div className="sticky top-[64px] z-20 flex flex-wrap items-center justify-between gap-2 border-b border-line bg-white/95 px-4 md:px-8 py-2 backdrop-blur shadow-xs text-xs">
          {/* Text Style Controls */}
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted mr-1">Format:</span>

            {/* Block Type Dropdown */}
            <select
              onChange={(e) => {
                if (e.target.value) {
                  format("formatBlock", e.target.value);
                  e.target.value = "";
                }
              }}
              defaultValue=""
              className="h-8 rounded-lg border border-line bg-canvas px-2 text-xs font-semibold text-ink focus:border-brand focus:outline-none"
            >
              <option value="" disabled>Heading / Style</option>
              <option value="<h2>">Section Title (H2)</option>
              <option value="<h3>">Subsection (H3)</option>
              <option value="<p>">Normal Paragraph</option>
            </select>

            <span className="h-4 w-px bg-line mx-1" />

            {/* Bold / Italic / Underline / Strike */}
            <button
              type="button"
              onClick={() => format("bold")}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-transparent font-bold text-ink hover:border-line hover:bg-canvas transition-colors"
              title="Bold (Ctrl+B)"
            >
              B
            </button>
            <button
              type="button"
              onClick={() => format("italic")}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-transparent italic font-serif text-ink hover:border-line hover:bg-canvas transition-colors"
              title="Italic (Ctrl+I)"
            >
              I
            </button>
            <button
              type="button"
              onClick={() => format("underline")}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-transparent underline text-ink hover:border-line hover:bg-canvas transition-colors"
              title="Underline (Ctrl+U)"
            >
              U
            </button>
            <button
              type="button"
              onClick={() => format("strikeThrough")}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-transparent line-through text-ink hover:border-line hover:bg-canvas transition-colors"
              title="Strikethrough"
            >
              S
            </button>

            <span className="h-4 w-px bg-line mx-1" />

            {/* Lists */}
            <button
              type="button"
              onClick={() => format("insertUnorderedList")}
              className="flex h-8 items-center gap-1.5 px-2 rounded-lg border border-transparent text-ink hover:border-line hover:bg-canvas transition-colors"
              title="Bullet List"
            >
              <span>• List</span>
            </button>
            <button
              type="button"
              onClick={() => format("insertOrderedList")}
              className="flex h-8 items-center gap-1.5 px-2 rounded-lg border border-transparent text-ink hover:border-line hover:bg-canvas transition-colors"
              title="Numbered List"
            >
              <span>1. List</span>
            </button>

            <span className="h-4 w-px bg-line mx-1" />

            <button
              type="button"
              onClick={() => format("removeFormat")}
              className="flex h-8 items-center px-2 rounded-lg border border-transparent text-ink-muted hover:border-line hover:bg-canvas hover:text-ink transition-colors"
              title="Clear Formatting"
            >
              Clear Format
            </button>
          </div>

          {/* Quick Insert Section Shortcuts */}
          <div className="flex flex-wrap items-center gap-1 text-[11px]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted mr-1">+ Add Section:</span>
            <button
              type="button"
              onClick={() =>
                insertSection(
                  "Key Responsibilities",
                  "<ul>\n  <li>Drive end-to-end delivery of high-impact engineering workflows.</li>\n  <li>Collaborate with product and cross-functional teams to align on deliverables.</li>\n</ul>"
                )
              }
              className="rounded-md border border-line-soft bg-canvas px-2 py-1 text-ink-2 hover:border-brand hover:text-brand transition-colors"
            >
              Responsibilities
            </button>
            <button
              type="button"
              onClick={() =>
                insertSection(
                  "Required Skills & Core Competencies",
                  "<ul>\n  <li>Hands-on expertise in domain frameworks, clean code architecture, and testing.</li>\n  <li>Strong communication and technical leadership skills.</li>\n</ul>"
                )
              }
              className="rounded-md border border-line-soft bg-canvas px-2 py-1 text-ink-2 hover:border-brand hover:text-brand transition-colors"
            >
              Skills
            </button>
            <button
              type="button"
              onClick={() =>
                insertSection(
                  "Work Arrangement, Benefits & Perks",
                  "<ul>\n  <li>Competitive base compensation with performance incentives and equity.</li>\n  <li>Comprehensive health coverage, learning allowance, and flexible hours.</li>\n</ul>"
                )
              }
              className="rounded-md border border-line-soft bg-canvas px-2 py-1 text-ink-2 hover:border-brand hover:text-brand transition-colors"
            >
              Benefits
            </button>
          </div>
        </div>
      ) : (
        /* Preview Banner */
        <div className="sticky top-[64px] z-20 flex items-center justify-between border-b border-teal-200 bg-teal-50 px-4 md:px-8 py-2 text-xs text-teal-900 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-700 text-white font-bold text-[10px]">
              👁️
            </span>
            <span>
              <strong>Candidate View Mode:</strong> This is the exact layout applicants will see when viewing and applying to this job.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setMode("EDIT")}
            className="font-bold underline hover:text-teal-950"
          >
            Switch to Edit Mode →
          </button>
        </div>
      )}

      {/* ── WORKSPACE SCROLL CONTAINER ─────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto px-4 py-8 md:px-8 md:py-10">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Metadata Card at top of Document */}
          <div className="rounded-2xl border border-line bg-white p-6 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft pb-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700">
                  {department || "Engineering"} Requisition
                </span>
                <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight text-ink mt-0.5">
                  {jobTitle || "Job Title Not Set"}
                </h1>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 border border-teal-200 px-3 py-1 text-xs font-bold text-teal-800">
                <span className="h-2 w-2 rounded-full bg-teal-500 animate-pulse" />
                <span>Ready to Publish</span>
              </span>
            </div>

            {/* Badges Bar */}
            <div className="flex flex-wrap items-center gap-2.5 text-xs text-ink-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 border border-slate-200 px-2.5 py-1 font-medium">
                🏢 {department || "Technology"}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 border border-slate-200 px-2.5 py-1 font-medium">
                📍 {location || "Flexible / Remote"}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 border border-slate-200 px-2.5 py-1 font-medium">
                💼 {workplaceType === "REMOTE" ? "Fully Remote" : workplaceType === "HYBRID" ? "Hybrid" : "On-site"}
              </span>
              {experience && (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 border border-slate-200 px-2.5 py-1 font-medium">
                  ⏳ {experience}
                </span>
              )}
              {keywords && (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-teal-50/70 border border-teal-200 px-2.5 py-1 font-medium text-teal-800">
                  🏷️ {keywords}
                </span>
              )}
            </div>

            {/* Target Publishing Platforms */}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-line-soft text-xs">
              <span className="text-[11px] font-semibold text-ink-muted">Publishing to:</span>
              {channels.map((ch) => (
                <span key={ch} className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                  <Globe size={11} />
                  <span>{ch}</span>
                </span>
              ))}
            </div>
          </div>

          {/* DOCUMENT PAPER CANVAS (WYSIWYG INLINE EDITABLE) */}
          <div className="relative rounded-2xl border border-line bg-white p-8 md:p-14 shadow-sm transition-all">
            {mode === "EDIT" && (
              <div className="mb-6 flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600">
                <span className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-800">💡 Inline WYSIWYG Mode:</span>
                  <span>Click directly into any section below to edit text, rewrite bullets, or format headers.</span>
                </span>
                <span className="text-[11px] text-teal-700 font-semibold hidden md:inline">
                  Autosaving enabled
                </span>
              </div>
            )}

            {/* Direct ContentEditable Document Body */}
            <div
              ref={editorRef}
              contentEditable={mode === "EDIT"}
              suppressContentEditableWarning
              onInput={handleEditorInput}
              className={`prose prose-slate max-w-none focus:outline-none transition-all leading-relaxed ${
                mode === "EDIT"
                  ? "cursor-text focus:ring-1 focus:ring-teal-500/20 rounded-lg p-2 -m-2 min-h-[400px]"
                  : "cursor-default"
              } [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-ink [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:border-b [&_h2]:border-line-soft [&_h2]:pb-2 [&_h3]:font-display [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-ink [&_h3]:mt-6 [&_h3]:mb-2 [&_p]:text-sm [&_p]:text-ink-2 [&_p]:leading-relaxed [&_p]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_ul]:text-sm [&_ul]:text-ink-2 [&_ul]:mb-6 [&_li]:leading-relaxed [&_strong]:text-ink [&_strong]:font-semibold`}
            />

            {/* Candidate CTA Preview in Preview Mode */}
            {mode === "PREVIEW" && (
              <div className="mt-12 rounded-2xl border border-teal-200 bg-teal-50/60 p-6 text-center space-y-3">
                <h3 className="font-display text-lg font-bold text-teal-950">
                  Ready to make an impact as {jobTitle}?
                </h3>
                <p className="text-xs text-teal-800 max-w-md mx-auto">
                  Submit your resume and contact information in under 5 minutes to begin the objective evaluation journey.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    disabled
                    className="rounded-xl bg-teal-700 text-white font-bold px-6 py-2.5 text-sm shadow-sm cursor-not-allowed opacity-90 inline-flex items-center gap-2"
                  >
                    <span>Apply for this Position</span>
                    <Arrow size={16} />
                  </button>
                  <p className="text-[11px] text-teal-700/80 mt-1">
                    (Candidate Portal apply button preview)
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── MODAL: CONFIRM PUBLISH ────────────────────────────────────── */}
      <Modal
        open={publishConfirmOpen}
        onClose={() => setPublishConfirmOpen(false)}
        title="Confirm Job Opening Publication"
        subtitle="Review the final requisition parameters and selected target platforms before publishing."
      >
        <div className="space-y-4 text-sm">
          <div className="rounded-xl border border-line bg-slate-50 p-4 space-y-2.5">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700">Requisition Title</span>
                <p className="font-bold text-base text-ink">{jobTitle}</p>
              </div>
              <span className="rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-2.5 py-0.5 font-bold">
                {workplaceType}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-line-soft">
              <div>
                <span className="text-ink-muted">Department:</span> <strong className="text-ink">{department}</strong>
              </div>
              <div>
                <span className="text-ink-muted">Location:</span> <strong className="text-ink">{location}</strong>
              </div>
              <div>
                <span className="text-ink-muted">Experience:</span> <strong className="text-ink">{experience || "Flexible"}</strong>
              </div>
              <div>
                <span className="text-ink-muted">JD Word Count:</span> <strong className="text-ink">{wordCount} words</strong>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-muted block">
              Confirm Publishing Platforms
            </label>
            <div className="flex flex-wrap gap-2 text-xs">
              {["Brutallyhired Portal", "LinkedIn", "Indeed", "Glassdoor"].map((channel) => {
                const checked = channels.includes(channel);
                return (
                  <button
                    key={channel}
                    type="button"
                    onClick={() => {
                      if (checked) {
                        setChannels(channels.filter((c) => c !== channel));
                      } else {
                        setChannels([...channels, channel]);
                      }
                    }}
                    className={`rounded-lg px-3 py-1.5 font-semibold transition-all flex items-center gap-1.5 ${
                      checked
                        ? "bg-teal-700 text-white shadow-xs"
                        : "border border-line bg-white text-ink-muted hover:text-ink"
                    }`}
                  >
                    <span>{checked ? "✓" : "+"}</span>
                    <span>{channel}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-ink-muted">
              Once published, candidates will be able to apply immediately via the public careers link.
            </p>
          </div>

          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <button
              type="button"
              onClick={() => setPublishConfirmOpen(false)}
              className="rounded-xl border border-line bg-white px-4 py-2 text-xs font-bold text-ink-2 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleConfirmPublish()}
              className="rounded-xl bg-teal-700 hover:bg-teal-800 text-white px-5 py-2 text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
            >
              <span>Confirm & Publish Opening</span>
              <Check size={14} />
            </button>
          </div>
        </div>
      </Modal>

      {/* ── MODAL: UNSAVED CHANGES PROMPT ─────────────────────────────── */}
      <Modal
        open={unsavedPromptOpen}
        onClose={() => setUnsavedPromptOpen(false)}
        title="Unsaved Changes Detected"
        subtitle="You have made edits to the Job Description that have not yet been saved as a draft."
      >
        <div className="space-y-4 text-sm">
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900">
            <Alert size={18} className="shrink-0 text-amber-700 mt-0.5" />
            <p>
              Would you like to save your latest Job Description edits before returning to the requisition form?
            </p>
          </div>
          <div className="flex justify-end gap-2 border-t border-line pt-3">
            <button
              type="button"
              onClick={() => setUnsavedPromptOpen(false)}
              className="rounded-xl border border-line bg-white px-4 py-2 text-xs font-bold text-ink-2 hover:bg-slate-50"
            >
              Keep Editing
            </button>
            <button
              type="button"
              onClick={() => {
                setUnsavedPromptOpen(false);
                setIsDirty(false);
                onBack();
              }}
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100"
            >
              Discard Changes
            </button>
            <button
              type="button"
              onClick={async () => {
                await handleSave();
                setUnsavedPromptOpen(false);
                onBack();
              }}
              className="rounded-xl bg-teal-700 text-white px-4 py-2 text-xs font-bold hover:bg-teal-800 shadow-sm"
            >
              Save Draft & Exit
            </button>
          </div>
        </div>
      </Modal>

      {/* ── MODAL: REGENERATE CONFIRMATION ─────────────────────────────── */}
      <Modal
        open={regenerateConfirmOpen}
        onClose={() => setRegenerateConfirmOpen(false)}
        title="Regenerate Job Description with AI?"
        subtitle="This will synthesize a fresh JD using your role title, department, location, and keywords."
      >
        <div className="space-y-4 text-sm">
          <p className="text-xs text-ink-2">
            Are you sure you want to re-run AI generation? Any manual edits you made will be replaced by the newly synthesized description.
          </p>
          <div className="flex justify-end gap-2 border-t border-line pt-3">
            <button
              type="button"
              onClick={() => setRegenerateConfirmOpen(false)}
              className="rounded-xl border border-line bg-white px-4 py-2 text-xs font-bold text-ink-2 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                const freshHtml = onRegenerate();
                setContentHtml(freshHtml);
                setIsDirty(true);
                setSaveStatus("UNSAVED");
                setRegenerateConfirmOpen(false);
              }}
              className="rounded-xl bg-brand text-brand-fg px-4 py-2 text-xs font-bold shadow-sm hover:opacity-90 flex items-center gap-1.5"
            >
              <Sparkle size={14} />
              <span>Regenerate Now</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
