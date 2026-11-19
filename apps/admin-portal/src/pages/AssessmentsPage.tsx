import { useState } from "react";
import { useTenant } from "@/components/layout/TenantContext";
import { Button } from "@/components/ui/Button";
import { Card, Pill, SectionTitle } from "@/components/ui/Card";
import { Clock, Plus, Shield, Sparkle } from "@/components/ui/icons";

interface TemplateItem {
  id: string;
  title: string;
  durationMinutes: number;
  passScore: number;
  questionsCount: number;
  proctoringEnabled: boolean;
}

const TEMPLATES: TemplateItem[] = [
  {
    id: "tpl-1",
    title: "Senior Full-Stack & Architecture Challenge",
    durationMinutes: 60,
    passScore: 70,
    questionsCount: 15,
    proctoringEnabled: true,
  },
  {
    id: "tpl-2",
    title: "System Design & Distributed Data Quiz",
    durationMinutes: 45,
    passScore: 65,
    questionsCount: 10,
    proctoringEnabled: true,
  },
  {
    id: "tpl-3",
    title: "AI & Product Reasoning Assessment",
    durationMinutes: 40,
    passScore: 75,
    questionsCount: 12,
    proctoringEnabled: false,
  },
];

export function AssessmentsPage() {
  const { tenant } = useTenant();

  return (
    <div className="page space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink md:text-3xl">
            Assessment Templates & Proctoring
          </h1>
          <p className="text-sm text-ink-muted">
            Configure automated technical tests, time limits, and camera/screen proctoring rules.
          </p>
        </div>

        <Button icon={<Plus size={18} />}>
          New Assessment Template
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {TEMPLATES.map((tpl) => (
          <Card key={tpl.id} className="space-y-4">
            <div className="flex items-start justify-between gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
                <Shield size={20} />
              </span>
              {tpl.proctoringEnabled ? (
                <Pill tone="teal" dot>
                  Proctoring Active
                </Pill>
              ) : (
                <Pill tone="gray">Standard Quiz</Pill>
              )}
            </div>

            <div>
              <h3 className="text-base font-bold text-ink">{tpl.title}</h3>
              <p className="mt-1 text-xs text-ink-muted">
                {tpl.questionsCount} questions • Passing mark: {tpl.passScore}%
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs text-ink-2 border-t border-line pt-3">
              <span className="flex items-center gap-1.5">
                <Clock size={14} className="text-ink-muted" />
                {tpl.durationMinutes} mins
              </span>
              <span className="flex items-center gap-1.5">
                <Sparkle size={14} className="text-brand" />
                Auto-scoring
              </span>
            </div>
          </Card>
        ))}
      </div>

      {/* Proctoring Signals & Audit Card */}
      <Card className="space-y-4">
        <SectionTitle subtitle="Review candidate environment signals recorded during assessment attempts">
          Proctoring Signals & Security Audit
        </SectionTitle>

        <div className="rounded-xl border border-line bg-canvas p-4 text-xs text-ink-2 space-y-2">
          <div className="flex items-center justify-between font-semibold text-ink border-b border-line pb-2">
            <span>Signal Type</span>
            <span>Policy</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span>Webcam & Environment Feed</span>
            <span className="text-ok font-semibold">Periodic chunk capture (25MB max)</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span>Tab switches / Window Blur</span>
            <span className="text-warn font-semibold">Logged as timeline incident</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span>Clipboard Copy / Paste</span>
            <span className="text-danger font-semibold">Flagged for human reviewer</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
