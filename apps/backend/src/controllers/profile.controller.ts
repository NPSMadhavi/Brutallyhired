import { prisma } from "@verity/db";
import { profileSchema, type ProfileDto } from "@verity/shared";
import { ah, parse } from "../utils/errors.js";
import { tenantOf, userOf } from "../utils/request.js";

const toDto = (p: Awaited<ReturnType<typeof prisma.candidateProfile.findUnique>>): ProfileDto | null =>
  p
    ? { firstName: p.firstName, lastName: p.lastName, phone: p.phone, city: p.city, experience: p.experience, noticePeriod: p.noticePeriod }
    : null;

export const getProfile = ah(async (req, res) => {
  const profile = await prisma.candidateProfile.findUnique({
    where: { userId_tenantId: { userId: userOf(req).id, tenantId: tenantOf(req).id } },
  });
  res.json({ profile: toDto(profile), email: userOf(req).email, displayName: userOf(req).displayName });
});

export const saveProfile = ah(async (req, res) => {
  const input = parse(profileSchema, req.body);
  const user = userOf(req);
  const tenant = tenantOf(req);
  const profile = await prisma.candidateProfile.upsert({
    where: { userId_tenantId: { userId: user.id, tenantId: tenant.id } },
    create: { userId: user.id, tenantId: tenant.id, ...input },
    update: input,
  });
  const fullName = `${input.firstName} ${input.lastName}`.trim();
  await prisma.user.update({
    where: { id: user.id },
    data: { displayName: fullName },
  });
  res.json({ profile: toDto(profile), email: user.email, displayName: fullName });
});
