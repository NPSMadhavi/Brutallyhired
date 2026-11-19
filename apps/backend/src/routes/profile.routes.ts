import { Router } from "express";
import * as c from "../controllers/profile.controller.js";
import { requireUser } from "../middlewares/auth.middleware.js";

/** Candidate details for this company. */
export const profileRoutes = Router({ mergeParams: true });
profileRoutes.use(requireUser);

profileRoutes.get("/", c.getProfile);
profileRoutes.put("/", c.saveProfile);
