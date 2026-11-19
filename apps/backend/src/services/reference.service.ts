import { prisma } from "@verity/db";
import { shortCode } from "../utils/crypto.js";

/** e.g. AST-2611-7KQ2 — prefix from the tenant slug, year+month, random suffix. */
export async function newApplicationReference(tenantSlug: string): Promise<string> {
  const prefix = tenantSlug
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 3)
    .toUpperCase()
    .padEnd(3, "X");
  const now = new Date();
  const ym = `${String(now.getUTCFullYear()).slice(2)}${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  for (let i = 0; i < 5; i++) {
    const ref = `${prefix}-${ym}-${shortCode(4)}`;
    if (!(await prisma.application.findUnique({ where: { reference: ref }, select: { id: true } }))) return ref;
  }
  return `${prefix}-${ym}-${shortCode(8)}`;
}
