import { Router } from "express";
import * as c from "../controllers/assessment.controller.js";
import { requireUser } from "../middlewares/auth.middleware.js";
import { recordingChunk } from "../middlewares/upload.middleware.js";

/** Assessments, attempts and proctoring uploads. */
export const assessmentRoutes = Router({ mergeParams: true });
assessmentRoutes.use(requireUser);

assessmentRoutes.get("/applications/:appId/assessments", c.listAssessments);
assessmentRoutes.get("/assessments/:id", c.getAssessment);
assessmentRoutes.post("/assessments/:id/start", c.startAttempt);
assessmentRoutes.get("/attempts/:id", c.getAttempt);
assessmentRoutes.put("/attempts/:id/answers", c.saveAnswers);
assessmentRoutes.post("/attempts/:id/proctoring-events", c.recordProctoringEvents);
assessmentRoutes.post("/attempts/:id/recordings/:kind/:seq", recordingChunk, c.uploadRecordingChunk);
assessmentRoutes.post("/attempts/:id/submit", c.submitAttempt);
