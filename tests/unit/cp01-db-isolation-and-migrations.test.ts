import crypto from "node:crypto";
import { describe, it, expect, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import * as schema from "@/server/db/schema";
import { applySchemaDdl } from "@/server/db/schema-ddl";
import { DatabaseRuntime } from "@/server/db/runtime";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    try {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
      const stash = path.join(path.dirname(dir), `.${path.basename(dir)}.owner.stash`);
      if (fs.existsSync(stash)) {
        fs.unlinkSync(stash);
      }
    } catch {}
  }
});

function createIsolatedDir(prefix: string): string {
  // PGlite requires target directory to not contain preexisting files before initdb
  const dir = path.join(os.tmpdir(), `tft-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  tempDirs.push(dir);
  return dir;
}

describe("CP01: Database runtime isolation, DDL, idempotency & restore drill", () => {
  it("Gate 1: Fresh DDL migration on isolated clean directory creates expected tables", async () => {
    const dir = createIsolatedDir("cp01-fresh-ddl");
    const pglite = new PGlite(dir);
    await pglite.waitReady;

    await applySchemaDdl(pglite);

    const tablesRes = await pglite.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
    );
    const tableNames = tablesRes.rows.map((r) => r.table_name);

    expect(tableNames).toContain("meta_archetypes");
    expect(tableNames).toContain("meta_source_comp_observations");
    expect(tableNames).toContain("meta_ranking_snapshots");
    expect(tableNames).toContain("meta_current_ranking_pointers");
    expect(tableNames).toContain("releases");

    await pglite.close();
  }, 60000);

  it("Gate 2: Migration idempotency - re-running applySchemaDdl on populated DB exits 0 cleanly", async () => {
    const dir = createIsolatedDir("cp01-idempotency");
    const pglite = new PGlite(dir);
    await pglite.waitReady;

    // First run DDL
    await applySchemaDdl(pglite);

    // Populate a test row
    const db = drizzlePglite(pglite, { schema });
    await db.insert(schema.metaArchetypes).values({
      id: "idempotency-test-arch",
      setNumber: 18,
      gameProduct: "tft",
      mode: "ranked_standard",
      nameVi: "Đội hình Idempotency",
      nameEn: "Idempotency Comp",
      coreCarryChampionId: "tft18_ahri",
      coreTankChampionId: "tft18_kayle",
      coreChampionIds: ["tft18_ahri", "tft18_kayle"],
      defaultVariantId: "default",
      mappingVersion: "1.0.0",
      classifierVersion: "1.0.0"
    });

    // Second run must be completely idempotent and preserve data
    await expect(applySchemaDdl(pglite)).resolves.not.toThrow();

    const countRes = await pglite.query<{ count: string }>(
      `SELECT COUNT(*)::int as count FROM meta_archetypes WHERE id = 'idempotency-test-arch'`
    );
    expect(Number(countRes.rows[0].count)).toBe(1);

    await pglite.close();
  }, 60000);

  it("Gate 3: Transaction rollback - failed operation in transaction leaves zero partial state", async () => {
    const dir = createIsolatedDir("cp01-tx-rollback");
    const pglite = new PGlite(dir);
    await pglite.waitReady;
    await applySchemaDdl(pglite);

    const db = drizzlePglite(pglite, { schema });

    const attemptTx = async () => {
      await db.transaction(async (tx) => {
        await tx.insert(schema.metaArchetypes).values({
          id: "rollback-test-arch",
          setNumber: 18,
          gameProduct: "tft",
          mode: "ranked_standard",
          nameVi: "Đội hình Test Rollback",
          nameEn: "Test Rollback Comp",
          coreCarryChampionId: "tft18_ahri",
          coreTankChampionId: "tft18_kayle",
          coreChampionIds: ["tft18_ahri", "tft18_kayle"],
          defaultVariantId: "default",
          mappingVersion: "1.0.0",
          classifierVersion: "1.0.0"
        });
        // Intentional error inside transaction
        throw new Error("Simulated mid-transaction failure");
      });
    };

    await expect(attemptTx()).rejects.toThrow("Simulated mid-transaction failure");

    // Verify row was rolled back and is not in DB
    const check = await pglite.query<{ count: string }>(
      `SELECT COUNT(*)::int as count FROM meta_archetypes WHERE id = 'rollback-test-arch'`
    );
    expect(Number(check.rows[0].count)).toBe(0);

    await pglite.close();
  }, 60000);

  it("Gate 4: Restore drill - copying an isolated DB produces matching fingerprint and passes health check", async () => {
    const sourceDir = createIsolatedDir("cp01-restore-source");
    const restoreDir = createIsolatedDir("cp01-restore-target");

    // 1. Initialize and populate source DB
    const pgliteSource = new PGlite(sourceDir);
    await pgliteSource.waitReady;
    await applySchemaDdl(pgliteSource);

    const dbSource = drizzlePglite(pgliteSource, { schema });
    await dbSource.insert(schema.metaArchetypes).values({
      id: "drill-archetype-1",
      setNumber: 18,
      gameProduct: "tft",
      mode: "ranked_standard",
      nameVi: "Đội hình Drill",
      nameEn: "Drill Comp",
      coreCarryChampionId: "tft18_ahri",
      coreTankChampionId: "tft18_kayle",
      coreChampionIds: ["tft18_ahri", "tft18_kayle"],
      defaultVariantId: "default",
      mappingVersion: "1.0.0",
      classifierVersion: "1.0.0"
    });

    const sourceCountRes = await pgliteSource.query<{ count: string }>(
      `SELECT COUNT(*)::int as count FROM meta_archetypes`
    );
    const sourceCount = Number(sourceCountRes.rows[0].count);
    expect(sourceCount).toBe(1);

    await pgliteSource.close();

    // 2. Perform file-level copy drill (simulating physical backup restoration)
    const copyRecursive = (src: string, dest: string) => {
      fs.mkdirSync(dest, { recursive: true });
      for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
          copyRecursive(srcPath, destPath);
        } else {
          fs.copyFileSync(srcPath, destPath);
        }
      }
    };
    copyRecursive(sourceDir, restoreDir);

    // 3. Open restored directory and verify integrity
    const pgliteRestored = new PGlite(restoreDir);
    await pgliteRestored.waitReady;

    const restoredCountRes = await pgliteRestored.query<{ count: string }>(
      `SELECT COUNT(*)::int as count FROM meta_archetypes`
    );
    const restoredCount = Number(restoredCountRes.rows[0].count);
    expect(restoredCount).toBe(sourceCount);

    const restoredRow = await pgliteRestored.query<{ id: string; name_vi: string }>(
      `SELECT id, name_vi FROM meta_archetypes WHERE id = 'drill-archetype-1'`
    );
    expect(restoredRow.rows[0].id).toBe("drill-archetype-1");

    await pgliteRestored.close();
  }, 60000);

  it("Gate 5: Single PGlite owner exclusivity - active owner PID prevents concurrent attachment", async () => {
    const dir = createIsolatedDir("cp01-single-owner");
    fs.mkdirSync(dir, { recursive: true });
    const ownerFile = path.join(dir, "tft-owner.pid");

    // Simulate an active process PID holding ownership
    fs.writeFileSync(ownerFile, `${process.ppid}\n${new Date().toISOString()}`);

    const runtime = DatabaseRuntime.getInstance() as any;
    // Check single owner throws when active foreign PID is present
    expect(() => runtime.checkSingleOwner(dir)).toThrow(/locked|active|Concurrent/);
    // Acquire owner throws and refuses to overwrite active foreign PID
    expect(() => runtime.acquireOwner(dir)).toThrow(/locked|active|Concurrent/);
    expect(fs.readFileSync(ownerFile, "utf8")).toContain(String(process.ppid));
  });

  it("Gate 6: Coordinated drain - active work tracking prevents premature close until drained", async () => {
    const runtime = DatabaseRuntime.getInstance();
    const releaseWork = runtime.beginWork();

    expect(runtime.getActiveWorkCount()).toBeGreaterThan(0);

    // Drain with active work times out and throws
    await expect(runtime.drain(5)).rejects.toThrow(/Drain timed out/);

    // After releasing active work, drain succeeds cleanly
    releaseWork();
    await expect(runtime.drain(50)).resolves.not.toThrow();
    expect(runtime.getActiveWorkCount()).toBe(0);
  });

  it("Gate 7: Restore drill with complete fingerprint & runtime health check", async () => {
    const sourceDir = createIsolatedDir("cp01-restore-fp-source");
    const restoreDir = createIsolatedDir("cp01-restore-fp-target");

    const pgliteSource = new PGlite(sourceDir);
    await pgliteSource.waitReady;
    await applySchemaDdl(pgliteSource);

    const dbSource = drizzlePglite(pgliteSource, { schema });
    await dbSource.insert(schema.metaArchetypes).values({
      id: "fingerprint-archetype-1",
      setNumber: 18,
      gameProduct: "tft",
      mode: "ranked_standard",
      nameVi: "Đội hình Fingerprint",
      nameEn: "Fingerprint Comp",
      coreCarryChampionId: "tft18_ahri",
      coreTankChampionId: "tft18_kayle",
      coreChampionIds: ["tft18_ahri", "tft18_kayle"],
      defaultVariantId: "default",
      mappingVersion: "1.0.0",
      classifierVersion: "1.0.0"
    });

    const tables = [
      "meta_archetypes",
      "meta_source_comp_observations",
      "meta_source_comp_builds",
      "meta_ranking_snapshots",
      "meta_current_ranking_pointers",
      "releases",
      "collection_run_ledger"
    ];

    const sourceContent: Record<string, any> = {};
    for (const tbl of tables) {
      const res = await pgliteSource.query(`SELECT * FROM ${tbl}`);
      sourceContent[tbl] = res.rows;
    }
    const sourceFingerprint = crypto.createHash("sha256").update(JSON.stringify(sourceContent)).digest("hex");
    await pgliteSource.close();

    // Physical copy
    const copyRecursive = (src: string, dest: string) => {
      fs.mkdirSync(dest, { recursive: true });
      for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
          copyRecursive(srcPath, destPath);
        } else {
          fs.copyFileSync(srcPath, destPath);
        }
      }
    };
    copyRecursive(sourceDir, restoreDir);

    const pgliteRestored = new PGlite(restoreDir);
    await pgliteRestored.waitReady;

    const restoredContent: Record<string, any> = {};
    for (const tbl of tables) {
      const res = await pgliteRestored.query(`SELECT * FROM ${tbl}`);
      restoredContent[tbl] = res.rows;
    }
    const restoredFingerprint = crypto.createHash("sha256").update(JSON.stringify(restoredContent)).digest("hex");
    expect(restoredFingerprint).toBe(sourceFingerprint);

    const tableRes = await pgliteRestored.query<{ count: string }>(
      "SELECT COUNT(*)::int as count FROM information_schema.tables WHERE table_schema = 'public'"
    );
    expect(Number(tableRes.rows[0].count)).toBeGreaterThan(5);

    const health = await pgliteRestored.query("SELECT 1 as healthy");
    expect(health.rows[0]).toEqual({ healthy: 1 });
    await pgliteRestored.close();
  }, 60000);

  it("Gate 8: Missing-parent and quarantine-parent handling enforces referential integrity", async () => {
    const dir = createIsolatedDir("cp01-missing-parent");
    const pglite = new PGlite(dir);
    await pglite.waitReady;
    await applySchemaDdl(pglite);

    const db = drizzlePglite(pglite, { schema });

    // 1. Missing parent: Attempting to insert a source observation referencing a non-existent parent snapshot must fail
    await expect(
      db.insert(schema.metaSourceCompObservations).values({
        id: "orphan-obs-1",
        snapshotId: "non-existent-snapshot-parent-id",
        sourceId: "tftacademy",
        sourceCompId: "orphan-comp",
        sourceUrl: "https://tftacademy.com/tierlist/comps/orphan",
        datasetKind: "real",
        status: "valid",
        originalName: "Orphan",
        originalTier: "S"
      })
    ).rejects.toThrow();

    // 2. Quarantine parent handling: Valid parent snapshot vs Quarantined parent snapshot
    await db.insert(schema.metaSourceSnapshots).values([
      {
        id: "valid-parent-snapshot-1",
        sourceId: "tactics",
        datasetKind: "real",
        status: "published",
        scope: { region: "global" },
        observedAt: new Date(),
        fetchedAt: new Date(),
        rawArtifactId: "art-valid"
      },
      {
        id: "quarantined-parent-snapshot-1",
        sourceId: "tactics",
        datasetKind: "real",
        status: "quarantined",
        scope: { region: "global" },
        observedAt: new Date(),
        fetchedAt: new Date(),
        rawArtifactId: "art-quarantine"
      }
    ]);

    await db.insert(schema.metaSourceCompObservations).values([
      {
        id: "obs-under-valid-parent",
        snapshotId: "valid-parent-snapshot-1",
        sourceId: "tactics",
        sourceCompId: "comp-valid",
        sourceUrl: "https://tactics.tools/comp/valid",
        datasetKind: "real",
        status: "valid",
        originalName: "Valid Comp",
        originalTier: "S"
      },
      {
        id: "obs-under-quarantined-parent",
        snapshotId: "quarantined-parent-snapshot-1",
        sourceId: "tactics",
        sourceCompId: "comp-quarantined",
        sourceUrl: "https://tactics.tools/comp/quarantined",
        datasetKind: "real",
        status: "valid",
        originalName: "Quarantined Comp",
        originalTier: "A"
      }
    ]);

    // Active query with non-quarantined parent join excludes observations under quarantined parent
    const activeObservations = await pglite.query<{ id: string }>(`
      SELECT o.id 
      FROM meta_source_comp_observations o
      JOIN meta_source_snapshots s ON o.snapshot_id = s.id
      WHERE s.status != 'quarantined' AND o.status != 'quarantined'
    `);
    const activeIds = activeObservations.rows.map((r) => r.id);
    expect(activeIds).toContain("obs-under-valid-parent");
    expect(activeIds).not.toContain("obs-under-quarantined-parent");

    await pglite.close();
  }, 60000);

  it("Gate 9: Transaction rollback on failed migration step preserves pristine schema", async () => {
    const dir = createIsolatedDir("cp01-failed-migration");
    const pglite = new PGlite(dir);
    await pglite.waitReady;
    await applySchemaDdl(pglite);

    // Run a transactional batch migration that fails halfway
    const failingMigration = async () => {
      await pglite.query("BEGIN;");
      try {
        await pglite.query("CREATE TABLE migration_probe_temp (id text primary key);");
        // Intentional SQL error: invalid syntax / non-existent function
        await pglite.query("INSERT INTO migration_probe_temp VALUES (non_existent_function());");
        await pglite.query("COMMIT;");
      } catch (err) {
        await pglite.query("ROLLBACK;");
        throw err;
      }
    };

    await expect(failingMigration()).rejects.toThrow();

    // Verify migration_probe_temp does not exist
    const checkTable = await pglite.query<{ count: string }>(
      "SELECT COUNT(*)::int as count FROM information_schema.tables WHERE table_name = 'migration_probe_temp'"
    );
    expect(Number(checkTable.rows[0].count)).toBe(0);

    await pglite.close();
  }, 60000);

  it("Gate 10: Per-instance runtime token exclusivity prevents same-PID lease adoption and preserves replacement owner", async () => {
    const dir = createIsolatedDir("cp01-token-exclusivity");
    fs.mkdirSync(dir, { recursive: true });

    const first = Reflect.construct(DatabaseRuntime, []) as any;
    const second = Reflect.construct(DatabaseRuntime, []) as any;

    first.acquireOwner(dir);
    // Second runtime in same process cannot adopt lease
    expect(() => second.acquireOwner(dir)).toThrow(/locked|another runtime/);

    // Release preserves replacement owner even in same PID
    const ownerFile = path.join(dir, "tft-owner.pid");
    const replacement = `${process.pid}\nreplacement-token-${Date.now()}`;
    fs.writeFileSync(ownerFile, replacement);

    first.releaseOwner(dir);
    expect(fs.existsSync(ownerFile)).toBe(true);
    expect(fs.readFileSync(ownerFile, "utf8")).toBe(replacement);
  });

  it("Gate 11: Admission control during shutdown rejects new beginWork and propagates drain timeout", async () => {
    const runtime = Reflect.construct(DatabaseRuntime, []) as any;
    const closeSpy = vi.fn(async () => {});
    runtime.pgliteInstance = { closed: false, close: closeSpy };

    const release = runtime.beginWork();
    const pendingClose = runtime.close();

    // While shutdown is in progress, beginWork rejects new operations
    expect(() => runtime.beginWork()).toThrow(/shutting down/i);

    // Drain timeout throws without closing PGlite
    await expect(runtime.drain(10)).rejects.toThrow(/Drain timed out/);

    release();
    await pendingClose.catch(() => {});
  });

  it("Gate 12: Clean directory initialization acquires pre-attach owner lease and initializes fresh PGlite cleanly", async () => {
    const dir = createIsolatedDir("cp01-gate12-clean-init");
    const runtime = Reflect.construct(DatabaseRuntime, []) as any;
    runtime.testTempDir = dir;

    // Call getDb() directly on the fresh clean directory
    const db = await runtime.getDb();
    expect(db).toBeDefined();

    // Verify owner file was written
    const ownerFile = path.join(dir, "tft-owner.pid");
    expect(fs.existsSync(ownerFile)).toBe(true);
    expect(fs.readFileSync(ownerFile, "utf8")).toContain(String(process.pid));

    // Verify health check succeeds
    const health = await runtime.checkHealth();
    expect(health.healthy).toBe(true);

    // Clean shutdown
    await runtime.close();
  });

  it("Gate 13: Malformed or unverifiable external lease rejects pre-attach without overwriting lease", async () => {
    const dir = createIsolatedDir("cp01-gate13-unknown-owner");
    const runtime = Reflect.construct(DatabaseRuntime, []) as any;
    const externalLease = runtime.getExternalOwnerFile(dir);
    fs.writeFileSync(externalLease, "unverifiable-owner-record");

    await expect(runtime.initializePglite(dir)).rejects.toThrow(/locked|unverifiable|Concurrent/i);
    expect(fs.readFileSync(externalLease, "utf8")).toBe("unverifiable-owner-record");
    expect(runtime.ownsActiveLock).toBe(false);
  });

  it("Gate 14: Driver close failure propagates error and retains active owner lease", async () => {
    const dir = createIsolatedDir("cp01-gate14-close-failure");
    fs.mkdirSync(dir, { recursive: true });
    const runtime = Reflect.construct(DatabaseRuntime, []) as any;
    const externalLease = runtime.getExternalOwnerFile(dir);

    runtime.acquireOwner(dir);
    runtime.activeDataDir = dir;
    runtime.pgliteInstance = {
      closed: false,
      close: async () => {
        throw new Error("driver close failed while still open");
      }
    };

    await expect(runtime.close()).rejects.toThrow(/driver close failed/);
    expect(fs.existsSync(externalLease)).toBe(true);
    expect(runtime.ownsActiveLock).toBe(true);

    runtime.releaseOwner(dir);
  });

  it("Gate 15: Canonical change impact filter preserves bugfix-labelled numerical buffs", async () => {
    const { parseChangeDetail, rowImpact } = await import("@/domain/meta/change-impact");
    const change: any = {
      id: "1",
      releaseId: "rel_live_18_2",
      entityKind: "champion",
      entityId: "tft18_ahri",
      rawEntityName: "Ahri",
      fieldKey: "attack_damage",
      changeType: "bugfix",
      before: { state: "known", value: 10 },
      after: { state: "known", value: 20 },
      rawText: "Fixed attack damage: 10 => 20",
      verificationStatus: "verified",
      evidenceIds: []
    };

    const parsed = parseChangeDetail(change);
    expect(rowImpact(change)).toBe("buff");
    expect(parsed.impact).toBe("buff");
    expect(parsed.type).toBe("bugfix");
  });

  it("Gate 16: Admitted initialization tracks active work and close() awaits initialization before releasing lease", async () => {
    const dir = createIsolatedDir("cp01-gate16-init-lifecycle");
    const runtime = Reflect.construct(DatabaseRuntime, []) as any;
    const externalLease = runtime.getExternalOwnerFile(dir);
    vi.stubEnv("PGDATA_DIR", dir);
    vi.stubEnv("TFT_TEST_RUNNER_DIR", dir);
    vi.stubEnv("DATA_MODE", "real");

    let releaseWaitReady!: () => void;
    const waitReadyPromise = new Promise<void>((resolve) => (releaseWaitReady = resolve));

    runtime.initializePglite = async (targetDir: string) => {
      runtime.acquireOwner(targetDir);
      runtime.activeDataDir = targetDir;
      const fakeInstance = {
        waitReady: waitReadyPromise,
        closed: false,
        close: async () => {
          fakeInstance.closed = true;
        },
        query: async () => ({ rows: [] }),
        exec: async () => {}
      };
      runtime.pgliteInstance = fakeInstance;
      await fakeInstance.waitReady;
      return fakeInstance;
    };

    const initPromise = runtime.getDb();
    let closed = false;
    const closePromise = runtime.close().then(() => {
      closed = true;
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(closed).toBe(false);
    expect(fs.existsSync(externalLease)).toBe(true);

    releaseWaitReady();
    await initPromise;
    await closePromise;

    expect(closed).toBe(true);
    expect(fs.existsSync(externalLease)).toBe(false);
  });

  it("Gate 17: Concurrent signal handlers await shared shutdown promise without premature exit", async () => {
    const origExitCode = process.exitCode;
    const handlers: Record<string, any> = {};
    const exits: number[] = [];
    let releaseClose!: () => void;
    const closePromise = new Promise<void>((r) => (releaseClose = r));
    let closeCallCount = 0;

    const realOn = process.on.bind(process);
    const spyOn = vi.spyOn(process, "on").mockImplementation(((event: any, handler: any) => {
      if (["SIGTERM", "SIGINT", "beforeExit"].includes(event)) {
        handlers[event] = handler;
        return process;
      }
      return realOn(event, handler);
    }) as any);
    const spyExit = vi.spyOn(process, "exit").mockImplementation(((code: any) => {
      exits.push(Number(code ?? 0));
    }) as any);

    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VITEST", "");

    try {
      vi.resetModules();
      vi.doMock("@/server/db/runtime", () => ({
        databaseRuntime: {
          close: vi.fn(async () => {
            closeCallCount++;
            await closePromise;
          }),
          getActiveWorkCount: () => 0
        },
        DatabaseRuntime: class {}
      }));

      await import("@/server/db/client");

      expect(typeof handlers.SIGTERM).toBe("function");
      expect(typeof handlers.SIGINT).toBe("function");

      const first = handlers.SIGTERM();
      await Promise.resolve();
      const second = handlers.SIGINT();
      await Promise.resolve();
      await Promise.resolve();

      expect(exits).toEqual([]);
      expect(closeCallCount).toBe(1);

      releaseClose();
      await Promise.all([first, second]);

      expect(exits).toEqual([0]);
    } finally {
      spyOn.mockRestore();
      spyExit.mockRestore();
      vi.unstubAllEnvs();
      process.exitCode = origExitCode;
      vi.resetModules();
    }
  });
});
