/// <reference types="multer" />
import type { FilePurpose } from "@verity/db";
import { prisma } from "@verity/db";
import { fileTypeFromBuffer } from "file-type";
import path from "node:path";
import { sha256Hex } from "../utils/crypto.js";
import { HttpError } from "../utils/errors.js";
import { newStorageKey, storage } from "./storage.service.js";

const EXT: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/rtf": ".rtf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "video/webm": ".webm",
};

/** Detect the real type from the bytes; never trust the browser's Content-Type. */
export async function sniffMime(buf: Buffer, originalName: string): Promise<string | null> {
  const detected = await fileTypeFromBuffer(buf);
  if (detected) {
    if (detected.mime === "application/x-cfb" && /\.doc$/i.test(originalName)) return "application/msword";
    if (detected.mime === "application/zip" && /\.docx$/i.test(originalName)) {
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    }
    return detected.mime;
  }
  if (buf.subarray(0, 5).toString("latin1") === "{\\rtf") return "application/rtf";
  return null;
}

export async function storeUpload(opts: {
  file: Express.Multer.File | undefined;
  tenantId: string;
  ownerUserId: string | null;
  purpose: FilePurpose;
  accept: readonly string[];
}) {
  const { file } = opts;
  if (!file || file.size === 0) throw new HttpError(422, "file_required");
  const mime = await sniffMime(file.buffer, file.originalname);
  const normalised = mime === "text/rtf" ? "application/rtf" : mime;
  if (!normalised || !opts.accept.includes(normalised)) throw new HttpError(415, "file_type_not_allowed");
  return storeBuffer({ ...opts, buffer: file.buffer, mime: normalised, originalName: file.originalname });
}

export async function storeBuffer(opts: {
  buffer: Buffer;
  mime: string;
  originalName: string;
  tenantId: string;
  ownerUserId: string | null;
  purpose: FilePurpose;
}) {
  const ext = EXT[opts.mime] ?? path.extname(opts.originalName).slice(0, 8);
  const key = newStorageKey(opts.tenantId, opts.purpose, ext);
  await storage.put(key, opts.buffer);
  return prisma.fileObject.create({
    data: {
      tenantId: opts.tenantId,
      ownerUserId: opts.ownerUserId,
      purpose: opts.purpose,
      storageKey: key,
      originalName: path.basename(opts.originalName).slice(0, 200),
      mimeType: opts.mime,
      sizeBytes: opts.buffer.length,
      sha256: sha256Hex(opts.buffer),
    },
  });
}
