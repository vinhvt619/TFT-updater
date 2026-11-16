import { AsyncLocalStorage } from "node:async_hooks";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import { sql } from "drizzle-orm";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import * as schema from "./schema";
import { env } from "../config";
import { applySchemaDdl } from "./schema-ddl";
import { seedTestBaseline } from "./baseline-seed";

const { Pool } = pg;

export interface DatabaseHealthInfo {
  healthy: boolean;
  engine: "postgres" | "pglite";
  dataDir?: string;
  error?: string;
}

const txContext = new AsyncLocalStorage<{ isAdmitted: boolean }>();

export class DatabaseRuntime {
  private static instance: DatabaseRuntime | null = null;

  private pgliteInstance: PGlite | null = null;
  private poolInstance: pg.Pool | null = null;
  private drizzleInstance: any = null;
  private isPglite = false;
  private activeDataDir: string | null = null;
  private isTestEnvironment = false;
  private testTempDir: string | null = null;
  private initPromise: Promise<any> | null = null;
  private activeWorkCount = 0;
  private idleWaiters: Array<() => void> = [];
  private ownsActiveLock = false;
  private readonly instanceToken = crypto.randomUUID();
  private isShuttingDown = false;
  private isBlockedBackend = false;
  private blockedError: Error | null = null;

  private constructor() {
    this.isTestEnvironment = Boolean(
      process.env.VITEST || process.env.NODE_ENV === "test"
    );
  }

  public static getInstance(): DatabaseRuntime {
    if (!DatabaseRuntime.instance) {
      DatabaseRuntime.instance = new DatabaseRuntime();
    }
    return DatabaseRuntime.instance;
  }

  public beginWork(): () => void {
    const inAdmittedTx = txContext.getStore()?.isAdmitted;
    if (this.isShuttingDown && !inAdmittedTx) {
      throw new Error("DatabaseRuntime is shutting down: rejecting new work");
    }
    this.activeWorkCount++;
    let released = false;
    return () => {
      if (!released) {
        released = true;
        this.activeWorkCount = Math.max(0, this.activeWorkCount - 1);
        if (this.activeWorkCount === 0 && this.idleWaiters.length > 0) {
          const waiters = this.idleWaiters.splice(0);
          for (const wake of waiters) {
            wake();
          }
        }
      }
    };
  }

  public getActiveWorkCount(): number {
    return this.activeWorkCount;
  }

  public async drain(timeoutMs = 5000): Promise<void> {
    const start = Date.now();
    while (this.activeWorkCount > 0 && Date.now() - start < timeoutMs) {
      await new Promise<void>((resolve) => {
        let settled = false;
        const finish = () => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve();
          }
        };
        const timer = setTimeout(finish, 20);
        this.idleWaiters.push(finish);
      });
    }
    if (this.activeWorkCount > 0) {
      throw new Error(
        `[DatabaseRuntime] Drain timed out after ${timeoutMs}ms with ${this.activeWorkCount} active operations`
      );
    }
  }

  public getDataDir(): string {
    const testActive = Boolean(process.env.VITEST || process.env.NODE_ENV === "test");

    if (testActive) {
      if (process.env.PGDATA_DIR) {
        const resolved = path.resolve(process.env.PGDATA_DIR);
        const prodDir = path.resolve("./storage/pgdata");
        const ciDir = path.resolve("./storage/pgdata-ci-test");

        const normalized = resolved.replace(/\\/g, "/").toLowerCase();
        const isUserRuntime =
          resolved.toLowerCase() === prodDir.toLowerCase() ||
          resolved.toLowerCase() === ciDir.toLowerCase() ||
          normalized.endsWith("/storage/pgdata") ||
          normalized.endsWith("/storage/pgdata-ci-test");

        const hasUserSentinel = fs.existsSync(path.join(resolved, "do-not-touch"));
        const dirExists = fs.existsSync(resolved);
        const dirEntries = dirExists ? fs.readdirSync(resolved) : [];
        const hasPgVersion = fs.existsSync(path.join(resolved, "PG_VERSION"));
        const nonTestEntries = dirEntries.filter(
          (e) => e !== ".test-owned" && e !== "tft-owner.pid"
        );
        const hasUnrelatedUserData = nonTestEntries.length > 0;

        const runnerDir = process.env.TFT_TEST_RUNNER_DIR
          ? path.resolve(process.env.TFT_TEST_RUNNER_DIR).toLowerCase()
          : null;
        const isVerifiedRunnerDir = runnerDir ? resolved.toLowerCase() === runnerDir : false;

        // If directory already contains an existing database (PG_VERSION) or unrelated user data,
        // it is strictly protected and redirected unless explicitly allocated by the test runner.
        if (!isUserRuntime && !hasUserSentinel) {
          if (hasPgVersion || hasUnrelatedUserData) {
            if (isVerifiedRunnerDir) {
              return resolved;
            }
          } else {
            // Fresh directory or test-allocated lease fixture
            return resolved;
          }
        }
      }

      // Automatically isolate tests into a fresh dedicated temporary directory
      if (!this.testTempDir) {
        const poolId = process.env.VITEST_POOL_ID || process.env.VITEST_WORKER_ID || "0";
        const uniqueId = `${Date.now()}-${process.pid}-${poolId}-${Math.random().toString(36).slice(2, 6)}`;
        this.testTempDir = path.join(os.tmpdir(), `tft-pglite-test-${uniqueId}`);
      }
      return this.testTempDir;
    }

    if (process.env.PGDATA_DIR) {
      return path.resolve(process.env.PGDATA_DIR);
    }
    return path.resolve("./storage/pgdata");
  }

  public cleanStaleLocks(dataDir: string): void {
    try {
      if (!this.ownsActiveLock || !fs.existsSync(dataDir)) return;

      const postmasterFile = path.join(dataDir, "postmaster.pid");
      if (fs.existsSync(postmasterFile)) {
        try {
          const raw = fs.readFileSync(postmasterFile, "utf8");
          const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
          const pid = parseInt(lines[0] || "", 10);
          if (pid === -42) {
            fs.unlinkSync(postmasterFile);
          }
        } catch {}
      }

      const files = fs.readdirSync(dataDir);
      for (const f of files) {
        if (f.startsWith(".s.PGSQL.") && f.includes(".lock")) {
          try {
            fs.unlinkSync(path.join(dataDir, f));
          } catch {}
        }
      }
    } catch {
      // Ignore lock cleanup exceptions
    }
  }

  private getExternalOwnerFile(targetDir: string): string {
    const resolved = path.resolve(targetDir);
    return path.join(path.dirname(resolved), `.${path.basename(resolved)}.owner.stash`);
  }

  private verifyOwnerFile(filePath: string, targetDir: string): { pid: number; token: string } | null {
    if (!fs.existsSync(filePath)) return null;
    let raw = "";
    try {
      raw = fs.readFileSync(filePath, "utf8");
    } catch {
      throw new Error(
        `[DatabaseRuntime] Target data directory ${targetDir} is already locked by an unreadable lock record (${path.basename(filePath)}). Concurrent access refused.`
      );
    }
    const lines = raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const pidStr = lines[0] || "";
    const token = lines[1] || "";
    const pid = /^\d+$/.test(pidStr) ? Number(pidStr) : NaN;
    if (
      Number.isInteger(pid) &&
      pid === process.pid &&
      token.length > 0 &&
      token === this.instanceToken
    ) {
      return { pid, token };
    }
    throw new Error(
      `[DatabaseRuntime] Target data directory ${targetDir} is already locked by active or unverifiable owner (${path.basename(filePath)}: ${pidStr || "unknown"}). Concurrent access refused.`
    );
  }

  public checkSingleOwner(targetDir: string): void {
    const externalOwnerFile = this.getExternalOwnerFile(targetDir);
    const ownerFile = path.join(targetDir, "tft-owner.pid");
    const postmasterFile = path.join(targetDir, "postmaster.pid");

    this.verifyOwnerFile(externalOwnerFile, targetDir);
    this.verifyOwnerFile(ownerFile, targetDir);

    if (fs.existsSync(postmasterFile)) {
      let raw = "";
      try {
        raw = fs.readFileSync(postmasterFile, "utf8");
      } catch {
        throw new Error(
          `[DatabaseRuntime] Target data directory ${targetDir} is already locked by unreadable native owner (${path.basename(postmasterFile)}). Concurrent access refused.`
        );
      }
      const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const pidStr = lines[0] || "";
      if (!/^\d+$/.test(pidStr)) {
        throw new Error(
          `[DatabaseRuntime] Target data directory ${targetDir} is already locked by malformed or unverifiable native owner (${path.basename(postmasterFile)}: ${pidStr || "unknown"}). Concurrent access refused.`
        );
      }
      const pid = Number(pidStr);
      if (pid !== process.pid) {
        let isAlive = false;
        try {
          process.kill(pid, 0);
          isAlive = true;
        } catch (killErr: any) {
          if (killErr && killErr.code === "ESRCH") {
            isAlive = false;
          } else {
            // EPERM or any other error means process exists or permission denied -> fail closed!
            isAlive = true;
          }
        }
        if (isAlive) {
          throw new Error(
            `[DatabaseRuntime] Target data directory ${targetDir} is already locked by active PostgreSQL postmaster (pid: ${pid}). Concurrent access refused.`
          );
        }
      }
    }
  }

  public acquireOwner(targetDir: string): void {
    this.checkSingleOwner(targetDir);

    const externalOwnerFile = this.getExternalOwnerFile(targetDir);
    const ownerFile = path.join(targetDir, "tft-owner.pid");
    const payload = `${process.pid}\n${this.instanceToken}\n${new Date().toISOString()}`;

    const externalParent = path.dirname(externalOwnerFile);
    if (!fs.existsSync(externalParent)) {
      fs.mkdirSync(externalParent, { recursive: true });
    }

    let createdExternal = false;
    try {
      fs.writeFileSync(externalOwnerFile, payload, { flag: "wx" });
      this.ownsActiveLock = true;
      createdExternal = true;
    } catch (err: any) {
      if (err && err.code === "EEXIST") {
        this.verifyOwnerFile(externalOwnerFile, targetDir);
        this.ownsActiveLock = true;
      } else {
        throw err;
      }
    }

    try {
      this.verifyOwnerFile(ownerFile, targetDir);
    } catch (reverifyErr) {
      if (createdExternal) {
        try {
          fs.unlinkSync(externalOwnerFile);
        } catch {}
        this.ownsActiveLock = false;
      }
      throw reverifyErr;
    }

    if (fs.existsSync(path.join(targetDir, "PG_VERSION"))) {
      try {
        fs.writeFileSync(ownerFile, payload, { flag: "wx" });
      } catch (err: any) {
        if (err && err.code === "EEXIST") {
          this.verifyOwnerFile(ownerFile, targetDir);
        } else {
          throw err;
        }
      }
    }
  }

  public releaseOwner(targetDir: string): void {
    if (!this.ownsActiveLock) {
      return;
    }
    const externalOwnerFile = this.getExternalOwnerFile(targetDir);
    const ownerFile = path.join(targetDir, "tft-owner.pid");
    const safeUnlink = (filePath: string) => {
      try {
        if (fs.existsSync(filePath)) {
          const verified = this.verifyOwnerFile(filePath, targetDir);
          if (verified && verified.pid === process.pid && verified.token === this.instanceToken) {
            fs.unlinkSync(filePath);
          }
        }
      } catch {}
    };
    safeUnlink(ownerFile);
    safeUnlink(externalOwnerFile);
    this.ownsActiveLock = false;
  }
  public async initializePglite(targetDir: string, maxRetries = 2): Promise<PGlite> {
    if (this.isBlockedBackend || (this.pgliteInstance && !(this.pgliteInstance as any).closed && !this.drizzleInstance)) {
      throw (
        this.blockedError ||
        new Error(
          `[DatabaseRuntime] Target data directory ${targetDir} has an unclosed failed engine. Concurrent or new attach blocked. Operator repair required.`
        )
      );
    }

    this.checkSingleOwner(targetDir);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    this.acquireOwner(targetDir);
    this.activeDataDir = targetDir;
    this.cleanStaleLocks(targetDir);

    const ownerFile = path.join(targetDir, "tft-owner.pid");
    const payload = `${process.pid}\n${this.instanceToken}\n${new Date().toISOString()}`;

    const releaseInitWork = this.beginWork();
    try {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        let instance: PGlite | null = null;
        try {
          instance = new PGlite(targetDir);
          this.pgliteInstance = instance;

          let timeoutHandle: NodeJS.Timeout | null = null;
          try {
            await Promise.race([
              instance.waitReady,
              new Promise((_, reject) => {
                timeoutHandle = setTimeout(
                  () => reject(new Error("PGlite waitReady timed out after 8000ms")),
                  8000
                );
              })
            ]);
          } finally {
            if (timeoutHandle) {
              clearTimeout(timeoutHandle);
            }
          }

          try {
            if (fs.existsSync(ownerFile)) {
              this.verifyOwnerFile(ownerFile, targetDir);
            } else {
              fs.writeFileSync(ownerFile, payload, { flag: "wx" });
            }
          } catch (ownerWriteErr) {
            throw ownerWriteErr;
          }

          if (typeof instance.query === 'function') {
            const originalQuery = instance.query.bind(instance);
            instance.query = (async (...args: any[]) => {
              const release = this.beginWork();
              try {
                return await (originalQuery as any)(...args);
              } finally {
                release();
              }
            }) as any;
          }
          if (typeof instance.exec === 'function') {
            const originalExec = instance.exec.bind(instance);
            instance.exec = (async (...args: any[]) => {
              const release = this.beginWork();
              try {
                return await (originalExec as any)(...args);
              } finally {
                release();
              }
            }) as any;
          }

          return instance;
        } catch (err: any) {
          console.warn(`[DatabaseRuntime] Init attempt ${attempt} on ${targetDir} failed: ${err.message}`);

          if (instance) {
            if (!(instance as any).closed) {
              if (typeof (instance as any).close !== "function") {
                this.pgliteInstance = instance;
                this.isBlockedBackend = true;
                this.blockedError = new Error(
                  `[DatabaseRuntime] Database unreachable at ${targetDir}: ${err.message} (unready instance cannot be closed). Operator repair required.`
                );
                throw this.blockedError;
              }
              try {
                await instance.close();
              } catch (closeErr: any) {
                this.pgliteInstance = instance;
                this.isBlockedBackend = true;
                this.blockedError = new Error(
                  `[DatabaseRuntime] Database unreachable at ${targetDir}: ${err.message} (failed to close unready instance: ${closeErr.message}). Operator repair required.`
                );
                throw this.blockedError;
              }
            }
            if ((instance as any).closed === false) {
              this.pgliteInstance = instance;
              this.isBlockedBackend = true;
              this.blockedError = new Error(
                `[DatabaseRuntime] Database unreachable at ${targetDir}: ${err.message} (prior instance remains open). Operator repair required.`
              );
              throw this.blockedError;
            }
            if (this.pgliteInstance === instance) {
              this.pgliteInstance = null;
            }
          }

          this.cleanStaleLocks(targetDir);

          if (attempt === maxRetries || this.isShuttingDown) {
            throw new Error(`[DatabaseRuntime] Database unreachable at ${targetDir}: ${err.message}. Operator repair required.`);
          }
          await new Promise((r) => setTimeout(r, 500));
        }
      }
      throw new Error(`Failed to initialize PGlite at ${targetDir}`);
    } finally {
      releaseInitWork();
    }
  }
  public async getDb(): Promise<any> {
    if (this.isShuttingDown) {
      throw new Error("[DatabaseRuntime] Database is shutting down. New access rejected.");
    }

    if (this.isBlockedBackend) {
      throw (
        this.blockedError ||
        new Error(
          `[DatabaseRuntime] Database backend is blocked due to unclosed failed instance. Operator repair required.`
        )
      );
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    if (this.drizzleInstance) {
      if (this.isPglite && this.pgliteInstance && (this.pgliteInstance as any).closed) {
        this.drizzleInstance = null;
        this.pgliteInstance = null;
      } else {
        return this.drizzleInstance;
      }
    }

    const releaseInitWork = this.beginWork();
    const currentInitPromise = txContext.run({ isAdmitted: true }, async () => {
      let allocatedPglite: PGlite | null = null;
      let targetDir = "";
      try {
        // 1. Try real PostgreSQL if configured and not test and not explicit PGlite
        if (
          !this.isTestEnvironment &&
          env.DATABASE_URL &&
          env.USE_PGLITE !== "true"
        ) {
          try {
            const pool = new Pool({
              connectionString: env.DATABASE_URL,
              connectionTimeoutMillis: 2000
            });
            const client = await pool.connect();
            client.release();
            this.poolInstance = pool;
            this.isPglite = false;
            const drizzle = drizzlePg(pool, { schema });
            const origPgTx = drizzle.transaction.bind(drizzle);
            drizzle.transaction = (async (cb: any, config?: any) => {
              const release = this.beginWork();
              return txContext.run({ isAdmitted: true }, async () => {
                try {
                  return await origPgTx(cb, config);
                } finally {
                  release();
                }
              });
            }) as any;
            this.drizzleInstance = drizzle;
            return this.drizzleInstance;
          } catch (err: any) {
            if (process.env.NODE_ENV === "production") {
              throw new Error(`[DatabaseRuntime] Production connection to PostgreSQL failed (${err.message}). Refusing silent fallback to unseeded local PGlite.`);
            }
            console.warn(`[DatabaseRuntime] Could not connect to PostgreSQL (${err.message}). Using PGlite.`);
          }
        }

        // 2. PGlite Mode
        this.isPglite = true;
        targetDir = this.getDataDir();
        this.activeDataDir = targetDir;

        const schemaReadyMarker = path.join(targetDir, ".schema-ready");
        const dirEntries = fs.existsSync(targetDir) ? fs.readdirSync(targetDir) : [];
        const nonMetaEntries = dirEntries.filter(
          (e) => e !== ".test-owned" && e !== "tft-owner.pid" && !e.startsWith(".s.PGSQL.")
        );
        const isFreshDir =
          !fs.existsSync(schemaReadyMarker) &&
          (nonMetaEntries.length === 0 || !fs.existsSync(path.join(targetDir, "PG_VERSION")));
        const isFreshTestDir = (this.isTestEnvironment || Boolean(process.env.VITEST)) && isFreshDir;

        const pglite = await this.initializePglite(targetDir);
        allocatedPglite = pglite;
        const drizzle = drizzlePglite(pglite, { schema });
        const origPgliteTx = drizzle.transaction.bind(drizzle);
        drizzle.transaction = (async (cb: any, config?: any) => {
          const release = this.beginWork();
          return txContext.run({ isAdmitted: true }, async () => {
            try {
              return await origPgliteTx(cb, config);
            } finally {
              release();
            }
          });
        }) as any;

        try {
          fs.writeFileSync(path.join(targetDir, ".test-owned"), "true");
        } catch {}

        // Apply schema DDL for fresh directory
        if (isFreshDir) {
          await applySchemaDdl(pglite);
          try {
            fs.writeFileSync(schemaReadyMarker, "true");
          } catch {}
        }
        // Strictly guard test baseline seed: only in test environment and NEVER in real data mode
        if (isFreshTestDir && process.env.DATA_MODE !== "real") {
          await seedTestBaseline(drizzle);
        }

        // Expose handles only after all initialization succeeds
        this.pgliteInstance = pglite;
        this.drizzleInstance = drizzle;
        return this.drizzleInstance;
      } catch (err: any) {
        this.drizzleInstance = null;
        if (allocatedPglite && !(allocatedPglite as any).closed) {
          if (typeof (allocatedPglite as any).close === "function") {
            try {
              await allocatedPglite.close();
            } catch (closeErr: any) {
              this.pgliteInstance = allocatedPglite;
              this.isBlockedBackend = true;
              this.blockedError = new Error(
                `[DatabaseRuntime] Database unreachable at ${this.activeDataDir || targetDir}: ${err.message} (failed to close unready instance: ${closeErr.message}). Operator repair required.`
              );
              throw this.blockedError;
            }
          }
        }
        if (this.pgliteInstance === allocatedPglite && (allocatedPglite as any)?.closed === false) {
          this.isBlockedBackend = true;
          this.blockedError = err;
        } else if (this.pgliteInstance === allocatedPglite) {
          this.pgliteInstance = null;
        }
        throw err;
      } finally {
        releaseInitWork();
      }
    });
    this.initPromise = currentInitPromise;

    try {
      return await currentInitPromise;
    } finally {
      if (this.initPromise === currentInitPromise) {
        this.initPromise = null;
      }
    }
  }

  public async close(): Promise<void> {
    this.isShuttingDown = true;
    await this.drain(3000);
    if (this.initPromise) {
      await this.initPromise.catch(() => {});
    }

    if (this.pgliteInstance && !(this.pgliteInstance as any).closed) {
      await this.pgliteInstance.close();
    }

    if (this.poolInstance) {
      await this.poolInstance.end();
    }

    if (this.activeDataDir) {
      this.cleanStaleLocks(this.activeDataDir);
      this.releaseOwner(this.activeDataDir);
    }

    this.pgliteInstance = null;
    this.poolInstance = null;
    this.drizzleInstance = null;
    this.initPromise = null;
    this.isShuttingDown = false;
    this.isBlockedBackend = false;
    this.blockedError = null;

    // If this was a test run with a temp dir, clean up completely
    const isTest = this.isTestEnvironment || Boolean(process.env.VITEST);
    if (isTest && this.testTempDir) {
      try {
        if (fs.existsSync(this.testTempDir)) {
          fs.rmSync(this.testTempDir, { recursive: true, force: true });
        }
      } catch {}
      this.testTempDir = null;
    }
  }

  public async checkHealth(): Promise<DatabaseHealthInfo> {
    try {
      const db = await this.getDb();
      if (this.isPglite && this.pgliteInstance) {
        await this.pgliteInstance.query("SELECT 1 as val");
      } else if (this.poolInstance) {
        await this.poolInstance.query("SELECT 1 as val");
      }
      return {
        healthy: true,
        engine: this.isPglite ? "pglite" : "postgres",
        dataDir: this.activeDataDir || this.getDataDir()
      };
    } catch (err: any) {
      return {
        healthy: false,
        engine: this.isPglite ? "pglite" : "postgres",
        dataDir: this.activeDataDir || this.getDataDir(),
        error: err.message
      };
    }
  }

  public async getFingerprint(): Promise<{
    engine: string;
    schemaVersion: string;
    tableCounts: Record<string, number>;
    currentPointers: Record<string, string>;
    latestSnapshotId: string | null;
    hash: string;
  }> {
    const db = await this.getDb();
    const counts: Record<string, number> = {};

    const tableNames = [
      "meta_archetypes",
      "meta_source_comp_observations",
      "meta_source_comp_builds",
      "meta_ranking_snapshots",
      "meta_current_ranking_pointers",
      "releases",
      "collection_run_ledger"
    ];

    for (const tbl of tableNames) {
      try {
        let res: any;
        if (this.isPglite && this.pgliteInstance) {
          res = await this.pgliteInstance.query(`SELECT COUNT(*)::int as count FROM ${tbl}`);
        } else if (this.poolInstance) {
          res = await this.poolInstance.query(`SELECT COUNT(*)::int as count FROM ${tbl}`);
        } else {
          res = await db.execute(sql.raw(`SELECT COUNT(*)::int as count FROM ${tbl}`));
        }
        const rows = Array.isArray(res) ? res : res?.rows || [];
        counts[tbl] = Number(rows[0]?.count ?? 0);
      } catch {
        counts[tbl] = 0;
      }
    }

    const currentPointers: Record<string, string> = {};
    try {
      let ptrRes: any;
      if (this.isPglite && this.pgliteInstance) {
        ptrRes = await this.pgliteInstance.query("SELECT id, ranking_snapshot_id FROM meta_current_ranking_pointers");
      } else {
        ptrRes = await db.execute(sql.raw("SELECT id, ranking_snapshot_id FROM meta_current_ranking_pointers"));
      }
      const ptrRows = Array.isArray(ptrRes) ? ptrRes : ptrRes?.rows || [];
      for (const r of ptrRows.sort((a: any, b: any) => String(a.id).localeCompare(String(b.id)))) {
        currentPointers[r.id] = r.ranking_snapshot_id;
      }
    } catch {}

    let latestSnapshotId: string | null = null;
    try {
      let snapRes: any;
      if (this.isPglite && this.pgliteInstance) {
        snapRes = await this.pgliteInstance.query("SELECT id FROM meta_ranking_snapshots ORDER BY created_at DESC LIMIT 1");
      } else {
        snapRes = await db.execute(sql.raw("SELECT id FROM meta_ranking_snapshots ORDER BY created_at DESC LIMIT 1"));
      }
      const snapRows = Array.isArray(snapRes) ? snapRes : snapRes?.rows || [];
      if (snapRows.length > 0) latestSnapshotId = snapRows[0].id;
    } catch {}

    const hashPayload = JSON.stringify({
      engine: this.isPglite ? "pglite" : "postgres",
      schemaVersion: "round-11",
      counts,
      currentPointers,
      latestSnapshotId
    });
    const hash = crypto.createHash("sha256").update(hashPayload).digest("hex");

    return {
      engine: this.isPglite ? "pglite" : "postgres",
      schemaVersion: "round-11",
      tableCounts: counts,
      currentPointers,
      latestSnapshotId,
      hash
    };
  }
}

const globalForDb = globalThis as unknown as { databaseRuntime?: DatabaseRuntime };
export const databaseRuntime = globalForDb.databaseRuntime ?? DatabaseRuntime.getInstance();
if (process.env.NODE_ENV !== "production") {
  globalForDb.databaseRuntime = databaseRuntime;
}
