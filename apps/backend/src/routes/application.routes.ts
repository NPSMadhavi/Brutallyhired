import { Router } from "express";
import * as c from "../controllers/application.controller.js";
import { requireUser, requireVerifiedUser } from "../middlewares/auth.middleware.js";
import { resumeUpload } from "../middlewares/upload.middleware.js";

/** Apply flow (draft → submit), overview and withdrawal. */
export const applicationRoutes = Router({ mergeParams: true });
applicationRoutes.use(requireUser);

applicationRoutes.post("/jobs/:ref/applications", requireVerifiedUser, c.startApplication);
applicationRoutes.get("/applications", c.listApplications);
applicationRoutes.get("/applications/:id", c.getOverview);
applicationRoutes.get("/applications/:id/draft", c.getDraft);
applicationRoutes.patch("/applications/:id/draft", c.updateDraft);
applicationRoutes.post("/applications/:id/resume", resumeUpload.single("file"), c.uploadResume);
applicationRoutes.put("/applications/:id/resume-summary", c.saveResumeSummary);
applicationRoutes.post("/applications/:id/cover-letter", resumeUpload.single("file"), c.uploadCoverLetter);
applicationRoutes.delete("/applications/:id/cover-letter", c.removeCoverLetter);
applicationRoutes.post("/applications/:id/submit", requireVerifiedUser, c.submitApplication);
applicationRoutes.post("/applications/:id/withdraw", c.withdrawApplication);
