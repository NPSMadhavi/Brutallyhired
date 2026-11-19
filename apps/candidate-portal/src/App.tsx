import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { TenantLayout } from "@/components/layout/TenantContext";
import { PageLoader } from "@/components/ui/feedback";
import { ApplicationsListPage } from "@/pages/applications/ApplicationsListPage";
import { OverviewPage } from "@/pages/applications/OverviewPage";
import { ApplyEntry } from "@/pages/apply/ApplyEntry";
import { ApplyLayout } from "@/pages/apply/ApplyLayout";
import { DetailsStep } from "@/pages/apply/DetailsStep";
import { QuestionsStep } from "@/pages/apply/QuestionsStep";
import { ResumeStep } from "@/pages/apply/ResumeStep";
import { ReviewStep } from "@/pages/apply/ReviewStep";
import { SubmittedPage } from "@/pages/apply/SubmittedPage";
import { AssessmentPage } from "@/pages/assessment/AssessmentPage";
import { AssessmentsPage } from "@/pages/assessment/AssessmentsPage";
import { AuthErrorPage } from "@/pages/auth/AuthErrorPage";
import { LinkAccountPage } from "@/pages/auth/LinkAccountPage";
import { SignInPage } from "@/pages/auth/SignInPage";
import { VerifyEmailPage } from "@/pages/auth/VerifyEmailPage";
import { InterviewPage } from "@/pages/interviews/InterviewPage";
import { InterviewsPage } from "@/pages/interviews/InterviewsPage";
import { NotificationsPage } from "@/pages/notifications/NotificationsPage";
import { OfferPage } from "@/pages/offer/OfferPage";
import { OnboardingPage } from "@/pages/onboarding/OnboardingPage";
import { ProfilePage } from "@/pages/profile/ProfilePage";
import { NotFoundPage } from "@/pages/RootPages";

// The video room pulls in LiveKit; load it only when someone joins.
const JoinPage = lazy(() => import("@/pages/interviews/JoinPage").then((m) => ({ default: m.JoinPage })));

const router = createBrowserRouter([
  { path: "/", element: <SignInPage /> },
  { path: "/signin", element: <SignInPage /> },
  { path: "/auth/error", element: <AuthErrorPage /> },
  { path: "/auth/link/:intentId", element: <LinkAccountPage /> },
  { path: "/auth/verify-email/:intentId", element: <VerifyEmailPage /> },
  {
    path: "/:tenant",
    element: <TenantLayout />,
    children: [
      { index: true, element: <Navigate to="applications" replace /> },
      { path: "signin", element: <SignInPage /> },
      { path: "apply/:jobRef", element: <ApplyEntry /> },
      {
        element: <RequireAuth />,
        children: [
          {
            path: "applications/:appId/apply",
            element: <ApplyLayout />,
            children: [
              { index: true, element: <Navigate to="details" replace /> },
              { path: "details", element: <DetailsStep /> },
              { path: "resume", element: <ResumeStep /> },
              { path: "questions", element: <QuestionsStep /> },
              { path: "review", element: <ReviewStep /> },
            ],
          },
          { path: "applications/:appId/submitted", element: <SubmittedPage /> },
          {
            element: <PortalLayout />,
            children: [
              { path: "applications", element: <ApplicationsListPage /> },
              { path: "applications/:appId", element: <OverviewPage /> },
              { path: "applications/:appId/assessments", element: <AssessmentsPage /> },
              { path: "applications/:appId/assessments/:inviteId", element: <AssessmentPage /> },
              { path: "applications/:appId/interviews", element: <InterviewsPage /> },
              { path: "applications/:appId/interviews/:roundId", element: <InterviewPage /> },
              {
                path: "applications/:appId/interviews/:roundId/join",
                element: (
                  <Suspense fallback={<PageLoader />}>
                    <JoinPage />
                  </Suspense>
                ),
              },
              { path: "applications/:appId/offer", element: <OfferPage /> },
              { path: "applications/:appId/onboarding", element: <OnboardingPage /> },
              { path: "notifications", element: <NotificationsPage /> },
              { path: "profile", element: <ProfilePage /> },
              { path: "*", element: <NotFoundPage /> },
            ],
          },
        ],
      },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
