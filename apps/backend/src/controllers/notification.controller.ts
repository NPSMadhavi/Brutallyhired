import { prisma } from "@verity/db";
import type { NotificationDto, Paginated, PublicEventType } from "@verity/shared";
import { ah } from "../utils/errors.js";
import { tenantOf, userOf } from "../utils/request.js";

const PAGE = 20;

export const listNotifications = ah(async (req, res) => {
  const user = userOf(req);
  const tenant = tenantOf(req);
  const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
  const rows = await prisma.notification.findMany({
    where: { userId: user.id, tenantId: tenant.id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PAGE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const unread = await prisma.notification.count({ where: { userId: user.id, tenantId: tenant.id, readAt: null } });
  const items: NotificationDto[] = rows.slice(0, PAGE).map((n) => ({
    id: n.id,
    type: n.type as PublicEventType,
    applicationId: n.applicationId,
    data: (n.data as Record<string, unknown>) ?? null,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  }));
  const body: Paginated<NotificationDto> & { unread: number } = {
    items,
    nextCursor: rows.length > PAGE ? (rows[PAGE - 1]?.id ?? null) : null,
    unread,
  };
  res.json(body);
});

export const markAllRead = ah(async (req, res) => {
  await prisma.notification.updateMany({
    where: { userId: userOf(req).id, tenantId: tenantOf(req).id, readAt: null },
    data: { readAt: new Date() },
  });
  res.status(204).end();
});

export const markRead = ah(async (req, res) => {
  await prisma.notification.updateMany({
    where: { id: req.params.id, userId: userOf(req).id, readAt: null },
    data: { readAt: new Date() },
  });
  res.status(204).end();
});
