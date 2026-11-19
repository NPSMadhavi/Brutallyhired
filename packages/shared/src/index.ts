export * from "./enums.js";
export * from "./journey.js";
export * from "./dto.js";
export * from "./schemas/common.js";
export * from "./schemas/auth.js";
export * from "./schemas/candidate.js";
export * from "./schemas/journey.js";
export * from "./schemas/admin.js";

/** Socket.IO event names shared by server and client. */
export const SOCKET_EVENTS = {
  notification: "notification:new",
  applicationUpdated: "application:updated",
} as const;
