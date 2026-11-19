import { prisma } from "@verity/db";
import { acceptOfferSchema, declineOfferSchema } from "@verity/shared";
import { offerDto, recruiterDto } from "../serializers/candidate.serializer.js";
import { ownedApplication } from "../services/access.service.js";
import { emailRecruiters, publishMilestone } from "../services/notification.service.js";
import { changeStage } from "../services/stage.service.js";
import { ah, conflict, notFound, parse } from "../utils/errors.js";
import { userOf } from "../utils/request.js";

async function visibleOffer(applicationId: string) {
  const offer = await prisma.offer.findUnique({ where: { applicationId } });
  if (!offer || offer.status === "DRAFT" || offer.status === "WITHDRAWN") throw notFound("offer");
  if (offer.status === "SENT" && offer.respondBy < new Date()) {
    return prisma.offer.update({ where: { id: offer.id }, data: { status: "EXPIRED" } });
  }
  return offer;
}

export const getOffer = ah(async (req, res) => {
  const app = await ownedApplication(req, req.params.id!);
  const offer = await visibleOffer(app.id);
  const [letter, recruiter] = await Promise.all([
    offer.letterFileId ? prisma.fileObject.findUnique({ where: { id: offer.letterFileId } }) : null,
    app.recruiterUserId ? prisma.user.findUnique({ where: { id: app.recruiterUserId }, include: { staff: true } }) : null,
  ]);
  res.json(offerDto(offer, letter, recruiterDto(recruiter, app.tenantId)));
});

export const acceptOffer = ah(async (req, res) => {
  const app = await ownedApplication(req, req.params.id!);
  const offer = await visibleOffer(app.id);
  if (offer.status !== "SENT") throw conflict(`offer_${offer.status.toLowerCase()}`);
  const { signatureName } = parse(acceptOfferSchema, req.body);
  const template = await prisma.onboardingTemplateItem.findMany({ where: { tenantId: app.tenantId }, orderBy: { order: "asc" } });
  await prisma.$transaction([
    prisma.offer.update({
      where: { id: offer.id },
      data: { status: "ACCEPTED", respondedAt: new Date(), signatureName, signatureIp: req.ip ?? null },
    }),
    prisma.onboardingTask.createMany({
      data: template.map((t) => ({
        applicationId: app.id,
        title: t.title,
        description: t.description,
        required: t.required,
        order: t.order,
      })),
    }),
  ]);
  await publishMilestone({ applicationId: app.id, type: "offer_accepted" });
  await changeStage(app.id, "ONBOARDING", userOf(req).id);
  await publishMilestone({ applicationId: app.id, type: "onboarding_started", email: false });
  res.json({ ok: true });
});

export const declineOffer = ah(async (req, res) => {
  const app = await ownedApplication(req, req.params.id!);
  const offer = await visibleOffer(app.id);
  if (offer.status !== "SENT") throw conflict(`offer_${offer.status.toLowerCase()}`);
  const { reason } = parse(declineOfferSchema, req.body);
  await prisma.offer.update({
    where: { id: offer.id },
    data: { status: "DECLINED", respondedAt: new Date(), declineReason: reason ?? null },
  });
  await publishMilestone({ applicationId: app.id, type: "offer_declined" });
  const profile = await prisma.candidateProfile.findUnique({ where: { userId_tenantId: { userId: app.userId, tenantId: app.tenantId } } });
  await emailRecruiters(app.id, "staff_offer_declined", {
    candidateName: profile ? `${profile.firstName} ${profile.lastName}` : userOf(req).email,
    reason: reason ?? "—",
  });
  res.json({ ok: true });
});
