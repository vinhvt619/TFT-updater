import { databaseRuntime, DatabaseRuntime } from "./runtime";

export { databaseRuntime, DatabaseRuntime };

export function getPgDataDir(): string {
  return databaseRuntime.getDataDir();
}

export function cleanStalePgDataLocks(dataDir: string): void {
  databaseRuntime.cleanStaleLocks(dataDir);
}

export async function getDb() {
  return databaseRuntime.getDb();
}

export async function closeDb(): Promise<void> {
  return databaseRuntime.close();
}

export async function checkDbHealth() {
  return databaseRuntime.checkHealth();
}

export async function getDatabaseFingerprint() {
  return databaseRuntime.getFingerprint();
}

// Process signal listeners - only in runtime/server, not in test suites
const isTestEnv = process.env.NODE_ENV === "test" || Boolean(process.env.VITEST);
if (typeof process !== "undefined" && !isTestEnv) {
  let shutdownPromise: Promise<void> | null = null;
  let hasShutdownFailure = false;
  let hasExited = false;
  const gracefulShutdown = () => {
    if (!shutdownPromise) {
      shutdownPromise = (async () => {
        await closeDb();
      })();
    }
    return shutdownPromise;
  };
  const handleSignalShutdown = async (signalName: string, exitOnCleanClose: boolean) => {
    try {
      await gracefulShutdown();
      const activeWork =
        typeof (databaseRuntime as any).getActiveWorkCount === "function"
          ? (databaseRuntime as any).getActiveWorkCount()
          : 0;
      if (activeWork > 0) {
        shutdownPromise = null;
        hasShutdownFailure = true;
        process.exitCode = 1;
        return;
      }
      if (exitOnCleanClose && !hasExited) {
        hasExited = true;
        const exitCode =
          hasShutdownFailure || (typeof process.exitCode === "number" && process.exitCode !== 0)
            ? Number(process.exitCode || 1)
            : 0;
        process.exit(exitCode);
      }
    } catch (err) {
      shutdownPromise = null;
      hasShutdownFailure = true;
      process.exitCode = 1;
      console.error(`[DatabaseClient] Error during ${signalName} shutdown:`, err);
    }
  };
  process.on("beforeExit", async () => {
    await handleSignalShutdown("beforeExit", false);
  });
  process.on("SIGINT", async () => {
    await handleSignalShutdown("SIGINT", true);
  });
  process.on("SIGTERM", async () => {
    await handleSignalShutdown("SIGTERM", true);
  });
}
