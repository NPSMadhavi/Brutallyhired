import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, tp } from "@/lib/api";
import {
  MOCK_APPLICATIONS,
  MOCK_INTERVIEWS,
  MOCK_JOBS,
  MOCK_STAFF,
  type AdminApplication,
  type AdminInterview,
  type AdminJob,
  type AdminStaff,
} from "./mockData";

export function useAdminJobs(slug: string) {
  return useQuery<{ items: AdminJob[] }>({
    queryKey: ["admin", slug, "jobs"],
    queryFn: async () => {
      try {
        const res = await api<{ items: AdminJob[] }>(tp(slug, "/admin/jobs"));
        if (res && res.items && res.items.length > 0) return res;
      } catch {
        // Fallback to mock data if unauthenticated or empty database
      }
      return { items: MOCK_JOBS };
    },
  });
}

export function useAdminApplications(slug: string, stage?: string) {
  return useQuery<{ items: AdminApplication[] }>({
    queryKey: ["admin", slug, "applications", stage],
    queryFn: async () => {
      try {
        const query = stage ? `?stage=${stage}` : "";
        const res = await api<{ items: AdminApplication[] }>(tp(slug, `/admin/applications${query}`));
        if (res && res.items && res.items.length > 0) return res;
      } catch {
        // Fallback to mock data
      }
      if (stage && stage !== "ALL") {
        return { items: MOCK_APPLICATIONS.filter((a) => a.stage === stage) };
      }
      return { items: MOCK_APPLICATIONS };
    },
  });
}

export function useAdminInterviews(slug: string) {
  return useQuery<{ items: AdminInterview[] }>({
    queryKey: ["admin", slug, "interviews"],
    queryFn: async () => {
      return { items: MOCK_INTERVIEWS };
    },
  });
}

export function useAdminStaff(slug: string) {
  return useQuery<{ items: AdminStaff[] }>({
    queryKey: ["admin", slug, "staff"],
    queryFn: async () => {
      try {
        const res = await api<{ items: AdminStaff[] }>(tp(slug, "/admin/staff"));
        if (res && res.items && res.items.length > 0) return res;
      } catch {
        // Fallback to mock data
      }
      return { items: MOCK_STAFF };
    },
  });
}

export function useChangeApplicationStage(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, stage, note }: { id: string; stage: string; note?: string }) => {
      try {
        return await api(tp(slug, `/admin/applications/${id}/stage`), {
          json: { stage, note },
        });
      } catch {
        // Simulated local update if backend isn't authenticated yet
        const app = MOCK_APPLICATIONS.find((a) => a.id === id);
        if (app) app.stage = stage;
        return app;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", slug, "applications"] });
    },
  });
}

export function useCreateJob(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (jobData: Partial<AdminJob>) => {
      try {
        return await api(tp(slug, "/admin/jobs"), { json: jobData });
      } catch {
        const newJob: AdminJob = {
          id: `job-${Date.now()}`,
          externalRef: jobData.title?.toLowerCase().replace(/\s+/g, "-") || "job-ref",
          title: jobData.title || "Untitled Role",
          department: jobData.department || "General",
          location: jobData.location || "Remote",
          workplaceType: jobData.workplaceType || "REMOTE",
          status: "OPEN",
          description: jobData.description || "",
          updatedAt: new Date().toISOString(),
          _count: { applications: 0 },
        };
        MOCK_JOBS.unshift(newJob);
        return newJob;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", slug, "jobs"] });
    },
  });
}
