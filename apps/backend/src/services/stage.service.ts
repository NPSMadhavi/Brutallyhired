import { prisma, type ApplicationStage } from "@verity/db";
import type { PublicEventType } from "@verity/shared";
import { internalEvent, publishMilestone } from "./notification.service.js";

const ORDER: ApplicationStage[] = ["DRAFT", "SUBMITTED", "IN_REVIEW", "ASSESSMENT", "INTERVIEW", "OFFER", "ONBOARDING", "HIRED"];

const PUBLIC_FOR: Partial<Record<ApplicationStage, PublicEventType>> = {
  IN_REVIEW: "review_started",
  NOT_SELECTED: "application_closed",
  WITHDRAWN: "application_withdrawn",
  HIRED: "hired",
};

/** Move an application to a stage, recording an internal audit event and any public milestone. */
export async function changeStage(applicationId: string, to: ApplicationStage, actorUserId: string | null, note?: string) {
  const app = await prisma.application.findUniqueOrThrow({ where: { id: applicationId } });
  if (app.stage === to) return app;
  const closing = to === "NOT_SELECTED" || to === "WITHDRAWN";
  const updated = await prisma.application.update({
    where: { id: applicationId },
    data: { stage: to, closedAt: closing ? new Date() : null },
  });
  await internalEvent(applicationId, "stage_changed", { from: app.stage, to, note: note ?? null }, actorUserId);
  const publicType = PUBLIC_FOR[to];
  if (publicType) await publishMilestone({ applicationId, type: publicType, actorUserId });
  return updated;
}

/** Advance only if the application is behind `to` (creating an invite shouldn't move it backwards). */
export async function advanceTo(applicationId: string, to: ApplicationStage, actorUserId: string | null) {
  const app = await prisma.application.findUniqueOrThrow({ where: { id: applicationId } });
  if (ORDER.indexOf(app.stage) < ORDER.indexOf(to)) return changeStage(applicationId, to, actorUserId);
  return app;
}
