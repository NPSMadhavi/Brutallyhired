import { prisma } from "@verity/db";
import type { RequestHandler } from "express";
import { jobPublic } from "../serializers/candidate.serializer.js";
import { toTenantPublic } from "../services/tenant.service.js";
import { ah, notFound } from "../utils/errors.js";
import { tenantOf } from "../utils/request.js";

/** Jobs are addressed by the company's own reference (from its careers site) or by id. */

export const getTenant: RequestHandler = (req, res) => {
  res.json(toTenantPublic(tenantOf(req)));
};

export const getJob = ah(async (req, res) => {
  const tenant = tenantOf(req);
  const job = await prisma.job.findFirst({
    where: { tenantId: tenant.id, status: "OPEN", OR: [{ externalRef: req.params.ref }, { id: req.params.ref }] },
    include: { questions: true },
  });
  if (!job) throw notFound("job");
  res.json(jobPublic(job));
});
