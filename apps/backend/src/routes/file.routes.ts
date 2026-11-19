import { Router } from "express";
import * as c from "../controllers/file.controller.js";
import { requireUser } from "../middlewares/auth.middleware.js";

/** Authorised file downloads. */
export const fileRoutes = Router({ mergeParams: true });
fileRoutes.use(requireUser);

fileRoutes.get("/:id", c.downloadFile);
