
import { Router } from "express";
import * as c from "../controllers/tenant.controller.js";
import * as wf from "../controllers/workflow.controller.js";

/** Public company branding and open jobs. */
export const tenantRoutes = Router({ mergeParams: true });

tenantRoutes.get("/", c.getTenant);
tenantRoutes.get("/jobs", c.listJobs);
tenantRoutes.get("/jobs/:ref", c.getJob);
tenantRoutes.delete("/applications/:id", c.deleteApplicationDirect);
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

// End-to-End 3-Round Recruitment Workflow API
tenantRoutes.get("/workflow/applications", wf.getWorkflowApplications);
tenantRoutes.get("/workflow/emails", wf.getWorkflowEmailLogs);
tenantRoutes.post("/workflow/applications/:appId/screening/submit", wf.submitScreeningAuto);
tenantRoutes.post("/workflow/applications/:appId/round1/book-slot", wf.bookRound1Slot);
tenantRoutes.post("/workflow/applications/:appId/round1/configure", wf.configureRound1);
tenantRoutes.get("/workflow/applications/:appId/round1", wf.getRound1State);
tenantRoutes.post("/workflow/applications/:appId/round1/submit", wf.submitRound1);
tenantRoutes.post("/workflow/applications/:appId/round1/review", wf.reviewRound1);
tenantRoutes.post("/workflow/applications/:appId/round2/generate", wf.generateRound2Project);
tenantRoutes.put("/workflow/applications/:appId/round2/task", wf.updateAndApproveRound2Task);
tenantRoutes.post("/workflow/applications/:appId/round2/schedule", wf.scheduleRound2);
tenantRoutes.get("/workflow/applications/:appId/round2", wf.getRound2State);
tenantRoutes.post("/workflow/applications/:appId/round2/start", wf.startRound2);
tenantRoutes.post("/workflow/applications/:appId/round2/submit", wf.submitRound2);
tenantRoutes.post("/workflow/applications/:appId/round2/decision", wf.decideRound2);
tenantRoutes.post("/workflow/applications/:appId/round3/schedule", wf.scheduleRound3);
tenantRoutes.post("/workflow/applications/:appId/round3/attendance", wf.recordRound3Attendance);
tenantRoutes.post("/workflow/applications/:appId/round3/feedback", wf.saveRound3Feedback);
tenantRoutes.post("/workflow/applications/:appId/round3/decision", wf.decideRound3);
