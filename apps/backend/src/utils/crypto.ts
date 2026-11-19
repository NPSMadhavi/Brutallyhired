import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";

export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");
export const sha256Hex = (input: string | Buffer) => createHash("sha256").update(input).digest("hex");
export const hmacHex = (input: string) => createHmac("sha256", env.SESSION_SECRET).update(input).digest("hex");
export const sixDigitCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");
export const pkceChallenge = (verifier: string) => createHash("sha256").update(verifier).digest("base64url");

export function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function shortCode(length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(0, ALPHABET.length)];
  return out;
}
