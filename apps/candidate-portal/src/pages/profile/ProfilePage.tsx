import { zodResolver } from "@hookform/resolvers/zod";
import { profileSchema, type AuthProviderKey, type ProfileInput } from "@verity/shared";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { useMe, useProfile, useProviders, useSaveProfile, useUnlink } from "@/api/hooks";
import { ProfileFields } from "@/pages/apply/DetailsStep";
import { useTenantCtx } from "@/components/layout/TenantContext";
import { useToast } from "@/components/layout/Toasts";
import { Button, ButtonAnchor } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Card";
import { ErrorState, InlineError, Modal, PageLoader } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/form";
import { Check, Download, Eye, File, Plus, ProviderLogo, Shield, Trash } from "@/components/ui/icons";
import { Avatar } from "@/components/ui/misc";
import { ResumeDocViewer } from "@/components/common/ResumeDocViewer";
import { oidcStartUrl } from "@/lib/api";

interface EducationEntry {
  id: string;
  degree: string;
  fieldOfStudy: string;
  institution: string;
  duration: string;
  score: string;
  location: string;
}

const DEFAULT_EDUCATION: EducationEntry[] = [
  {
    id: "edu-1",
    degree: "Bachelor of Engineering (B.E. / B.Tech)",
    fieldOfStudy: "Computer Science & Engineering (Data Science)",
    institution: "Avanthi Institute of Engineering and Technology (AIET)",
    duration: "June 2021 – May 2025",
    score: "7.89 / 10 CGPA",
    location: "Visakhapatnam, Andhra Pradesh",
  },
  {
    id: "edu-2",
    degree: "Class 12th – State Board (Intermediate)",
    fieldOfStudy: "MPC (Mathematics, Physics, Chemistry)",
    institution: "NRI Junior College",
    duration: "June 2019 – March 2021",
    score: "7.60 / 10 CGPA",
    location: "Visakhapatnam, Andhra Pradesh",
  },
  {
    id: "edu-3",
    degree: "Class 10th – Secondary Education (CBSE)",
    fieldOfStudy: "General Secondary Education",
    institution: "Centurion Public School",
    duration: "June 2018 – March 2019",
    score: "7.77 / 10 CGPA",
    location: "Andhra Pradesh",
  },
];

function AcademicCap({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c3 3 9 3 12 0v-5" />
    </svg>
  );
}

function Pencil({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

function downloadFile(url: string, filename: string) {
  if (url.startsWith("data:")) {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return;
  }
  fetch(url)
    .then((res) => res.blob())
    .then((blob) => {
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    })
    .catch(() => {
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });
}

export function ProfilePage() {
  const tenant = useTenantCtx();
  const { t } = useTranslation();
  const loc = useLocation();
  const me = useMe();
  const providers = useProviders();
  const profile = useProfile(tenant.slug);
  const save = useSaveProfile(tenant.slug);
  const unlink = useUnlink();
  const toast = useToast();
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [viewResumeOpen, setViewResumeOpen] = useState(false);

  const [educationList, setEducationList] = useState<EducationEntry[]>(() => {
    try {
      const saved = localStorage.getItem("bh_profile_education");
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_EDUCATION;
  });

  const [editingEdu, setEditingEdu] = useState<EducationEntry | null>(null);
  const [isAddingEdu, setIsAddingEdu] = useState(false);
  const [eduDegree, setEduDegree] = useState("");
  const [eduField, setEduField] = useState("");
  const [eduInst, setEduInst] = useState("");
  const [eduDuration, setEduDuration] = useState("");
  const [eduScore, setEduScore] = useState("");
  const [eduLoc, setEduLoc] = useState("");

  const handleOpenEditEdu = (edu: EducationEntry) => {
    setIsAddingEdu(false);
    setEditingEdu(edu);
    setEduDegree(edu.degree);
    setEduField(edu.fieldOfStudy);
    setEduInst(edu.institution);
    setEduDuration(edu.duration);
    setEduScore(edu.score);
    setEduLoc(edu.location);
  };

  const handleOpenAddEdu = () => {
    setIsAddingEdu(true);
    setEditingEdu({
      id: `edu-${Date.now()}`,
      degree: "",
      fieldOfStudy: "",
      institution: "",
      duration: "",
      score: "",
      location: "",
    });
    setEduDegree("");
    setEduField("");
    setEduInst("");
    setEduDuration("");
    setEduScore("");
    setEduLoc("");
  };

  const handleSaveEdu = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEdu) return;
    if (!eduDegree.trim() || !eduInst.trim()) return;

    let updated: EducationEntry[];
    if (isAddingEdu) {
      const newEntry: EducationEntry = {
        id: editingEdu.id || `edu-${Date.now()}`,
        degree: eduDegree.trim(),
        fieldOfStudy: eduField.trim(),
        institution: eduInst.trim(),
        duration: eduDuration.trim(),
        score: eduScore.trim(),
        location: eduLoc.trim(),
      };
      updated = [...educationList, newEntry];
    } else {
      updated = educationList.map((item) =>
        item.id === editingEdu.id
          ? {
              ...item,
              degree: eduDegree.trim(),
              fieldOfStudy: eduField.trim(),
              institution: eduInst.trim(),
              duration: eduDuration.trim(),
              score: eduScore.trim(),
              location: eduLoc.trim(),
            }
          : item
      );
    }

    setEducationList(updated);
    localStorage.setItem("bh_profile_education", JSON.stringify(updated));
    setEditingEdu(null);
    setIsAddingEdu(false);
    toast(isAddingEdu ? "Qualification added successfully" : "Educational details updated successfully");
  };

  const handleDeleteEdu = (id: string) => {
    const updated = educationList.filter((item) => item.id !== id);
    setEducationList(updated);
    localStorage.setItem("bh_profile_education", JSON.stringify(updated));
    setEditingEdu(null);
    setIsAddingEdu(false);
    toast("Qualification removed");
  };

  // Determine latest uploaded candidate resume for the signed-in user
  const latestResume = (() => {
    const userEmail = me.data?.email?.toLowerCase();
    const apiResume = profile.data?.latestResume;

    if (apiResume?.name && apiResume?.url) {
      return {
        filename: apiResume.name,
        url: apiResume.url,
        uploadedAt: "Verified Candidate Attachment (PDF)",
      };
    }

    try {
      const stored = localStorage.getItem("bh_last_uploaded_resume");
      if (stored) {
        const parsed = JSON.parse(stored);
        const matchesUser = parsed.email
          ? !userEmail || parsed.email.toLowerCase() === userEmail
          : parsed.filename !== "Amirti_Tanuja_Round2_Task.pdf";
        if (parsed.url && parsed.filename && matchesUser) {
          return {
            filename: parsed.filename as string,
            url: parsed.url as string,
            uploadedAt: (parsed.uploadedAt as string) || "Verified Candidate Attachment (PDF)",
          };
        }
      }
    } catch {}

    try {
      const savedApps = localStorage.getItem("bh_admin_applications");
      if (savedApps) {
        const apps = JSON.parse(savedApps) as Array<{
          email?: string;
          resumeName?: string;
          resumeDataUrl?: string;
        }>;
        const match = apps.find(
          (a) =>
            a.resumeName &&
            (!userEmail || a.email?.toLowerCase() === userEmail)
        );
        if (match?.resumeName) {
          return {
            filename: match.resumeName,
            url: match.resumeDataUrl || "",
            uploadedAt: "Verified Candidate Attachment (PDF)",
          };
        }
      }
    } catch {}

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("bh_draft_")) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed.resume?.name) {
              return {
                filename: parsed.resume.name as string,
                url: (parsed.resumeDataUrl as string) || "",
                uploadedAt: "Verified Candidate Attachment (PDF)",
              };
            }
          }
        }
      }
    } catch {}

    return null;
  })();

  const form = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
  });

  useEffect(() => {
    const p = profile.data?.profile;
    if (p) {
      form.reset({
        firstName: p.firstName,
        lastName: p.lastName,
        phone: p.phone ?? "",
        city: p.city ?? "",
        experience: p.experience ?? undefined,
        noticePeriod: p.noticePeriod ?? undefined,
      });
    }
  }, [profile.data, form]);

  if (profile.isPending || me.isPending) return <PageLoader />;
  if (profile.isError) return <ErrorState error={profile.error} />;
  const linked = new Set(me.data?.identities.map((i) => i.provider));

  // Determine candidate display name dynamically for initials & header
  const watchedFirst = form.watch("firstName");
  const watchedLast = form.watch("lastName");
  const candidateName =
    [watchedFirst, watchedLast].filter(Boolean).join(" ") ||
    [profile.data?.profile?.firstName, profile.data?.profile?.lastName].filter(Boolean).join(" ") ||
    profile.data?.displayName ||
    me.data?.displayName ||
    me.data?.email;

  const onSubmit = async (data: ProfileInput) => {
    try {
      await save.mutateAsync({
        ...data,
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        city: data.city.trim(),
      });
      setSaveSuccess(true);
      toast("Profile updated successfully");
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch {
      // InlineError component handles save.error
    }
  };

  return (
    <>
      {/* Profile Header with Dynamic User Avatar */}
      <div className="card flex items-center gap-5 p-6 md:p-7">
        <Avatar name={candidateName} size={64} />
        <div className="flex flex-col min-w-0">
          <h1 className="font-display text-2xl font-bold text-ink truncate leading-tight">
            {candidateName || "Candidate"}
          </h1>
          <p className="text-sm text-ink-muted truncate mt-0.5">
            {me.data?.email}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-6">
        {/* Left Column: Personal details -> Educational details -> Latest uploaded resume */}
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-6">
          {/* 1. Personal Details */}
          <form className="card flex flex-col gap-5 md:p-8" noValidate onSubmit={form.handleSubmit(onSubmit)}>
            <div className="flex items-center justify-between">
              <h2 className="text-[19px]">{t("profile.personal")}</h2>
              {saveSuccess && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ok-ink bg-ok-soft px-2.5 py-1 rounded-full">
                  <Check size={14} /> Profile saved
                </span>
              )}
            </div>
            <Field label={t("profile.email")} htmlFor="pemail">
              <div className="relative">
                <Input id="pemail" value={me.data?.email ?? ""} readOnly />
                {me.data?.emailVerified && (
                  <Pill tone="teal" dot className="absolute right-3 top-3">
                    {t("common.verified")}
                  </Pill>
                )}
              </div>
            </Field>
            <ProfileFields form={form} />
            <InlineError error={save.error} />
            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" loading={save.isPending} disabled={save.isPending}>
                {t("profile.save")}
              </Button>
              {saveSuccess && !form.formState.isDirty && (
                <span className="text-[13px] text-ok-ink" role="status">
                  {t("profile.saved")}
                </span>
              )}
            </div>
          </form>

          {/* 2. Educational Details */}
          <section className="card flex flex-col gap-5 md:p-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <AcademicCap size={22} className="text-forest" />
                <h2 className="text-[19px] font-semibold text-ink">Educational details</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenAddEdu}
                  className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2.5 py-1 text-xs font-semibold text-brand hover:bg-canvas transition-colors shadow-xs cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Add Qualification</span>
                </button>
                <Pill tone="teal" dot>
                  Verified
                </Pill>
              </div>
            </div>

            <div className="flex flex-col gap-3.5">
              {educationList.map((edu) => (
                <div
                  key={edu.id}
                  className="group relative flex flex-col gap-2 rounded-xl border border-line-soft bg-canvas/40 p-4 transition-colors hover:border-line hover:bg-canvas/80"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-semibold text-ink">{edu.degree}</h3>
                      <p className="text-sm font-medium text-forest">{edu.fieldOfStudy}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {edu.score && (
                        <span className="inline-flex items-center rounded-full bg-forest-subtle px-3 py-1 text-xs font-semibold text-forest">
                          {edu.score}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleOpenEditEdu(edu)}
                        className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2.5 py-1 text-xs font-semibold text-ink-2 hover:border-brand hover:text-brand hover:bg-canvas transition-colors shadow-xs cursor-pointer"
                        title="Edit this qualification"
                      >
                        <Pencil size={12} />
                        <span>Edit</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-y-1 text-xs text-ink-muted pt-1 border-t border-line-soft/60">
                    <span className="font-medium text-ink-2">{edu.institution}</span>
                    <div className="flex items-center gap-3">
                      {edu.location && <span>{edu.location}</span>}
                      <span>•</span>
                      <span className="font-medium text-ink">{edu.duration}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 3. Latest Uploaded Resume */}
          <section className="card flex flex-col gap-5 md:p-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <File size={22} className="text-forest" />
                <h2 className="text-[19px] font-semibold text-ink">Latest uploaded resume</h2>
              </div>
              {latestResume ? (
                <Pill tone="teal" dot>
                  Active Resume
                </Pill>
              ) : (
                <Pill tone="gray">No Resume</Pill>
              )}
            </div>

            <p className="text-xs text-ink-muted -mt-2">
              This resume is currently attached to your profile and submitted applications.
            </p>

            {latestResume ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-line-soft bg-canvas/50 p-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-500 border border-red-100 shadow-xs">
                    <File size={22} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold text-ink truncate" title={latestResume.filename}>
                      {latestResume.filename}
                    </span>
                    <span className="text-xs text-ink-muted truncate">
                      {latestResume.uploadedAt}
                    </span>
                  </div>
                </div>

                {latestResume.url && (
                  <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => setViewResumeOpen(true)}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2"
                    >
                      <Eye size={15} />
                      <span>View</span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => downloadFile(latestResume.url, latestResume.filename)}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2"
                    >
                      <Download size={15} />
                      <span>Download</span>
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-line-2 bg-canvas/30 p-5 text-center text-xs text-ink-muted">
                No resume uploaded yet. Upload your resume when applying for a position and it will appear here.
              </div>
            )}
          </section>
        </div>

        <aside className="flex min-w-0 flex-[1_1_340px] flex-col gap-5">
          <section className="card flex flex-col gap-1">
            <h2 className="text-[19px]">{t("profile.signIn")}</h2>
            <p className="mb-2 text-[13px] text-ink-muted">{t("profile.signInBody")}</p>
            {(providers.data ?? []).map((p: AuthProviderKey) => (
              <div key={p} className="flex flex-wrap items-center gap-3 border-t border-line-soft py-3.5">
                <ProviderLogo provider={p} />
                <span className="flex-1 text-sm font-semibold">{t(`providers.${p}`)}</span>
                {linked.has(p) ? (
                  <>
                    <Pill tone="teal">{t("profile.linked")}</Pill>
                    {linked.size > 1 && <Button variant="text" loading={unlink.isPending} onClick={() => unlink.mutate(p)}>{t("profile.unlink")}</Button>}
                  </>
                ) : p !== "EMAIL" ? (
                  <ButtonAnchor href={oidcStartUrl(p, loc.pathname, true)} variant="ghost">{t("profile.link")}</ButtonAnchor>
                ) : null}
              </div>
            ))}
            <InlineError error={unlink.error} />
          </section>
          <div className="flex items-start gap-3 rounded-2xl border border-[#DCE5FF] bg-[#F5F8FF] p-4">
            <Shield size={20} className="mt-0.5 shrink-0 text-info-ink" />
            <p className="text-[13px] leading-relaxed text-ink-2">{t("apply.privacy")}</p>
          </div>
        </aside>
      </div>

      {/* Modal: View Candidate Resume */}
      {latestResume && latestResume.url && (
        <Modal
          open={viewResumeOpen}
          onClose={() => setViewResumeOpen(false)}
          title={latestResume.filename}
          subtitle="Uploaded Candidate Resume Preview"
          maxWidth="max-w-4xl"
        >
          <div className="space-y-4">
            <ResumeDocViewer
              url={latestResume.url}
              filename={latestResume.filename}
              className="w-full h-[72vh] min-h-[550px]"
            />

            <div className="flex items-center justify-between border-t border-line pt-3">
              <Button
                type="button"
                variant="primary"
                onClick={() => downloadFile(latestResume.url, latestResume.filename)}
                className="text-xs font-semibold flex items-center gap-1.5"
              >
                <Download size={14} />
                <span>Download Resume</span>
              </Button>

              <Button type="button" variant="ghost" onClick={() => setViewResumeOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Edit / Add Educational Qualification */}
      <Modal
        open={Boolean(editingEdu)}
        onClose={() => {
          setEditingEdu(null);
          setIsAddingEdu(false);
        }}
        title={isAddingEdu ? "Add Educational Qualification" : "Edit Educational Qualification"}
        subtitle="Update your degree, institution, duration and academic score"
        maxWidth="max-w-lg"
      >
        {editingEdu && (
          <form onSubmit={handleSaveEdu} className="space-y-4">
            <Field label="Degree / Qualification">
              <Input
                placeholder="e.g. Bachelor of Engineering (B.E. / B.Tech)"
                value={eduDegree}
                onChange={(e) => setEduDegree(e.target.value)}
                required
              />
            </Field>

            <Field label="Field of Study / Specialization">
              <Input
                placeholder="e.g. Computer Science & Engineering (Data Science)"
                value={eduField}
                onChange={(e) => setEduField(e.target.value)}
                required
              />
            </Field>

            <Field label="Institution / College / School">
              <Input
                placeholder="e.g. Avanthi Institute of Engineering and Technology (AIET)"
                value={eduInst}
                onChange={(e) => setEduInst(e.target.value)}
                required
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Duration / Dates">
                <Input
                  placeholder="e.g. June 2021 – May 2025"
                  value={eduDuration}
                  onChange={(e) => setEduDuration(e.target.value)}
                  required
                />
              </Field>
              <Field label="Score / CGPA / Grade">
                <Input
                  placeholder="e.g. 7.89 / 10 CGPA"
                  value={eduScore}
                  onChange={(e) => setEduScore(e.target.value)}
                  required
                />
              </Field>
            </div>

            <Field label="Location">
              <Input
                placeholder="e.g. Visakhapatnam, Andhra Pradesh"
                value={eduLoc}
                onChange={(e) => setEduLoc(e.target.value)}
              />
            </Field>

            <div className="flex items-center justify-between border-t border-line pt-3">
              {!isAddingEdu ? (
                <button
                  type="button"
                  onClick={() => handleDeleteEdu(editingEdu.id)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                >
                  <Trash size={13} />
                  <span>Remove</span>
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setEditingEdu(null);
                    setIsAddingEdu(false);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  {isAddingEdu ? "Add Qualification" : "Save Changes"}
                </Button>
              </div>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
