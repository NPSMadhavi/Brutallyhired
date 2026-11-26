import { prisma, type Tenant } from "@verity/db";
import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import en from "../locales/email/en.json" with { type: "json" };
import { logger } from "../utils/logger.js";

type Catalog = typeof en;
export type TemplateKey = Exclude<keyof Catalog, "layout">;

const catalogs: Record<string, Catalog> = { en };

const transport = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
});

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const fill = (tpl: string, vars: Record<string, unknown>) =>
  tpl.replace(/\{\{(\w+)\}\}/g, (_, k: string) => (vars[k] === undefined || vars[k] === null ? "" : String(vars[k])));

export interface SendOptions {
  to: string;
  template: TemplateKey;
  tenant: Pick<Tenant, "name" | "brandColor" | "slug" | "logoUrl"> | null;
  vars: Record<string, unknown>;
  locale?: string | null;
  /** In-app path for the call-to-action button. */
  path?: string;
  subject?: string;
  heading?: string;
  body?: string;
  attachments?: { filename: string; content: string | Buffer; contentType: string }[];
}

export async function sendTemplate(opts: SendOptions) {
  const cat = catalogs[opts.locale ?? "en"] ?? en;
  const t = cat[opts.template] as { subject: string; heading: string; body: string; highlight?: string } | undefined;
  const tenantName = opts.tenant?.name ?? cat.layout.platform;
  const vars = { ...opts.vars, tenant: tenantName };
  const brand = opts.tenant?.brandColor ?? "#2F5BEA";
  const subject = opts.subject || (t ? fill(t.subject, vars) : "Notification from Brutallyhired");
  const heading = opts.heading || (t ? fill(t.heading, vars) : "Notification from Brutallyhired");
  const body = opts.body || (t ? fill(t.body, vars) : "");
  const highlight = t?.highlight ? fill(t.highlight, vars) : null;
  const url = opts.path ? new URL(opts.path, env.WEB_ORIGIN).toString() : null;

  const html = `<!doctype html><html><body style="margin:0;background:#F4F6FA;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0E1726">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px;border:1px solid #E9EDF3">
<tr><td style="padding:28px 32px 0;font-weight:700;font-size:16px">${opts.tenant?.logoUrl ? `<img src="${escapeHtml(opts.tenant.logoUrl)}" alt="" height="32" style="vertical-align:middle;margin-right:10px">` : ""}${escapeHtml(tenantName)}</td></tr>
<tr><td style="padding:20px 32px 0;font-size:22px;font-weight:700">${escapeHtml(heading)}</td></tr>
<tr><td style="padding:12px 32px 0;font-size:15px;line-height:1.6;color:#2A3647">${escapeHtml(body).replace(/\n/g, "<br>")}</td></tr>
${highlight ? `<tr><td style="padding:20px 32px 0"><div style="font-size:32px;font-weight:700;letter-spacing:8px;background:#F5F8FF;border-radius:12px;padding:16px;text-align:center">${escapeHtml(highlight)}</div></td></tr>` : ""}
${url ? `<tr><td style="padding:24px 32px 0"><a href="${escapeHtml(url)}" style="display:inline-block;background:${escapeHtml(brand)};color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px">${escapeHtml(cat.layout.button)}</a></td></tr>` : ""}
<tr><td style="padding:28px 32px 28px;font-size:12px;color:#5B6676">${escapeHtml(fill(cat.layout.footer, vars))}</td></tr>
</table></td></tr></table></body></html>`;
  const text = [heading, "", body, highlight ?? "", url ?? ""].filter(Boolean).join("\n");

  try {
    await transport.sendMail({ from: env.EMAIL_FROM, to: opts.to, subject, html, text, attachments: opts.attachments });
  } catch (err) {
    // Email failures must not break the user's action; they're logged for retry/alerting.
    logger.error({ err, template: opts.template }, "email send failed");
  }
}

/**
 * Sends a templated email with persistent EmailLog tracking and optional deduplication key.
 * Prevents duplicate notifications for the same milestone/decision.
 */
export async function sendTrackedTemplate(
  opts: SendOptions & { tenantId: string; applicationId?: string; dedupKey?: string },
): Promise<{ sent: boolean; skipped?: boolean; error?: string }> {
  if (opts.dedupKey) {
    const existing = await prisma.emailLog.findUnique({ where: { dedupKey: opts.dedupKey } });
    if (existing && existing.status === "SENT") {
      return { sent: false, skipped: true };
    }
  }

  const cat = catalogs[opts.locale ?? "en"] ?? en;
  const t = cat[opts.template] as { subject: string; heading: string; body: string; highlight?: string } | undefined;
  const tenantName = opts.tenant?.name ?? cat.layout.platform;
  const vars = { ...opts.vars, tenant: tenantName };
  const subject = opts.subject || (t ? fill(t.subject, vars) : "Notification from Brutallyhired");

  try {
    await sendTemplate(opts);
    await prisma.emailLog.upsert({
      where: opts.dedupKey ? { dedupKey: opts.dedupKey } : { id: `log-${Date.now()}-${Math.random()}` },
      update: { status: "SENT", subject, sentAt: new Date(), error: null },
      create: {
        tenantId: opts.tenantId,
        applicationId: opts.applicationId,
        recipient: opts.to,
        template: opts.template,
        subject,
        status: "SENT",
        dedupKey: opts.dedupKey,
      },
    });
    return { sent: true };
  } catch (err: any) {
    const msg = String(err?.message || err);
    await prisma.emailLog.create({
      data: {
        tenantId: opts.tenantId,
        applicationId: opts.applicationId,
        recipient: opts.to,
        template: opts.template,
        subject,
        status: "FAILED",
        error: msg,
      },
    }).catch(() => {});
    return { sent: false, error: msg };
  }
}
