import { prisma } from "@verity/db";
import { ACCEPTED_DOCUMENT_MIME } from "@verity/shared";
import { onboardingDto } from "../serializers/candidate.serializer.js";
import { ownedApplication } from "../services/access.service.js";
import { storeUpload } from "../services/file.service.js";
import { internalEvent } from "../services/notification.service.js";
import { ah, conflict, HttpError, notFound } from "../utils/errors.js";
import { tenantOf, userOf } from "../utils/request.js";

export const getOnboarding = ah(async (req, res) => {
  const app = await ownedApplication(req, req.params.id!);
  if (app.stage !== "ONBOARDING" && app.stage !== "HIRED") throw new HttpError(409, "onboarding_locked");
  const [tasks, joining] = await Promise.all([
    prisma.onboardingTask.findMany({ where: { applicationId: app.id } }),
    prisma.joiningDetails.findUnique({ where: { applicationId: app.id } }),
  ]);
  const files = await prisma.fileObject.findMany({ where: { id: { in: tasks.map((t) => t.fileId).filter((x): x is string => !!x) } } });
  res.json(
    onboardingDto(
      tasks.map((t) => ({ ...t, file: files.find((f) => f.id === t.fileId) ?? null })),
      joining,
    ),
  );
});

export const uploadOnboardingDocument = ah(async (req, res) => {
  const task = await prisma.onboardingTask.findFirst({
    where: { id: req.params.taskId, application: { userId: userOf(req).id, tenantId: tenantOf(req).id } },
  });
  if (!task) throw notFound("task");
  if (task.status !== "PENDING" && task.status !== "REJECTED") throw conflict("task_not_open");
  const file = await storeUpload({
    file: req.file,
    tenantId: tenantOf(req).id,
    ownerUserId: userOf(req).id,
    purpose: "ONBOARDING_DOCUMENT",
    accept: ACCEPTED_DOCUMENT_MIME,
  });
  await prisma.onboardingTask.update({
    where: { id: task.id },
    data: { status: "SUBMITTED", fileId: file.id, submittedAt: new Date(), reviewerNote: null },
  });
  await internalEvent(task.applicationId, "onboarding_document_submitted", { taskId: task.id }, userOf(req).id);
  res.status(201).json({ ok: true });
});
