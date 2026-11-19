import { Router } from "express";
import * as c from "../controllers/interview.controller.js";
import { requireUser } from "../middlewares/auth.middleware.js";

/** Interview booking, calendar and LiveKit join tokens. */
export const interviewRoutes = Router({ mergeParams: true });
interviewRoutes.use(requireUser);

interviewRoutes.get("/applications/:appId/interviews", c.listInterviews);
interviewRoutes.get("/interviews/:id", c.getInterview);
interviewRoutes.post("/interviews/:id/book", c.bookSlot);
interviewRoutes.post("/interviews/:id/reschedule-request", c.requestReschedule);
interviewRoutes.get("/interviews/:id/calendar.ics", c.downloadCalendar);
interviewRoutes.post("/interviews/:id/join-token", c.createJoinToken);
