import { Router } from "express";
import * as c from "../controllers/tenant.controller.js";

/** Public company branding and open jobs. */
export const tenantRoutes = Router({ mergeParams: true });

tenantRoutes.get("/", c.getTenant);
tenantRoutes.get("/jobs/:ref", c.getJob);
tenantRoutes.post("/notifications/send-email", c.sendNotificationEmail);
