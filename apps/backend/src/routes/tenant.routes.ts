import { Router } from "express";
import * as c from "../controllers/tenant.controller.js";

/** Public company branding and open jobs. */
export const tenantRoutes = Router({ mergeParams: true });

tenantRoutes.get("/", c.getTenant);
tenantRoutes.get("/jobs/:ref", c.getJob);
tenantRoutes.get("/jobs-draft", c.getJobDraft);
tenantRoutes.post("/jobs-draft", c.saveJobDraft);
tenantRoutes.post("/jobs-publish", c.publishJobDirect);
tenantRoutes.post("/notifications/send-email", c.sendNotificationEmail);
tenantRoutes.post("/ai-generate-assessment-round", c.aiGenerateAssessmentRound);
tenantRoutes.post("/ai-evaluate-assignment", c.aiEvaluateAssignment);
