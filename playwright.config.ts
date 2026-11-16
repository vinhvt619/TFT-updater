import {defineConfig} from '@playwright/test';
import fs from 'node:fs';

if(!process.env.PGDATA_DIR) throw new Error('Browser acceptance yêu cầu PGDATA_DIR tới bản sao DB Real, không tự seed.');

const port = process.env.TEST_PORT || process.env.PORT || '3113';
const runDir = process.env.ARTIFACT_RUN_DIR || 'artifacts/browser-checks/local';
if (!fs.existsSync(runDir)) {
  fs.mkdirSync(runDir, { recursive: true });
}

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  retries: process.env.CI ? 2 : 1,
  reporter: [
    ['list'],
    ['json', { outputFile: `${runDir}/browser-report.json` }]
  ],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    channel: process.env.CI ? undefined : 'chrome',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'mobile360', use: { viewport: { width: 360, height: 800 } } },
    { name: 'mobile390', use: { viewport: { width: 390, height: 844 } } },
    { name: 'tablet', use: { viewport: { width: 768, height: 1024 } } }
  ],
  webServer: {
    command: `node node_modules/next/dist/bin/next start -p ${port} -H 127.0.0.1`,
    url: `http://127.0.0.1:${port}/api/ready`,
    reuseExistingServer: false,
    timeout: 30000,
    env: {
      ...process.env,
      USE_PGLITE: 'true',
      DATA_MODE: 'real',
      PGDATA_DIR: process.env.PGDATA_DIR,
      NEXT_TELEMETRY_DISABLED: '1'
    }
  }
});
