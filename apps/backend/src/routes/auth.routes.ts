import { Router } from "express";
import * as c from "../controllers/auth.controller.js";
import { requireUser } from "../middlewares/auth.middleware.js";
import { emailCodeLimiter } from "../middlewares/rateLimit.middleware.js";

/** Sign-in (OIDC + email codes), session and identity linking. */
export const authRoutes = Router({ mergeParams: true });

authRoutes.get("/providers", c.getProviders);
authRoutes.get("/me", c.getCurrentUser);
authRoutes.post("/logout", c.logout);
authRoutes.get("/oidc/:provider/start", c.startOidc);
authRoutes.get("/oidc/:provider/callback", c.oidcCallback);
authRoutes.get("/intents/:id", c.getIntent);
authRoutes.post("/intents/:id/confirm", requireUser, c.confirmIntent);
authRoutes.delete("/identities/:provider", requireUser, c.unlinkIdentity);
authRoutes.post("/email/request", emailCodeLimiter, c.requestEmailCode);
authRoutes.post("/email/verify", emailCodeLimiter, c.verifyEmailCode);
