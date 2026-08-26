import { expect, test } from '@playwright/test';
import { LAB_BUDGETS } from '../../perf/lab-snapshot';
import { LAB_PAGES } from '../../perf/lab-pages';
import { fulfillConduitApi, installLabObservers, readLabVitals } from './helpers';

test.describe('Web Vitals (production preview)', () => {
  for (const pageSpec of LAB_PAGES) {
    test(`${pageSpec.name} stays within lab budgets`, async ({ page }) => {
      await installLabObservers(page);
      await fulfillConduitApi(page);

      await page.goto(pageSpec.path, { waitUntil: 'load' });
      await expect(page.locator(pageSpec.ready.selector).first()).toHaveText(pageSpec.ready.text);

      const vitals = await readLabVitals(page);

      expect(vitals.lcp, `LCP ${vitals.lcp.toFixed(1)}ms`).toBeLessThan(LAB_BUDGETS.lcpMs);
      expect(vitals.cls, `CLS ${vitals.cls.toFixed(3)}`).toBeLessThan(LAB_BUDGETS.cls);
      expect(vitals.tbt, `TBT ${vitals.tbt.toFixed(1)}ms`).toBeLessThan(LAB_BUDGETS.tbtMs);
    });
  }
});
