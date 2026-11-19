import { prisma, type Tenant } from "@verity/db";
import type { TenantPublic } from "@verity/shared";

const cache = new Map<string, { tenant: Tenant; at: number }>();
const TTL = 60_000;

export async function findTenantBySlug(slug: string): Promise<Tenant | null> {
  const key = slug.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.tenant;
  const tenant = await prisma.tenant.findUnique({ where: { slug: key } });
  if (tenant) cache.set(key, { tenant, at: Date.now() });
  return tenant;
}

export const invalidateTenant = (slug: string) => cache.delete(slug.toLowerCase());

export const toTenantPublic = (t: Tenant): TenantPublic => ({
  slug: t.slug,
  name: t.name,
  logoUrl: t.logoUrl,
  brandColor: t.brandColor,
  careersUrl: t.careersUrl,
  privacyNoticeUrl: t.privacyNoticeUrl,
  termsUrl: t.termsUrl,
  supportEmail: t.supportEmail,
  timezone: t.timezone,
  talentPoolMonths: t.talentPoolMonths,
});
