import { defineConfig, configDefaults } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "tests/e2e/**", "artifacts/**", ".cache/**", ".agents/**", "storage/**", "design-system/**"],
    fileParallelism: false,
    pool: "forks",
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 30000,
    // PGlite initialization and the 30-archetype integration seed can take
    // longer than Vitest's default 10s hook budget on a cold Windows disk.
    hookTimeout: 30000,
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  }
});
