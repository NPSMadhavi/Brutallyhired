import { useQueryClient } from "@tanstack/react-query";
import { SOCKET_EVENTS, type NotificationDto } from "@verity/shared";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { invalidateApplication } from "@/api/hooks";
import { useToast } from "@/components/layout/Toasts";
import { closeSocket, getSocket } from "@/lib/socket";

/** Live updates: refresh data and announce new milestones as they happen. */
export function useRealtime(slug: string, enabled: boolean) {
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useTranslation();
  useEffect(() => {
    if (!enabled) return;
    const socket = getSocket();
    const onNotification = (p: { tenantSlug: string; notification: NotificationDto }) => {
      if (p.tenantSlug !== slug) return;
      invalidateApplication(qc, slug, p.notification.applicationId ?? undefined);
      toast(t("realtime.newUpdate", { title: t(`events.${p.notification.type}.title`) }));
    };
    const onUpdated = (p: { tenantSlug: string; applicationId: string }) => {
      if (p.tenantSlug === slug) invalidateApplication(qc, slug, p.applicationId);
    };
    socket.on(SOCKET_EVENTS.notification, onNotification);
    socket.on(SOCKET_EVENTS.applicationUpdated, onUpdated);
    socket.connect();
    return () => {
      socket.off(SOCKET_EVENTS.notification, onNotification);
      socket.off(SOCKET_EVENTS.applicationUpdated, onUpdated);
      closeSocket();
    };
  }, [enabled, slug, qc, toast, t]);
}
