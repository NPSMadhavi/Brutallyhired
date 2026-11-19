import { Router } from "express";
import * as c from "../controllers/admin.controller.js";
import { requireUser } from "../middlewares/auth.middleware.js";
import { adminOnly, recruiterOnly, requireStaff } from "../middlewares/tenant.middleware.js";
import { documentUpload } from "../middlewares/upload.middleware.js";

/** Hiring-team API (staff only). Exposes internal data. */
export const adminRoutes = Router({ mergeParams: true });
adminRoutes.use(requireUser, requireStaff());

adminRoutes.get("/settings", adminOnly, c.getSettings);
adminRoutes.put("/settings", adminOnly, c.updateSettings);
adminRoutes.get("/staff", adminOnly, c.listStaff);
adminRoutes.post("/staff", adminOnly, c.inviteStaff);
adminRoutes.get("/jobs", c.listJobs);
adminRoutes.get("/jobs/:id", c.getJob);
adminRoutes.post("/jobs", recruiterOnly, c.createJob);
adminRoutes.put("/jobs/:id", recruiterOnly, c.updateJob);
adminRoutes.get("/applications", c.listApplications);
adminRoutes.get("/applications/:id", c.getApplication);
adminRoutes.post("/applications/:id/stage", recruiterOnly, c.changeApplicationStage);
adminRoutes.post("/applications/:id/recruiter", recruiterOnly, c.assignRecruiter);
adminRoutes.post("/applications/:id/eligibility-override", recruiterOnly, c.overrideEligibility);
adminRoutes.post("/applications/:id/rescore", recruiterOnly, c.rescoreApplication);
adminRoutes.get("/assessment-templates", c.listAssessmentTemplates);
adminRoutes.post("/assessment-templates", recruiterOnly, c.createAssessmentTemplate);
adminRoutes.post("/applications/:id/assessment-invites", recruiterOnly, c.inviteToAssessment);
adminRoutes.get("/attempts/:id/proctoring", recruiterOnly, c.getProctoringReview);
adminRoutes.post("/applications/:id/interviews", recruiterOnly, c.createInterviewRound);
adminRoutes.post("/interviews/:id/complete", c.completeInterview);
adminRoutes.post("/interviews/:id/cancel", recruiterOnly, c.cancelInterview);
adminRoutes.post("/interviews/:id/join-token", c.createStaffJoinToken);
adminRoutes.put("/applications/:id/offer", recruiterOnly, c.upsertOffer);
adminRoutes.post("/applications/:id/offer/letter", recruiterOnly, documentUpload.single("file"), c.uploadOfferLetter);
adminRoutes.post("/applications/:id/offer/withdraw", recruiterOnly, c.withdrawOffer);
adminRoutes.put("/onboarding-template", adminOnly, c.saveOnboardingTemplate);
adminRoutes.post("/onboarding-tasks/:id/review", recruiterOnly, c.reviewOnboardingDocument);
adminRoutes.put("/applications/:id/joining-details", recruiterOnly, c.saveJoiningDetails);
adminRoutes.post("/applications/:id/hire", recruiterOnly, c.markHired);
