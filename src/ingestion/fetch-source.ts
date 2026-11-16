import https from "https";
import http from "http";
import { URL } from "url";
import { env } from "../server/config";

export interface SafeFetchOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
  maxBytes?: number;
  maxRetries?: number;
}

export interface SafeFetchResponse {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: Buffer;
}

export async function safeFetch(targetUrl: string, options: SafeFetchOptions = {}): Promise<SafeFetchResponse> {
  const timeoutMs = options.timeoutMs || env.FETCH_TIMEOUT_MS;
  const maxBytes = options.maxBytes || env.FETCH_MAX_BYTES;
  const maxRetries = options.maxRetries ?? 3;

  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt < maxRetries) {
    attempt++;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(new Error(`Request timed out after ${timeoutMs}ms`)), timeoutMs);

      const res = await fetch(targetUrl, {
        headers: {
          "User-Agent": "TFT-18-Change-Tracker/1.0",
          "Accept": "application/json, text/plain, */*",
          ...options.headers
        },
        signal: controller.signal
      });

      clearTimeout(timer);

      if (!res.ok && res.status >= 500) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const arrayBuffer = await res.arrayBuffer();
      if (arrayBuffer.byteLength > maxBytes) {
        throw new Error(`Payload exceeded max bytes limit (${maxBytes} bytes)`);
      }

      const headers: Record<string, string> = {};
      res.headers.forEach((v, k) => {
        headers[k] = v;
      });

      return {
        statusCode: res.status,
        headers,
        body: Buffer.from(arrayBuffer)
      };
    } catch (err: any) {
      lastError = err;
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 300, 5000);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw lastError || new Error(`Failed to fetch ${targetUrl}`);
}
