import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { fetchWithReceipt } from "@/ingestion/fetch-receipt";

const tempDirs: string[] = [];

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  for (const p of tempDirs.splice(0)) {
    try {
      if (fs.existsSync(p)) {
        fs.rmSync(p, { recursive: true, force: true });
      }
    } catch {}
  }
});

function cached() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "adapted-contract-receipt-"));
  tempDirs.push(dir);
  const file = path.join(dir, "body.txt");
  const body = Buffer.from("known-cache-body");
  fs.writeFileSync(file, body);
  const sha = crypto.createHash("sha256").update(body).digest("hex");
  const metadata = {
    url: "https://example.com/a",
    datasetKind: "real",
    version: "v1",
    expectedSize: body.length,
    expectedSha256: sha,
    fetchedAt: "2026-11-01T00:00:00.000Z"
  };
  return { file, body, sha, metadata };
}

const response = (statusCode = 304, body = Buffer.alloc(0), headers: Record<string, string> = {}) => ({
  statusCode,
  body,
  headers
});

describe("Adapted receipt contracts with complete trusted context", () => {
  it("CONTROL: known intact digest with complete metadata permits a valid 304", async () => {
    const c = cached();
    const r = await fetchWithReceipt("https://example.com/a", {
      cachedArtifactPath: c.file,
      cachedSha256: c.sha,
      cachedMetadata: c.metadata,
      cachedFetchedAt: c.metadata.fetchedAt,
      datasetKind: "real",
      version: "v1",
      expectedSize: c.body.length,
      fetchFn: async () => response() as any
    });
    expect(r.receipt.source).toBe("cache");
    expect(r.body.equals(c.body)).toBe(true);
    expect(r.receipt.fetchedAt).toBe(c.metadata.fetchedAt);
  });

  it("CONTROL: known intact digest with complete metadata permits explicitly allowed offline reuse", async () => {
    const c = cached();
    const r = await fetchWithReceipt("https://example.com/a", {
      cachedArtifactPath: c.file,
      cachedSha256: c.sha,
      cachedMetadata: c.metadata,
      cachedFetchedAt: c.metadata.fetchedAt,
      datasetKind: "real",
      version: "v1",
      expectedSize: c.body.length,
      allowOfflineCache: true,
      fetchFn: async () => {
        throw new Error("offline");
      }
    });
    expect(r.receipt.source).toBe("offline_cache");
    expect(r.body.equals(c.body)).toBe(true);
    expect(r.receipt.fetchedAt).toBe(c.metadata.fetchedAt);
  });

  it("304 without any trusted digest must not certify arbitrary cache bytes", async () => {
    const c = cached();
    await expect(
      fetchWithReceipt("https://example.com/a", {
        cachedArtifactPath: c.file,
        fetchFn: async () => response() as any
      })
    ).rejects.toThrow();
  });

  it("offline fallback must enforce the caller byte limit", async () => {
    const c = cached();
    await expect(
      fetchWithReceipt("https://example.com/a", {
        cachedArtifactPath: c.file,
        cachedSha256: c.sha,
        cachedMetadata: c.metadata,
        cachedFetchedAt: c.metadata.fetchedAt,
        datasetKind: "real",
        version: "v1",
        expectedSize: c.body.length,
        maxBytes: 1,
        allowOfflineCache: true,
        fetchFn: async () => {
          throw new Error("offline");
        }
      })
    ).rejects.toThrow();
  });

  it("a 304 size failure cannot be swallowed into an unchecked offline fallback", async () => {
    const c = cached();
    await expect(
      fetchWithReceipt("https://example.com/a", {
        cachedArtifactPath: c.file,
        cachedSha256: c.sha,
        cachedMetadata: c.metadata,
        cachedFetchedAt: c.metadata.fetchedAt,
        datasetKind: "real",
        version: "v1",
        expectedSize: c.body.length,
        maxBytes: 1,
        allowOfflineCache: true,
        fetchFn: async () => response() as any
      })
    ).rejects.toThrow();
  });

  it("304 reuse must preserve the original body fetch time", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-01T00:00:00Z"));
    const c = cached();
    const original = await fetchWithReceipt("https://example.com/a", {
      fetchFn: async () => response(200, c.body) as any
    });
    vi.setSystemTime(new Date("2026-11-09T00:00:00Z"));
    const revalidated = await fetchWithReceipt("https://example.com/a", {
      cachedArtifactPath: c.file,
      cachedSha256: original.receipt.contentSha256,
      cachedMetadata: {
        url: "https://example.com/a",
        datasetKind: "real",
        version: "v1",
        expectedSize: c.body.length,
        expectedSha256: original.receipt.contentSha256,
        fetchedAt: original.receipt.fetchedAt
      },
      cachedFetchedAt: original.receipt.fetchedAt,
      datasetKind: "real",
      version: "v1",
      expectedSize: c.body.length,
      fetchFn: async () => response() as any
    });
    expect(revalidated.receipt.fetchedAt).toBe(original.receipt.fetchedAt);
  });

  it("offline reuse must preserve the original body fetch time", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-01T00:00:00Z"));
    const c = cached();
    const original = await fetchWithReceipt("https://example.com/a", {
      fetchFn: async () => response(200, c.body) as any
    });
    vi.setSystemTime(new Date("2026-11-09T00:00:00Z"));
    const revalidated = await fetchWithReceipt("https://example.com/a", {
      cachedArtifactPath: c.file,
      cachedSha256: original.receipt.contentSha256,
      cachedMetadata: {
        url: "https://example.com/a",
        datasetKind: "real",
        version: "v1",
        expectedSize: c.body.length,
        expectedSha256: original.receipt.contentSha256,
        fetchedAt: original.receipt.fetchedAt
      },
      cachedFetchedAt: original.receipt.fetchedAt,
      datasetKind: "real",
      version: "v1",
      expectedSize: c.body.length,
      allowOfflineCache: true,
      fetchFn: async () => {
        throw new Error("offline");
      }
    });
    expect(revalidated.receipt.fetchedAt).toBe(original.receipt.fetchedAt);
  });

  it("Last-Modified alone is not evidence of upstream publication time", async () => {
    const r = await fetchWithReceipt("https://example.com/a", {
      fetchFn: async () =>
        response(200, Buffer.from("a"), { "last-modified": "Sun, 08 Nov 2026 00:00:00 GMT" }) as any
    });
    expect(r.receipt.upstreamPublishedAt).toBeUndefined();
  });

  it("304 rejects bytes conflicting with trusted SHA-256", async () => {
    const c = cached();
    const tamperedFile = path.join(path.dirname(c.file), "tampered.txt");
    fs.writeFileSync(tamperedFile, "tampered-content");
    await expect(
      fetchWithReceipt("https://example.com/a", {
        cachedArtifactPath: tamperedFile,
        cachedSha256: c.sha,
        cachedMetadata: c.metadata,
        cachedFetchedAt: c.metadata.fetchedAt,
        datasetKind: "real",
        version: "v1",
        expectedSize: c.body.length,
        fetchFn: async () => response() as any
      })
    ).rejects.toThrow();
  });

  it("offline rejects bytes conflicting with trusted SHA-256", async () => {
    const c = cached();
    const tamperedFile = path.join(path.dirname(c.file), "tampered.txt");
    fs.writeFileSync(tamperedFile, "tampered-content");
    await expect(
      fetchWithReceipt("https://example.com/a", {
        cachedArtifactPath: tamperedFile,
        cachedSha256: c.sha,
        cachedMetadata: c.metadata,
        cachedFetchedAt: c.metadata.fetchedAt,
        datasetKind: "real",
        version: "v1",
        expectedSize: c.body.length,
        allowOfflineCache: true,
        fetchFn: async () => {
          throw new Error("offline");
        }
      })
    ).rejects.toThrow();
  });
});
