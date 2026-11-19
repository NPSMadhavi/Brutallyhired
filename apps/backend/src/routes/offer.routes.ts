import { Router } from "express";
import * as c from "../controllers/offer.controller.js";
import { requireUser } from "../middlewares/auth.middleware.js";

/** Offer review, e-sign and decline. */
export const offerRoutes = Router({ mergeParams: true });
offerRoutes.use(requireUser);

offerRoutes.get("/applications/:id/offer", c.getOffer);
offerRoutes.post("/applications/:id/offer/accept", c.acceptOffer);
offerRoutes.post("/applications/:id/offer/decline", c.declineOffer);
