import { defineConfig } from '@playwright/test';
import { baseConfig } from './realworld/specs/e2e/playwright.base';

/**
 * React-specific Playwright configuration.
 * Extends the shared RealWorld base config with the Vite dev server on port 4200.
 */
export default defineConfig({
  ...baseConfig,
  testDir: './realworld/specs/e2e',

  use: {
    ...baseConfig.use,
    baseURL: 'http://localhost:4200',
  },

  webServer: {
    command: 'bun run start',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
