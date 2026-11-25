import {
  useInfiniteQuery, useMutation, useQuery, useQueryClient, type QueryClient,
} from "@tanstack/react-query";
import type {
  AcceptOfferInput, ApplicationDraftDto, ApplicationListItem, ApplicationOverview, AssessmentInviteDto, AttemptDto,
  AuthProviderKey, DeclineOfferInput, DraftUpdate, InterviewRoundDto, JobPublic, JoinTokenDto, LinkIntentDto, NotificationDto,
  OfferDto, OnboardingDto, Paginated, ProctoringEventsInput, ProfileDto, ProfileInput, ResumeSummary, SessionUser,
  SubmitApplicationInput, TenantPublic,
} from "@verity/shared";
import { api, tp } from "@/lib/api";

export const qk = {
  me: ["me"] as const,
  providers: ["providers"] as const,
  tenant: (s: string) => ["tenant", s] as const,
  job: (s: string, ref: string) => ["job", s, ref] as const,
  profile: (s: string) => ["profile", s] as const,
  apps: (s: string) => ["apps", s] as const,
  overview: (s: string, id: string) => ["overview", s, id] as const,
  draft: (s: string, id: string) => ["draft", s, id] as const,
  assessments: (s: string, appId: string) => ["assessments", s, appId] as const,
  assessment: (s: string, id: string) => ["assessment", s, id] as const,
  interviews: (s: string, appId: string) => ["interviews", s, appId] as const,
  interview: (s: string, id: string) => ["interview", s, id] as const,
  offer: (s: string, appId: string) => ["offer", s, appId] as const,
  onboarding: (s: string, appId: string) => ["onboarding", s, appId] as const,
  notifications: (s: string) => ["notifications", s] as const,
  intent: (id: string) => ["intent", id] as const,
};

/** Refresh everything that depends on an application's state. */
export function invalidateApplication(qc: QueryClient, slug: string, appId?: string) {
  void qc.invalidateQueries({ queryKey: qk.apps(slug) });
  void qc.invalidateQueries({ queryKey: qk.notifications(slug) });
  if (appId) {
    for (const key of [qk.overview(slug, appId), qk.assessments(slug, appId), qk.interviews(slug, appId), qk.offer(slug, appId), qk.onboarding(slug, appId), qk.draft(slug, appId)]) {
      void qc.invalidateQueries({ queryKey: key });
    }
    void qc.invalidateQueries({ queryKey: ["interview", slug] });
    void qc.invalidateQueries({ queryKey: ["assessment", slug] });
  }
}

// ── Session & auth ─────────────────────────

export const useMe = () =>
  useQuery({ queryKey: qk.me, queryFn: () => api<{ user: SessionUser | null }>("/auth/me").then((r) => r.user), staleTime: 5 * 60_000 });

export const useProviders = () =>
  useQuery({ queryKey: qk.providers, queryFn: () => api<{ providers: AuthProviderKey[] }>("/auth/providers").then((r) => r.providers), staleTime: Infinity });

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>("/auth/logout", { method: "POST" }),
    onSuccess: () => qc.clear(),
  });
}

export const useRequestCode = () =>
  useMutation({ mutationFn: (v: { email: string; tenant?: string }) => api<{ ok: true }>("/auth/email/request", { json: v }) });

export function useVerifyCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { email: string; code: string; intentId?: string }) =>
      api<{ ok: true; returnTo: string | null }>("/auth/email/verify", { json: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.me }),
  });
}

export type IntentDto = LinkIntentDto & { kind: "LINK_EXISTING" | "VERIFY_EMAIL"; returnTo: string; tenantSlug: string | null };
export const useIntent = (id: string) => useQuery({ queryKey: qk.intent(id), queryFn: () => api<IntentDto>(`/auth/intents/${id}`), retry: false });
export const useConfirmIntent = (id: string) =>
  useMutation({ mutationFn: () => api<{ ok: true; returnTo: string }>(`/auth/intents/${id}/confirm`, { method: "POST" }) });

export function useUnlink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (provider: AuthProviderKey) => api<void>(`/auth/identities/${provider.toLowerCase()}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.me }),
  });
}

// ── Tenant & job ─────────────────────────

export const useTenant = (slug: string) =>
  useQuery({ queryKey: qk.tenant(slug), queryFn: () => api<TenantPublic>(tp(slug)), enabled: Boolean(slug), staleTime: 5 * 60_000, retry: false });

export const useJob = (slug: string, ref: string) =>
  useQuery({
    queryKey: qk.job(slug, ref),
    queryFn: () => api<JobPublic>(tp(slug, `/jobs/${encodeURIComponent(ref)}`)),
    enabled: Boolean(slug && ref),
    retry: false,
  });

// ── Profile ─────────────────────────

export interface ProfileResumeDto {
  id: string;
  name: string;
  sizeBytes: number;
  mimeType: string;
  createdAt: string;
  url: string;
}

export const useProfile = (slug: string) =>
  useQuery({
    queryKey: qk.profile(slug),
    queryFn: () =>
      api<{
        profile: ProfileDto | null;
        email: string;
        displayName: string | null;
        latestResume?: ProfileResumeDto | null;
      }>(tp(slug, "/profile")),
    enabled: Boolean(slug),
  });

export function useSaveProfile(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: ProfileInput) => api<{ profile: ProfileDto }>(tp(slug, "/profile"), { method: "PUT", json: v }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.profile(slug) });
      void qc.invalidateQueries({ queryKey: qk.me });
      void qc.invalidateQueries({ queryKey: ["draft", slug] });
    },
  });
}

// ── Applications ─────────────────────────

export const useStartApplication = (slug: string) =>
  useMutation({
    mutationFn: (jobRef: string) =>
      api<{ id: string; stage: string }>(tp(slug, `/jobs/${encodeURIComponent(jobRef)}/applications`), { method: "POST" }),
  });

export const useApplications = (slug: string) =>
  useQuery({
    queryKey: qk.apps(slug),
    queryFn: () => api<{ items: ApplicationListItem[] }>(tp(slug, "/applications")).then((r) => r.items),
    enabled: Boolean(slug),
  });

export const useOverview = (slug: string, id: string) =>
  useQuery({
    queryKey: qk.overview(slug, id),
    queryFn: () => api<ApplicationOverview>(tp(slug, `/applications/${id}`)),
    enabled: Boolean(slug && id),
  });

export const useDraft = (slug: string, id: string) =>
  useQuery({
    queryKey: qk.draft(slug, id),
    queryFn: () => api<ApplicationDraftDto>(tp(slug, `/applications/${id}/draft`)),
    enabled: Boolean(slug && id),
    retry: false,
    refetchInterval: (q) => (q.state.data?.resumeReadStatus === "READING" ? 2500 : false),
  });

function useDraftMutation<V>(slug: string, id: string, fn: (v: V) => Promise<ApplicationDraftDto>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: (d) => qc.setQueryData(qk.draft(slug, id), d) });
}

export const useUpdateDraft = (slug: string, id: string) =>
  useDraftMutation<DraftUpdate>(slug, id, (v) => api(tp(slug, `/applications/${id}/draft`), { method: "PATCH", json: v }));

export const useUploadResume = (slug: string, id: string) =>
  useDraftMutation<File>(slug, id, (file) => {
    const form = new FormData();
    form.set("file", file);
    return api(tp(slug, `/applications/${id}/resume`), { form });
  });

export const useSaveResumeSummary = (slug: string, id: string) =>
  useDraftMutation<ResumeSummary>(slug, id, (v) => api(tp(slug, `/applications/${id}/resume-summary`), { method: "PUT", json: v }));

export const useUploadCoverLetter = (slug: string, id: string) =>
  useDraftMutation<File>(slug, id, (file) => {
    const form = new FormData();
    form.set("file", file);
    return api(tp(slug, `/applications/${id}/cover-letter`), { form });
  });

export const useRemoveCoverLetter = (slug: string, id: string) =>
  useDraftMutation<void>(slug, id, () => api(tp(slug, `/applications/${id}/cover-letter`), { method: "DELETE" }));

export function useSubmitApplication(slug: string, id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: SubmitApplicationInput) => api<ApplicationOverview>(tp(slug, `/applications/${id}/submit`), { json: v }),
    onSuccess: (o) => {
      qc.setQueryData(qk.overview(slug, id), o);
      qc.removeQueries({ queryKey: qk.draft(slug, id) });
      void qc.invalidateQueries({ queryKey: qk.apps(slug) });
    },
  });
}

export function useWithdraw(slug: string, id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<ApplicationOverview>(tp(slug, `/applications/${id}/withdraw`), { method: "POST" }),
    onSuccess: (o) => {
      qc.setQueryData(qk.overview(slug, id), o);
      invalidateApplication(qc, slug, id);
    },
  });
}

// ── Assessments ─────────────────────────

export const useAssessments = (slug: string, appId: string, enabled = true) =>
  useQuery({
    queryKey: qk.assessments(slug, appId),
    enabled,
    queryFn: () => api<{ items: AssessmentInviteDto[] }>(tp(slug, `/applications/${appId}/assessments`)).then((r) => r.items),
  });

export const useAssessment = (slug: string, id: string) =>
  useQuery({ queryKey: qk.assessment(slug, id), queryFn: () => api<AssessmentInviteDto>(tp(slug, `/assessments/${id}`)) });

export const useStartAttempt = (slug: string, inviteId: string) =>
  useMutation({ mutationFn: () => api<AttemptDto>(tp(slug, `/assessments/${inviteId}/start`), { method: "POST" }) });

export const saveAnswers = (slug: string, attemptId: string, answers: Record<string, number[] | string>) =>
  api<void>(tp(slug, `/attempts/${attemptId}/answers`), { method: "PUT", json: { answers } });

export const sendProctoringEvents = (slug: string, attemptId: string, events: ProctoringEventsInput["events"]) =>
  api<void>(tp(slug, `/attempts/${attemptId}/proctoring-events`), { json: { events } });

export const uploadRecordingChunk = (slug: string, attemptId: string, kind: "camera" | "screen", seq: number, blob: Blob) =>
  api<void>(tp(slug, `/attempts/${attemptId}/recordings/${kind}/${seq}`), { method: "POST", body: blob, contentType: "video/webm" });

export const useSubmitAttempt = (slug: string, attemptId: string) =>
  useMutation({ mutationFn: () => api<{ ok: true }>(tp(slug, `/attempts/${attemptId}/submit`), { method: "POST" }) });

// ── Interviews ─────────────────────────

export const useInterviews = (slug: string, appId: string) =>
  useQuery({
    queryKey: qk.interviews(slug, appId),
    queryFn: () => api<{ items: InterviewRoundDto[] }>(tp(slug, `/applications/${appId}/interviews`)).then((r) => r.items),
    enabled: Boolean(slug && appId),
  });

export const useInterview = (slug: string, id: string) =>
  useQuery({
    queryKey: qk.interview(slug, id),
    queryFn: () => api<InterviewRoundDto>(tp(slug, `/interviews/${id}`)),
    enabled: Boolean(slug && id),
    refetchInterval: 60_000,
  });

export function useBookSlot(slug: string, roundId: string, appId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slotId: string) => api<InterviewRoundDto>(tp(slug, `/interviews/${roundId}/book`), { json: { slotId } }),
    onSuccess: (r) => {
      qc.setQueryData(qk.interview(slug, roundId), r);
      invalidateApplication(qc, slug, appId);
    },
  });
}

export const useRescheduleRequest = (slug: string, roundId: string) =>
  useMutation({ mutationFn: (message: string) => api<{ ok: true }>(tp(slug, `/interviews/${roundId}/reschedule-request`), { json: { message } }) });

export const fetchJoinToken = (slug: string, roundId: string) =>
  api<JoinTokenDto>(tp(slug, `/interviews/${roundId}/join-token`), { method: "POST" });

// ── Offer & onboarding ─────────────────────────

export const useOffer = (slug: string, appId: string) =>
  useQuery({
    queryKey: qk.offer(slug, appId),
    queryFn: () => api<OfferDto>(tp(slug, `/applications/${appId}/offer`)),
    enabled: Boolean(slug && appId),
    retry: false,
  });

export function useAcceptOffer(slug: string, appId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: AcceptOfferInput) => api<{ ok: true }>(tp(slug, `/applications/${appId}/offer/accept`), { json: v }),
    onSuccess: () => invalidateApplication(qc, slug, appId),
  });
}

export function useDeclineOffer(slug: string, appId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: DeclineOfferInput) => api<{ ok: true }>(tp(slug, `/applications/${appId}/offer/decline`), { json: v }),
    onSuccess: () => invalidateApplication(qc, slug, appId),
  });
}

export const useOnboarding = (slug: string, appId: string) =>
  useQuery({
    queryKey: qk.onboarding(slug, appId),
    queryFn: () => api<OnboardingDto>(tp(slug, `/applications/${appId}/onboarding`)),
    enabled: Boolean(slug && appId),
    retry: false,
  });

export function useUploadOnboardingFile(slug: string, appId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, file }: { taskId: string; file: File }) => {
      const form = new FormData();
      form.set("file", file);
      return api<{ ok: true }>(tp(slug, `/onboarding-tasks/${taskId}/file`), { form });
    },
    onSuccess: () => invalidateApplication(qc, slug, appId),
  });
}

// ── Notifications ─────────────────────────

type NotificationPage = Paginated<NotificationDto> & { unread: number };

export const useNotifications = (slug: string, enabled = true) =>
  useInfiniteQuery({
    queryKey: qk.notifications(slug),
    enabled: Boolean(slug && enabled),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      api<NotificationPage>(tp(slug, `/notifications${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ""}`)),
    getNextPageParam: (last) => last.nextCursor,
  });

export function useMarkRead(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(tp(slug, `/notifications/${id}/read`), { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.notifications(slug) }),
  });
}

export function useMarkAllRead(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(tp(slug, "/notifications/read-all"), { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.notifications(slug) }),
  });
}
