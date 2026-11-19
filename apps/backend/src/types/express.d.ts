import type { StaffMembership, Tenant, User } from "@verity/db";

declare global {
  namespace Express {
    interface Request {
      user?: User;
      sessionId?: string;
      tenant?: Tenant;
      staff?: StaffMembership;
    }
  }
}

export {};
