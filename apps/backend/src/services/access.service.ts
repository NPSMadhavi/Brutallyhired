import { prisma } from "@verity/db";
import type { Request } from "express";
import { notFound } from "../utils/errors.js";
import { tenantOf, userOf } from "../utils/request.js";

/** Load an application only if it belongs to the signed-in candidate and the current tenant. */
export async function ownedApplication(req: Request, id: string) {
  const app = await prisma.application.findFirst({
    where: { id, userId: userOf(req).id, tenantId: tenantOf(req).id },
  });
  if (!app) throw notFound("application");
  return app;
}
