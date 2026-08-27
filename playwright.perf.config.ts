import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/perf',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  reporter: [['list'], ['json', { outputFile: 'perf/reports/data/playwright.json' }]],
  use: {
    baseURL: 'http://localhost:4200',
    browserName: 'chromium',
    trace: 'off',
    video: 'off',
    screenshot: 'off',
  },
  webServer: {
    command: 'bun run build && bun run perf/preview-server.ts',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
