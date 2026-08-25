import { expect, test } from '@playwright/test';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Uncompressed main JS chunk budget, locked from the first local production
 * build (index-*.js ≈ 452 kB). Fail the lab run if the chunk grows past this.
 */
const MAX_MAIN_JS_BYTES = 500_000;

test('main JS chunk stays within the recorded budget', () => {
  const assetsDir = join(process.cwd(), 'dist', 'assets');
  const jsChunks = readdirSync(assetsDir)
    .filter(name => name.endsWith('.js'))
    .map(name => ({ name, size: statSync(join(assetsDir, name)).size }))
    .sort((a, b) => b.size - a.size);

  expect(jsChunks.length, 'vite production build should emit JS under dist/assets').toBeGreaterThan(0);

  const main = jsChunks[0];
  expect(main.size, `${main.name} is ${main.size} bytes (budget ${MAX_MAIN_JS_BYTES})`).toBeLessThanOrEqual(
    MAX_MAIN_JS_BYTES,
  );
});
