import type { Tenant, User } from "@verity/db";
import type { Request } from "express";
import { HttpError, notFound } from "./errors.js";

/** The signed-in user; throws 401 if the route forgot `requireUser`. */
export const userOf = (req: Request): User => {
  if (!req.user) throw new HttpError(401, "unauthenticated");
  return req.user;
};

/** The tenant resolved from /t/:tenantSlug by `loadTenant`. */
export const tenantOf = (req: Request): Tenant => {
  if (!req.tenant) throw notFound("tenant");
  return req.tenant;
};
