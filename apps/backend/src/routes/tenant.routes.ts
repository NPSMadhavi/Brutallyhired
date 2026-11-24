
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

// Proctoring telemetry management
tenantRoutes.post("/proctoring/telemetry", c.recordProctoringTelemetry);
tenantRoutes.get("/proctoring/telemetry/:candidateId?", c.getProctoringTelemetry);

// Interview Slots Management
tenantRoutes.get("/interview-slots", c.getInterviewSlots);
tenantRoutes.post("/interview-slots", c.saveInterviewSlots);
tenantRoutes.post("/interview-slots/reschedule", c.rescheduleInterviewSlot);
tenantRoutes.post("/interview-slots/cancel", c.cancelInterviewSlot);
tenantRoutes.post("/interview-slots/complete", c.completeInterviewSlot);
