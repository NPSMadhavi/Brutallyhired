import { createReadStream } from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Readable } from "node:stream";
import { env } from "../config/env.js";
import { randomToken } from "../utils/crypto.js";

/** Storage abstraction so local disk can be swapped for S3/GCS without touching callers. */
export interface StorageAdapter {
  put(key: string, data: Buffer): Promise<void>;
  read(key: string): Readable;
  remove(key: string): Promise<void>;
}

class LocalDiskStorage implements StorageAdapter {
  constructor(private root: string) {}
  private resolve(key: string) {
    const full = path.resolve(this.root, key);
    if (!full.startsWith(path.resolve(this.root) + path.sep)) throw new Error("invalid storage key");
    return full;
  }
  async put(key: string, data: Buffer) {
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data, { flag: "wx" });
  }
  read(key: string) {
    return createReadStream(this.resolve(key));
  }
  async remove(key: string) {
    await unlink(this.resolve(key)).catch(() => undefined);
  }
}

export const storage: StorageAdapter = new LocalDiskStorage(path.resolve(env.STORAGE_DIR));

export const newStorageKey = (tenantId: string, purpose: string, ext: string) =>
  `${tenantId}/${purpose.toLowerCase()}/${new Date().toISOString().slice(0, 7)}/${randomToken(18)}${ext}`;
