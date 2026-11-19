import { useState } from "react";
import { useTenant } from "@/components/layout/TenantContext";
import { Button } from "@/components/ui/Button";
import { Card, SectionTitle } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/form";
import { Check, Settings, Sparkle } from "@/components/ui/icons";
import { applyBrand } from "@/lib/brand";

export function SettingsPage() {
  const { tenant } = useTenant();
  const [name, setName] = useState(tenant.name);
  const [brandColor, setBrandColor] = useState(tenant.brandColor || "#094c3c");
  const [careersUrl, setCareersUrl] = useState(tenant.careersUrl || "");
  const [supportEmail, setSupportEmail] = useState(tenant.supportEmail || "hr@brutallyhired.com");
  const [threshold, setThreshold] = useState(tenant.eligibilityThreshold || 60);
  const [timezone, setTimezone] = useState(tenant.timezone || "Asia/Kolkata");
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    applyBrand(brandColor);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="page space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink md:text-3xl">
          Organization & Scoring Settings
        </h1>
        <p className="text-sm text-ink-muted">
          Configure branding, AI scoring cutoff threshold, and careers site integration for{" "}
          <span className="font-semibold text-ink-2">{tenant.name}</span>.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6 max-w-3xl">
        <Card className="space-y-4">
          <SectionTitle subtitle="Basic details displayed on the candidate portal and email invites">
            Company Profile & Branding
          </SectionTitle>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Company Name" htmlFor="set-name">
              <Input
                id="set-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </Field>

            <Field label="Organization Slug" htmlFor="set-slug" hint="Used in all URLs e.g. /brutallyhired/apply">
              <Input id="set-slug" value={tenant.slug} readOnly />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Brand Accent Color (HEX)" htmlFor="set-color" hint="Defines button and accent theme">
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="h-10 w-12 cursor-pointer rounded-lg border border-line bg-white p-1"
                />
                <Input
                  id="set-color"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
            </Field>

            <Field label="Default Timezone" htmlFor="set-tz">
              <Select id="set-tz" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                <option value="UTC">UTC</option>
                <option value="America/New_York">America/New_York (EST)</option>
                <option value="Europe/London">Europe/London (GMT)</option>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Careers Site URL" htmlFor="set-careers">
              <Input
                id="set-careers"
                placeholder="https://company.com/careers"
                value={careersUrl}
                onChange={(e) => setCareersUrl(e.target.value)}
              />
            </Field>

            <Field label="Support Email" htmlFor="set-email">
              <Input
                id="set-email"
                type="email"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
              />
            </Field>
          </div>
        </Card>

        {/* AI Scoring Rubric & Threshold */}
        <Card className="space-y-4">
          <SectionTitle subtitle="Scoring policy enforced by the automated evaluation pipeline">
            AI Screening & Eligibility Bar
          </SectionTitle>

          <Field
            label={`Eligibility Threshold Score: ${threshold} points`}
            htmlFor="set-threshold"
            hint="Applications scoring below this cutoff are never rejected automatically; they trigger a human eligibility review flag on the recruiter dashboard."
          >
            <input
              id="set-threshold"
              type="range"
              min={30}
              max={90}
              step={5}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-full accent-[rgb(var(--brand))] cursor-pointer py-2"
            />
          </Field>
        </Card>

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit">Save Changes</Button>
          {saved && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-ok">
              <Check size={16} /> Saved successfully!
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
