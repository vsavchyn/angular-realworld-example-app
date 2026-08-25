import { expect, test } from '@playwright/test';
import { ARTICLES, FEATURED_SLUG } from '../../perf/fixtures/browse-feed';
import { fulfillConduitApi, installLabObservers, readLabVitals } from './helpers';

const LCP_BUDGET_MS = 2500;
const CLS_BUDGET = 0.1;
const TBT_BUDGET_MS = 300;

const pages = [
  {
    name: 'home',
    path: '/',
    ready: { selector: '.article-preview .preview-link h1', text: ARTICLES[0].title },
  },
  {
    name: 'login',
    path: '/login',
    ready: { selector: '.auth-page h1', text: 'Sign in' },
  },
  {
    name: 'article',
    path: `/article/${FEATURED_SLUG}`,
    ready: { selector: '.article-page h1', text: ARTICLES[0].title },
  },
] as const;

test.describe('Web Vitals (production preview)', () => {
  for (const pageSpec of pages) {
    test(`${pageSpec.name} stays within lab budgets`, async ({ page }) => {
      await installLabObservers(page);
      await fulfillConduitApi(page);

      await page.goto(pageSpec.path, { waitUntil: 'load' });
      await expect(page.locator(pageSpec.ready.selector).first()).toHaveText(pageSpec.ready.text);

      const vitals = await readLabVitals(page);

      expect(vitals.lcp, `LCP ${vitals.lcp.toFixed(1)}ms`).toBeLessThan(LCP_BUDGET_MS);
      expect(vitals.cls, `CLS ${vitals.cls.toFixed(3)}`).toBeLessThan(CLS_BUDGET);
      expect(vitals.tbt, `TBT ${vitals.tbt.toFixed(1)}ms`).toBeLessThan(TBT_BUDGET_MS);
    });
  }
});
