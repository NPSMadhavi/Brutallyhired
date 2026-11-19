import rateLimit from "express-rate-limit";
import { minutes } from "../utils/time.js";

export const apiLimiter = rateLimit({ windowMs: minutes(15), limit: 1500, standardHeaders: true, legacyHeaders: false });
/** Sign-in code requests and verifications, per IP. */
export const emailCodeLimiter = rateLimit({ windowMs: minutes(15), limit: 10, standardHeaders: true, legacyHeaders: false });
