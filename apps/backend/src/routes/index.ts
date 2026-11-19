import { Router } from "express";
import { loadTenant } from "../middlewares/tenant.middleware.js";
import { adminRoutes } from "./admin.routes.js";
import { applicationRoutes } from "./application.routes.js";
import { assessmentRoutes } from "./assessment.routes.js";
import { authRoutes } from "./auth.routes.js";
import { fileRoutes } from "./file.routes.js";
import { interviewRoutes } from "./interview.routes.js";
import { notificationRoutes } from "./notification.routes.js";
import { offerRoutes } from "./offer.routes.js";
import { onboardingRoutes } from "./onboarding.routes.js";
import { profileRoutes } from "./profile.routes.js";
import { tenantRoutes } from "./tenant.routes.js";

/** Everything under /api/t/:tenantSlug is scoped to one hiring company. */
const tenantScoped = Router({ mergeParams: true });
tenantScoped.use(loadTenant);
tenantScoped.use("/", tenantRoutes);
tenantScoped.use("/profile", profileRoutes);
tenantScoped.use("/notifications", notificationRoutes);
tenantScoped.use("/admin", adminRoutes);
tenantScoped.use("/", applicationRoutes);
tenantScoped.use("/", assessmentRoutes);
tenantScoped.use("/", interviewRoutes);
tenantScoped.use("/", offerRoutes);
tenantScoped.use("/", onboardingRoutes);

export const apiRouter = Router();
apiRouter.get("/health", (_req, res) => res.json({ ok: true }));
apiRouter.use("/auth", authRoutes);
apiRouter.use("/files", fileRoutes);
apiRouter.use("/t/:tenantSlug", tenantScoped);
