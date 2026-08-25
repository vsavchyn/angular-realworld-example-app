import { defineConfig } from '@playwright/test';

/**
 * Lab performance tests against a production Vite preview.
 * Separate from the RealWorld e2e suite (no slowMo, no shared base config).
 */
export default defineConfig({
  testDir: './tests/perf',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4200',
    browserName: 'chromium',
    channel: 'chrome',
    launchOptions: {
      executablePath: '/usr/bin/google-chrome',
    },
    trace: 'off',
    video: 'off',
    screenshot: 'off',
  },
  webServer: {
    command: 'bun run build && bun run preview',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
