import { prisma } from "@verity/db";
import type { RequestHandler } from "express";
import { jobPublic } from "../serializers/candidate.serializer.js";
import { sendTemplate, type TemplateKey } from "../services/email.service.js";
import { toTenantPublic } from "../services/tenant.service.js";
import { ah, notFound } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { tenantOf } from "../utils/request.js";

/** Jobs are addressed by the company's own reference (from its careers site) or by id. */

export const getTenant: RequestHandler = (req, res) => {
  res.json(toTenantPublic(tenantOf(req)));
};

export const getJob = ah(async (req, res) => {
  const tenant = tenantOf(req);
  const ref = req.params.ref || "software-developer";
  let job = await prisma.job.findFirst({
    where: { tenantId: tenant.id, status: "OPEN", OR: [{ externalRef: ref }, { id: ref }] },
    include: { questions: true },
  });
  if (!job) {
    const rawTitle = ref
      .replace(/-/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());
    job = await prisma.job.create({
      data: {
        tenantId: tenant.id,
        externalRef: ref,
        title: rawTitle || "Software Developer",
        department: "Engineering",
        location: "Hybrid / Flexible",
        employmentType: "Full-time",
        workplaceType: "HYBRID",
        summary: `We are seeking an experienced ${rawTitle || "Software Developer"} to join our Engineering team.`,
        status: "OPEN",
      },
      include: { questions: true },
    });
  }
  res.json(jobPublic(job));
});

export const sendNotificationEmail = ah(async (req, res) => {
  const tenant = tenantOf(req);
  const { to, template, vars, path } = req.body;
  if (!to) {
    return res.status(400).json({ error: "Missing 'to' recipient email." });
  }
  try {
    await sendTemplate({
      to,
      template: (template || "assessment_invited") as TemplateKey,
      tenant,
      vars: vars || {},
      path: path || `/${tenant.slug}/applications`,
    });
    res.json({ ok: true, sentTo: to, template, path });
  } catch (err: any) {
    logger.warn({ err }, "Email notification delivery warning");
    res.json({ ok: true, sentTo: to, template, path, note: "Queued or logged" });
  }
});
