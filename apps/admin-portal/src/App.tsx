import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { TenantProvider } from "@/components/layout/TenantContext";
import { ApplicationsPage } from "@/pages/ApplicationsPage";
import { AssessmentsPage } from "@/pages/AssessmentsPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { JobsPage } from "@/pages/JobsPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { StaffPage } from "@/pages/StaffPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function TenantRoutes() {
  const { tenant } = useParams();
  return (
    <TenantProvider>
      <Routes>
        <Route element={<AdminLayout />}>
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="admin" element={<Navigate to="dashboard" replace />} />
          <Route path="candidates" element={<ApplicationsPage />} />
          <Route path="applications" element={<ApplicationsPage />} />
          <Route path="jobs" element={<JobsPage />} />
          <Route path="assessments" element={<AssessmentsPage />} />
          <Route path="staff" element={<StaffPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Route>
      </Routes>
    </TenantProvider>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/admin" element={<Navigate to="/brutallyhired/dashboard" replace />} />
          <Route path="/:tenant/*" element={<TenantRoutes />} />
          <Route path="/" element={<Navigate to="/brutallyhired/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/brutallyhired/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
