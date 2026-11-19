import { prisma, type StaffRole } from "@verity/db";
import type { NextFunction, Request, Response } from "express";
import { findTenantBySlug } from "../services/tenant.service.js";
import { HttpError, notFound } from "../utils/errors.js";
import { tenantOf } from "../utils/request.js";

/** Resolve the company from /t/:tenantSlug. */
export async function loadTenant(req: Request, _res: Response, next: NextFunction) {
  try {
    const tenant = await findTenantBySlug(String(req.params.tenantSlug ?? ""));
    if (!tenant) throw notFound("tenant");
    req.tenant = tenant;
    next();
  } catch (e) {
    next(e);
  }
}

/** Staff of the current tenant, optionally limited to some roles. */
export const requireStaff =
  (...roles: StaffRole[]) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new HttpError(401, "unauthenticated");
      const tenant = tenantOf(req);
      const staff = await prisma.staffMembership.findUnique({
        where: { userId_tenantId: { userId: req.user.id, tenantId: tenant.id } },
      });
      if (!staff || (roles.length > 0 && !roles.includes(staff.role))) throw new HttpError(403, "forbidden");
      req.staff = staff;
      next();
    } catch (e) {
      next(e);
    }
  };

export const adminOnly = requireStaff("ADMIN");
export const recruiterOnly = requireStaff("ADMIN", "RECRUITER");
