import { AccessToken } from "livekit-server-sdk";
import { env } from "../config/env.js";

export async function interviewToken(opts: {
  roomName: string;
  identity: string;
  name: string;
  ttlSeconds: number;
  canModerate?: boolean;
}) {
  const at = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
    identity: opts.identity,
    name: opts.name,
    ttl: Math.max(60, Math.round(opts.ttlSeconds)),
  });
  at.addGrant({
    roomJoin: true,
    room: opts.roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    roomAdmin: Boolean(opts.canModerate),
  });
  return { url: env.LIVEKIT_URL, token: await at.toJwt(), roomName: opts.roomName };
}
