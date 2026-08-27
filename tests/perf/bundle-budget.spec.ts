import { expect, test } from '@playwright/test';
import { bundleMetrics, detectApp } from '../../perf/app-profile';

test('main JS chunk stays within the recorded budget', () => {
  const profile = detectApp();
  const bundle = bundleMetrics(process.cwd(), profile.distRoot);

  expect(
    bundle.js.length,
    `${profile.label} production build should emit JS under ${profile.distRoot}`,
  ).toBeGreaterThan(0);

  const main = bundle.mainJs;
  expect(main, 'expected at least one JS file').not.toBeNull();
  if (!main) {
    return;
  }
  expect(main.size, `${main.name} is ${main.size} bytes (budget ${profile.mainJsBudget})`).toBeLessThanOrEqual(
    profile.mainJsBudget,
  );
});
