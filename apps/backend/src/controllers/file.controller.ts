import { prisma } from "@verity/db";
import { storage } from "../services/storage.service.js";
import { ah, forbidden, notFound } from "../utils/errors.js";
import { userOf } from "../utils/request.js";

/** Download with authorisation: the uploader, the candidate an offer letter was issued to, or staff of the tenant. */

export const downloadFile = ah(async (req, res) => {
  const user = userOf(req);
  const file = await prisma.fileObject.findUnique({ where: { id: req.params.id } });
  if (!file) throw notFound("file");
  let allowed = file.ownerUserId === user.id && file.purpose !== "PROCTOR_RECORDING";
  if (!allowed && file.purpose === "OFFER_LETTER") {
    allowed = Boolean(
      await prisma.offer.findFirst({
        where: { letterFileId: file.id, status: { notIn: ["DRAFT", "WITHDRAWN"] }, application: { userId: user.id } },
      }),
    );
  }
  if (!allowed) {
    allowed = Boolean(await prisma.staffMembership.findFirst({ where: { userId: user.id, tenantId: file.tenantId } }));
  }
  if (!allowed) throw forbidden();
  res.setHeader("content-type", file.mimeType);
  res.setHeader("content-length", String(file.sizeBytes));
  res.setHeader("x-content-type-options", "nosniff");
  res.setHeader("cache-control", "private, no-store");
  res.setHeader("content-disposition", `attachment; filename*=UTF-8''${encodeURIComponent(file.originalName)}`);
  storage
    .read(file.storageKey)
    .on("error", () => res.destroy())
    .pipe(res);
});
