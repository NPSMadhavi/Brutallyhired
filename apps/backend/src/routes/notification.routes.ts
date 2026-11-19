import { Router } from "express";
import * as c from "../controllers/notification.controller.js";
import { requireUser } from "../middlewares/auth.middleware.js";

/** In-app notifications. */
export const notificationRoutes = Router({ mergeParams: true });
notificationRoutes.use(requireUser);

notificationRoutes.get("/", c.listNotifications);
notificationRoutes.post("/read-all", c.markAllRead);
notificationRoutes.post("/:id/read", c.markRead);
