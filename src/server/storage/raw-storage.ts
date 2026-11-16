import fs from "fs";
import path from "path";
import crypto from "crypto";
import { env } from "../config";

export interface PutArtifactResult {
  sha256: string;
  storageKey: string;
  byteSize: number;
  isNew: boolean;
}

export class RawStorage {
  private rootDir: string;

  constructor(rootDir: string = env.RAW_STORAGE_ROOT) {
    this.rootDir = path.resolve(rootDir);
    if (!fs.existsSync(this.rootDir)) {
      fs.mkdirSync(this.rootDir, { recursive: true });
    }
  }

  public getStorageKey(sha256: string, ext: string = "json"): string {
    const prefix = sha256.slice(0, 2);
    return path.join("sha256", prefix, `${sha256}.${ext}`);
  }

  public getAbsolutePath(storageKey: string): string {
    return path.join(this.rootDir, storageKey);
  }

  public exists(storageKey: string): boolean {
    return fs.existsSync(this.getAbsolutePath(storageKey));
  }

  public putIfAbsent(content: Buffer | string, ext: string = "json"): PutArtifactResult {
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8");
    const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
    const storageKey = this.getStorageKey(sha256, ext);
    const absPath = this.getAbsolutePath(storageKey);

    if (fs.existsSync(absPath)) {
      return {
        sha256,
        storageKey,
        byteSize: buffer.length,
        isNew: false
      };
    }

    const dir = path.dirname(absPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write to temporary file in same directory first, then rename atomically
    const tempPath = `${absPath}.${crypto.randomBytes(4).toString("hex")}.tmp`;
    fs.writeFileSync(tempPath, buffer);
    fs.renameSync(tempPath, absPath);

    return {
      sha256,
      storageKey,
      byteSize: buffer.length,
      isNew: true
    };
  }

  public read(storageKey: string): Buffer {
    const absPath = this.getAbsolutePath(storageKey);
    if (!fs.existsSync(absPath)) {
      throw new Error(`Raw artifact not found: ${storageKey}`);
    }
    return fs.readFileSync(absPath);
  }
}

export const rawStorage = new RawStorage();
