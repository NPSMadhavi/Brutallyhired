import { z } from "zod";

export const idSchema = z.string().min(1).max(64);
export const isoDateTime = z.string().datetime({ offset: true });
export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const shortText = (max = 200) => z.string().trim().min(1).max(max);
export const optionalText = (max = 2000) =>
  z.string().trim().max(max).optional().transform((v) => (v === "" ? undefined : v));
