/**
 * Provision a hiring company and its first admin. All values come from arguments — no demo data.
 *
 *   npm run tenant:create -- --slug acme --name "Acme Ltd" --admin-email hr@acme.com \
 *     [--brand "#0F5E59"] [--logo https://...] [--careers https://...] [--privacy https://...] [--timezone Asia/Kolkata]
 */
import { prisma } from "@verity/db";
import { tenantSettingsSchema } from "@verity/shared";
import { parseArgs } from "node:util";
import { z } from "zod";

const { values } = parseArgs({
  options: {
    slug: { type: "string" },
    name: { type: "string" },
    "admin-email": { type: "string" },
    brand: { type: "string" },
    logo: { type: "string" },
    careers: { type: "string" },
    privacy: { type: "string" },
    support: { type: "string" },
    timezone: { type: "string" },
  },
});

const slug = z
  .string()
  .regex(/^[a-z0-9-]{2,40}$/)
  .parse(values.slug);
const adminEmail = z.string().email().parse(values["admin-email"]?.toLowerCase());
const settings = tenantSettingsSchema.parse({
  name: values.name,
  brandColor: values.brand ?? "#2F5BEA",
  logoUrl: values.logo ?? null,
  careersUrl: values.careers ?? null,
  privacyNoticeUrl: values.privacy ?? null,
  supportEmail: values.support ?? null,
  timezone: values.timezone ?? "UTC",
  eligibilityThreshold: 60,
  talentPoolMonths: 12,
});

const tenant = await prisma.tenant.create({ data: { slug, ...settings } });
const user = await prisma.user.upsert({ where: { email: adminEmail }, create: { email: adminEmail }, update: {} });
await prisma.staffMembership.create({ data: { userId: user.id, tenantId: tenant.id, role: "ADMIN" } });

console.log(`Created tenant "${tenant.name}" (${tenant.slug}). Admin: ${adminEmail}`);
await prisma.$disconnect();
