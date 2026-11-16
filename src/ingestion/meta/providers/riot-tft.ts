import crypto from "node:crypto";
import {
  CohortSnapshot,
  CohortMember
} from "../../../domain/meta/schemas";

export interface RegionRoutingConfig {
  platform: string;
  regionalRoute: string;
  queue: string;
}

export const REGION_ROUTING: Record<string, RegionRoutingConfig> = {
  KR: { platform: "KR", regionalRoute: "asia", queue: "1100" },
  VN: { platform: "VN2", regionalRoute: "sea", queue: "1100" },
  NA: { platform: "NA1", regionalRoute: "americas", queue: "1100" },
  EUW: { platform: "EUW1", regionalRoute: "europe", queue: "1100" }
};

export interface RiotReceipt {
  url: string;
  fetchedAt: string;
  status: number;
  headers: Record<string, string>;
  body: unknown;
  /** Exact response bytes retained for content-addressed evidence storage. */
  rawBody?: string;
  rawHash: string;
}

export interface RiotCohortFetchResult {
  snapshot: CohortSnapshot;
  receipt: RiotReceipt;
  /** PUUIDs remain in memory for match calls and are never persisted/logged. */
  membersWithPuuid: Array<CohortMember & { puuid: string; regionalRoute: string }>;
}

export interface RiotMatchFetchResult {
  detail: any;
  receipt: RiotReceipt;
}

export class RiotCredentialsError extends Error {
  code = "needs_credentials" as const;
  constructor(message: string) {
    super(message);
    this.name = "RiotCredentialsError";
  }
}

export interface RiotTftProviderOptions {
  apiKey?: string;
  accountKeySecret?: string;
  fetchImpl?: typeof fetch;
  maxRetries?: number;
  sleep?: (ms: number) => Promise<void>;
}

function headerRecord(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    if (["etag", "last-modified", "retry-after", "content-type"].includes(key.toLowerCase())) out[key.toLowerCase()] = value;
  });
  return out;
}

export function accountKeyForPuuid(puuid: string, secret = process.env.ACCOUNT_KEY_HMAC_SECRET): string {
  if (!secret || secret.trim().length < 16) {
    throw new RiotCredentialsError("ACCOUNT_KEY_HMAC_SECRET chưa được cấu hình (needs_credentials); không thể định danh tài khoản Riot an toàn.");
  }
  if (!puuid || puuid.trim().length < 8) throw new Error("Riot API trả về PUUID rỗng hoặc không hợp lệ; bản ghi bị từ chối.");
  const digest = crypto.createHmac("sha256", secret).update(puuid, "utf8").digest("hex");
  return `riot_${digest}`;
}

export class RiotTftProvider {
  apiKey: string | null;
  private readonly accountKeySecret: string | null;
  private readonly fetchImpl: typeof fetch;
  private readonly maxRetries: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(options: string | RiotTftProviderOptions = {}) {
    const normalized: RiotTftProviderOptions = typeof options === "string" ? { apiKey: options } : options;
    this.apiKey = normalized.apiKey || process.env.RIOT_API_KEY || null;
    this.accountKeySecret = normalized.accountKeySecret || process.env.ACCOUNT_KEY_HMAC_SECRET || null;
    this.fetchImpl = normalized.fetchImpl || fetch;
    this.maxRetries = Math.max(0, Math.min(normalized.maxRetries ?? 3, 5));
    this.sleep = normalized.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  hasAccountKeySecret(): boolean {
    return Boolean(this.accountKeySecret && this.accountKeySecret.trim().length >= 16);
  }

  private requireApiKey(): void {
    if (!this.isConfigured()) {
      throw new RiotCredentialsError("[RiotTftProvider] RIOT_API_KEY chưa được cấu hình (needs_credentials). Không thể thu thập dữ liệu Riot thật.");
    }
  }

  private requireAccountSecret(): void {
    if (!this.hasAccountKeySecret()) {
      throw new RiotCredentialsError("[RiotTftProvider] ACCOUNT_KEY_HMAC_SECRET chưa được cấu hình (needs_credentials). Không thể thu thập dữ liệu Riot thật.");
    }
  }

  private accountKey(puuid: string): string {
    return accountKeyForPuuid(puuid, this.accountKeySecret || undefined);
  }

  private async requestJson(url: string): Promise<RiotReceipt> {
    this.requireApiKey();
    let lastStatus = 0;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const response = await this.fetchImpl(url, {
        headers: { "X-Riot-Token": this.apiKey! },
        signal: AbortSignal.timeout(30_000)
      });
      lastStatus = response.status;
      if (response.ok) {
        const rawBody = await response.text();
        const body = JSON.parse(rawBody);
        const rawHash = crypto.createHash("sha256").update(rawBody, "utf8").digest("hex");
        return {
          url,
          fetchedAt: new Date().toISOString(),
          status: response.status,
          headers: headerRecord(response.headers),
          body,
          rawBody,
          rawHash
        };
      }

      const retryable = response.status === 429 || response.status === 408 || response.status >= 500;
      if (!retryable || attempt >= this.maxRetries) break;
      const retryAfterHeader = response.headers.get("retry-after");
      const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : Number.NaN;
      const retryAfterMs = Number.isFinite(retryAfterSeconds)
        ? Math.max(250, Math.min(retryAfterSeconds * 1000, 10_000))
        : Math.min(5_000, 250 * 2 ** attempt);
      await this.sleep(retryAfterMs);
    }
    throw new Error(`[RiotTftProvider] Riot API request thất bại (${lastStatus}); đã thử tối đa ${this.maxRetries + 1} lần.`);
  }

  async fetchCohortSnapshotWithReceipt(region: string, topN = 50): Promise<RiotCohortFetchResult> {
    const route = REGION_ROUTING[region];
    if (!route) throw new Error(`Khu vực không hợp lệ hoặc chưa hỗ trợ: ${region}`);
    this.requireApiKey();
    this.requireAccountSecret();

    const leagueUrl = `https://${route.platform.toLowerCase()}.api.riotgames.com/tft/league/v1/challenger`;
    const leagueReceipt = await this.requestJson(leagueUrl);
    const data = leagueReceipt.body as any;
    const entries = Array.isArray(data?.entries) ? [...data.entries] : [];
    entries.sort((a: any, b: any) => Number(b.leaguePoints || 0) - Number(a.leaguePoints || 0));
    // FIN-05: Hỗ trợ cohort đầy đủ lên tới Top 200 Thách Đấu theo yêu cầu phạm vi
    const topEntries = entries.slice(0, Math.max(1, Math.min(topN, 200)));
    const snapshotId = `cohort_${region.toLowerCase()}_${leagueReceipt.rawHash.slice(0, 16)}`;

    const membersWithPuuid: Array<CohortMember & { puuid: string; regionalRoute: string }> = [];
    for (let index = 0; index < topEntries.length; index++) {
      const entry = topEntries[index];
      let puuid = typeof entry.puuid === "string" ? entry.puuid : "";
      // League-v1 responses often expose summonerId rather than PUUID. Resolve
      // it through summoner-v4; never derive or fabricate a PUUID.
      if (!puuid && entry.summonerId) {
        const summonerUrl = `https://${route.platform.toLowerCase()}.api.riotgames.com/lol/summoner/v4/summoners/${encodeURIComponent(entry.summonerId)}`;
        const summonerReceipt = await this.requestJson(summonerUrl);
        const resolved = (summonerReceipt.body as any)?.puuid;
        if (typeof resolved === "string") puuid = resolved;
      }
      if (!puuid) throw new Error(`[RiotTftProvider] Riot API không trả PUUID cho cohort ${region} ở vị trí ${index + 1}; cohort bị từ chối, không bịa dữ liệu.`);
      const accountKey = this.accountKey(puuid);
      membersWithPuuid.push({
        snapshotId,
        accountKey,
        puuid,
        regionalRoute: route.regionalRoute,
        summonerName: typeof entry.summonerName === "string" ? entry.summonerName : "",
        riotIdName: typeof entry.riotIdName === "string" ? entry.riotIdName : "",
        riotIdTag: typeof entry.riotIdTagline === "string" ? entry.riotIdTagline : "",
        rank: "CHALLENGER",
        leaguePoints: Number.isFinite(Number(entry.leaguePoints)) ? Number(entry.leaguePoints) : 0,
        leaderboardRank: index + 1
      });
    }

    return {
      snapshot: {
        id: snapshotId,
        region,
        capturedAt: leagueReceipt.fetchedAt,
        topN: topEntries.length,
        queue: route.queue,
        sourceUrl: leagueUrl,
        rawArtifactId: `riot_cohort_${region.toLowerCase()}_${leagueReceipt.rawHash}`,
        fetchedAt: leagueReceipt.fetchedAt,
        members: membersWithPuuid.map(({ regionalRoute: _route, ...member }) => member)
      },
      receipt: leagueReceipt,
      membersWithPuuid
    };
  }

  async fetchCohortSnapshot(region: string, topN = 50): Promise<CohortSnapshot> {
    return (await this.fetchCohortSnapshotWithReceipt(region, topN)).snapshot;
  }

  async fetchMatchIds(regionalRoute: string, puuid: string, count = 20): Promise<string[]> {
    const queryCount = Math.max(1, Math.min(Math.floor(count), 100));
    const url = `https://${regionalRoute.toLowerCase()}.api.riotgames.com/tft/match/v1/matches/by-puuid/${encodeURIComponent(puuid)}/ids?count=${queryCount}`;
    const receipt = await this.requestJson(url);
    return Array.isArray(receipt.body) ? (receipt.body as string[]).filter((id) => typeof id === "string" && id.length > 0) : [];
  }

  async fetchMatchDetailWithReceipt(regionalRoute: string, matchId: string): Promise<RiotMatchFetchResult> {
    if (!matchId || /[^a-zA-Z0-9_:-]/.test(matchId)) throw new Error("Match ID Riot không hợp lệ; bỏ qua request.");
    const url = `https://${regionalRoute.toLowerCase()}.api.riotgames.com/tft/match/v1/matches/${encodeURIComponent(matchId)}`;
    const receipt = await this.requestJson(url);
    return { detail: receipt.body, receipt };
  }

  async fetchMatchDetail(regionalRoute: string, matchId: string): Promise<any> {
    return (await this.fetchMatchDetailWithReceipt(regionalRoute, matchId)).detail;
  }
}

export const riotTftProvider = new RiotTftProvider();
