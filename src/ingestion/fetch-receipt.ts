import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { safeFetch } from "./fetch-source";

export interface FetchReceipt {
  fetchUrl: string;
  attemptedAt: string; // ISO 8601 when network attempt began
  fetchedAt: string; // ISO 8601 when original content was captured
  lastNetworkValidatedAt?: string; // ISO 8601 when network actually validated 200 or 304 (undefined on offline fallback)
  upstreamPublishedAt?: string; // ISO 8601 from explicit upstream payload (Last-Modified alone is NOT accepted)
  httpStatus: number;
  etag?: string;
  lastModified?: string;
  contentSha256: string;
  byteSize: number;
  headers: Record<string, string>;
  refreshed: boolean;
  source: "network" | "cache" | "offline_cache";
  isFallback?: boolean;
}

export interface CacheMetadata {
  url?: string;
  datasetKind?: string;
  version?: string;
  expectedSize?: number;
  expectedSha256?: string;
  fetchedAt?: string;
}

export interface FetchReceiptOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
  maxBytes?: number;
  etag?: string;
  lastModified?: string;
  upstreamPublishedAt?: string;
  datasetKind?: string;
  version?: string;
  expectedSize?: number;
  expectedSha256?: string;
  cachedMetadata?: CacheMetadata;
  cachedFetchedAt?: string;
  /**
   * BẮT BUỘC: Offline cache CHỈ được phép sử dụng khi truyền cờ rõ ràng.
   * Mặc định là false (phải gọi network thật).
   */
  allowOfflineCache?: boolean;
  cachedArtifactPath?: string;
  cachedUrl?: string;
  cachedSha256?: string;
  fetchFn?: typeof safeFetch;
}

export interface FetchResult {
  receipt: FetchReceipt;
  body: Buffer;
}

interface TrustedReceiptRecord {
  url: string;
  sha256: string;
  byteSize: number;
  fetchedAt: string;
  datasetKind?: string;
  version?: string;
}

const trustedReceiptRegistry = new Map<string, TrustedReceiptRecord>();

export function clearReceiptMetadataRegistry(): void {
  trustedReceiptRegistry.clear();
}

function validateAndResolveCacheContext(
  targetUrl: string,
  cachedContent: Buffer,
  options: FetchReceiptOptions
): {
  contentSha256: string;
  originalFetchedAt: string;
  etag?: string;
  lastModified?: string;
} {
  const contentSha256 = crypto.createHash("sha256").update(cachedContent).digest("hex");

  const fromRegistry = options.etag
    ? trustedReceiptRegistry.get(`${targetUrl}:${options.etag}`)
    : trustedReceiptRegistry.get(`${targetUrl}:${contentSha256}`);

  // 1. URL binding verification (MANDATORY for any cache reuse)
  const boundUrl = options.cachedMetadata?.url ?? options.cachedUrl ?? fromRegistry?.url;
  if (!boundUrl) {
    throw new Error(
      `Cache reuse for ${targetUrl} rejected: missing trusted cached URL binding.`
    );
  }
  if (boundUrl !== targetUrl) {
    throw new Error(
      `Cached metadata URL mismatch: expected ${targetUrl}, found ${boundUrl}`
    );
  }
  if (options.cachedMetadata) {
    if (!options.cachedMetadata.url) {
      throw new Error(`Cached metadata URL missing: expected ${targetUrl}`);
    }
    if (!options.cachedMetadata.version) {
      throw new Error(`Cached metadata version missing: expected ${targetUrl}`);
    }
    if (!options.cachedMetadata.datasetKind) {
      throw new Error(`Cached metadata datasetKind missing: expected ${targetUrl}`);
    }
    if (options.cachedMetadata.expectedSize === undefined) {
      throw new Error(`Cached metadata expectedSize missing: expected ${targetUrl}`);
    }
  }

  // 2. Expected SHA-256 verification
  const expectedSha =
    options.cachedSha256 ||
    options.expectedSha256 ||
    options.cachedMetadata?.expectedSha256 ||
    fromRegistry?.sha256;

  if (!expectedSha) {
    throw new Error(
      `Cache reuse for ${targetUrl} rejected: missing trusted cachedSha256 or digest metadata.`
    );
  }

  if (contentSha256.toLowerCase() !== expectedSha.toLowerCase()) {
    throw new Error(
      `Cache integrity verification failed for ${targetUrl}: content SHA-256 (${contentSha256}) does not match expected cachedSha256 (${expectedSha})`
    );
  }

  // 3. Max bytes limit
  if (options.maxBytes && cachedContent.length > options.maxBytes) {
    throw new Error(
      `Cached content exceeds maxBytes limit: ${cachedContent.length} > ${options.maxBytes}`
    );
  }

  // 4. Expected size verification (MANDATORY for any cache reuse)
  const expectedSize =
    options.expectedSize ??
    options.cachedMetadata?.expectedSize ??
    fromRegistry?.byteSize;

  if (expectedSize === undefined) {
    throw new Error(`Cache reuse for ${targetUrl} rejected: missing mandatory expectedSize binding.`);
  }

  if (cachedContent.length !== expectedSize) {
    throw new Error(
      `Cached content size (${cachedContent.length}) does not match expectedSize (${expectedSize})`
    );
  }

  // 5. Version verification (MANDATORY for any cache reuse)
  const version = options.version ?? options.cachedMetadata?.version ?? fromRegistry?.version;
  if (!version) {
    throw new Error(`Cache reuse for ${targetUrl} rejected: missing mandatory version binding.`);
  }
  if (options.cachedMetadata?.version && options.version && options.cachedMetadata.version !== options.version) {
    throw new Error(
      `Cached metadata version mismatch: expected ${options.version}, found ${options.cachedMetadata.version}`
    );
  }
  if (fromRegistry?.version && options.version && fromRegistry.version !== options.version) {
    throw new Error(
      `Registry version mismatch: expected ${options.version}, found ${fromRegistry.version}`
    );
  }

  // 6. Dataset kind verification (MANDATORY for any cache reuse)
  const datasetKind = options.datasetKind ?? options.cachedMetadata?.datasetKind ?? fromRegistry?.datasetKind;
  if (!datasetKind) {
    throw new Error(`Cache reuse for ${targetUrl} rejected: missing mandatory datasetKind binding.`);
  }
  if (options.cachedMetadata?.datasetKind && options.datasetKind && options.cachedMetadata.datasetKind !== options.datasetKind) {
    throw new Error(
      `Cached metadata datasetKind mismatch: expected ${options.datasetKind}, found ${options.cachedMetadata.datasetKind}`
    );
  }
  if (fromRegistry?.datasetKind && options.datasetKind && fromRegistry.datasetKind !== options.datasetKind) {
    throw new Error(
      `Registry datasetKind mismatch: expected ${options.datasetKind}, found ${fromRegistry.datasetKind}`
    );
  }

  // 7. Provenance Clock (fetchedAt) resolution and validation
  let rawFetchedAt: string | undefined =
    options.cachedFetchedAt ??
    options.cachedMetadata?.fetchedAt ??
    fromRegistry?.fetchedAt;

  if (!rawFetchedAt && options.cachedArtifactPath && fs.existsSync(options.cachedArtifactPath)) {
    const sidecarFile = `${options.cachedArtifactPath}.meta.json`;
    if (fs.existsSync(sidecarFile)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(sidecarFile, "utf8"));
        // Sidecar must match URL, SHA-256, version, and datasetKind
        const sidecarUrlMatches = parsed.url && parsed.url === targetUrl;
        const sidecarSha = (parsed.expectedSha256 || parsed.sha256 || "").toLowerCase();
        const sidecarShaMatches = sidecarSha && sidecarSha === contentSha256.toLowerCase();
        const sidecarVersionMatches = !version || !parsed.version || parsed.version === version;
        const sidecarDatasetMatches = !datasetKind || !parsed.datasetKind || parsed.datasetKind === datasetKind;

        if (sidecarUrlMatches && sidecarShaMatches && sidecarVersionMatches && sidecarDatasetMatches && parsed.fetchedAt) {
          rawFetchedAt = parsed.fetchedAt;
        }
      } catch {}
    }
  }

  if (!rawFetchedAt) {
    throw new Error(
      `Cannot determine trusted original fetchedAt for ${targetUrl}: missing cached metadata, companion record, or registry provenance entry.`
    );
  }

  // Strict ISO 8601 timestamp validation
  const parsedTime = Date.parse(rawFetchedAt);
  if (isNaN(parsedTime) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(rawFetchedAt)) {
    throw new Error(`Invalid original timestamp format: ${rawFetchedAt}`);
  }

  return {
    contentSha256,
    originalFetchedAt: rawFetchedAt,
    etag: options.etag,
    lastModified: options.lastModified
  };
}

function handle304(
  targetUrl: string,
  attemptedAt: string,
  res: any,
  options: FetchReceiptOptions
): FetchResult {
  if (!options.cachedArtifactPath || !fs.existsSync(options.cachedArtifactPath)) {
    throw new Error(
      `HTTP 304 Not Modified received for ${targetUrl} but cachedArtifactPath is missing or not found.`
    );
  }

  const cachedContent = fs.readFileSync(options.cachedArtifactPath);
  const context = validateAndResolveCacheContext(targetUrl, cachedContent, options);

  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(res.headers || {})) {
    if (typeof v === "string") headers[k.toLowerCase()] = v;
    else if (Array.isArray(v)) headers[k.toLowerCase()] = v.join(", ");
  }

  const etag = headers["etag"] || context.etag;
  const lastModified = headers["last-modified"] || context.lastModified;
  const validationTime = new Date().toISOString();

  const receipt: FetchReceipt = {
    fetchUrl: targetUrl,
    attemptedAt,
    fetchedAt: context.originalFetchedAt,
    lastNetworkValidatedAt: validationTime,
    upstreamPublishedAt: options.upstreamPublishedAt, // Last-Modified alone is NOT treated as upstream publication time
    httpStatus: 304,
    etag,
    lastModified,
    contentSha256: context.contentSha256,
    byteSize: cachedContent.length,
    headers,
    refreshed: false,
    source: "cache"
  };

  return { receipt, body: cachedContent };
}

function handleOfflineFallback(
  targetUrl: string,
  attemptedAt: string,
  options: FetchReceiptOptions
): FetchResult {
  if (!options.cachedArtifactPath || !fs.existsSync(options.cachedArtifactPath)) {
    throw new Error(
      `Offline cache requested for ${targetUrl} but cachedArtifactPath is missing or not found.`
    );
  }

  const cachedContent = fs.readFileSync(options.cachedArtifactPath);
  const context = validateAndResolveCacheContext(targetUrl, cachedContent, options);

  const receipt: FetchReceipt = {
    fetchUrl: targetUrl,
    attemptedAt,
    fetchedAt: context.originalFetchedAt,
    lastNetworkValidatedAt: undefined, // Mạng offline: KHÔNG được ngụy tạo timestamp xác thực mạng
    upstreamPublishedAt: options.upstreamPublishedAt, // Last-Modified alone is NOT upstream publication time
    httpStatus: 0,
    etag: context.etag,
    lastModified: context.lastModified,
    contentSha256: context.contentSha256,
    byteSize: cachedContent.length,
    headers: { "x-offline-fallback": "true" },
    refreshed: false,
    source: "offline_cache",
    isFallback: true
  };

  return { receipt, body: cachedContent };
}

function handle200(
  targetUrl: string,
  attemptedAt: string,
  res: any,
  options: FetchReceiptOptions
): FetchResult {
  const fetchedAt = new Date().toISOString();
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(res.headers || {})) {
    if (typeof v === "string") headers[k.toLowerCase()] = v;
    else if (Array.isArray(v)) headers[k.toLowerCase()] = v.join(", ");
  }

  const etag = headers["etag"];
  const lastModified = headers["last-modified"];
  const contentSha256 = crypto.createHash("sha256").update(res.body).digest("hex");

  // Ghi nhận metadata tin cậy vào registry, luôn scope theo targetUrl để ngăn ngừa credential/cache poisoning
  trustedReceiptRegistry.set(`${targetUrl}:${contentSha256}`, {
    url: targetUrl,
    sha256: contentSha256,
    byteSize: res.body.length,
    fetchedAt,
    datasetKind: options.datasetKind,
    version: options.version
  });
  if (etag) {
    trustedReceiptRegistry.set(`${targetUrl}:${etag}`, {
      url: targetUrl,
      sha256: contentSha256,
      byteSize: res.body.length,
      fetchedAt,
      datasetKind: options.datasetKind,
      version: options.version
    });
  }

  const receipt: FetchReceipt = {
    fetchUrl: targetUrl,
    attemptedAt,
    fetchedAt,
    lastNetworkValidatedAt: fetchedAt,
    upstreamPublishedAt: options.upstreamPublishedAt, // Last-Modified alone is NOT upstream publication time
    httpStatus: res.statusCode,
    etag,
    lastModified,
    contentSha256,
    byteSize: res.body.length,
    headers,
    refreshed: true,
    source: "network"
  };

  return { receipt, body: res.body };
}

/**
 * Fetch tài nguyên với receipt xác minh provenance và conditional refresh (ETag / Last-Modified).
 * Offline cache CHỈ được sử dụng khi allowOfflineCache === true.
 * Thất bại mạng hoặc lỗi toàn vẹn 304 xử lý fail-closed triệt để.
 */
export async function fetchWithReceipt(
  targetUrl: string,
  options: FetchReceiptOptions = {}
): Promise<FetchResult> {
  const requestHeaders: Record<string, string> = { ...(options.headers || {}) };

  if (options.etag) {
    requestHeaders["If-None-Match"] = options.etag;
  }
  if (options.lastModified) {
    requestHeaders["If-Modified-Since"] = options.lastModified;
  }

  const attemptedAt = new Date().toISOString();

  let res: any;
  let networkError: any = null;

  try {
    const fetcher = options.fetchFn || safeFetch;
    res = await fetcher(targetUrl, {
      headers: requestHeaders,
      timeoutMs: options.timeoutMs,
      maxBytes: options.maxBytes
    });
  } catch (err: any) {
    networkError = err;
  }

  // Nếu mạng thất bại: CHỈ fallback sang offline cache khi cờ allowOfflineCache === true
  if (networkError) {
    if (options.allowOfflineCache === true) {
      return handleOfflineFallback(targetUrl, attemptedAt, options);
    }
    throw new Error(
      `Không thể tải ${targetUrl} từ mạng và offline cache không được phép (allowOfflineCache=${options.allowOfflineCache}): ${networkError.message}`
    );
  }

  // HTTP 304: Tuyệt đối không swallow lỗi 304 vào offline fallback
  if (res.statusCode === 304) {
    return handle304(targetUrl, attemptedAt, res, options);
  }

  // HTTP 200 / other status
  return handle200(targetUrl, attemptedAt, res, options);
}
