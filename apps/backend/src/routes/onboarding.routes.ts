import { Router } from "express";
import * as c from "../controllers/onboarding.controller.js";
import { requireUser } from "../middlewares/auth.middleware.js";
import { documentUpload } from "../middlewares/upload.middleware.js";

/** Onboarding checklist and document uploads. */
export const onboardingRoutes = Router({ mergeParams: true });
onboardingRoutes.use(requireUser);

onboardingRoutes.get("/applications/:id/onboarding", c.getOnboarding);
onboardingRoutes.post("/onboarding-tasks/:taskId/file", documentUpload.single("file"), c.uploadOnboardingDocument);
