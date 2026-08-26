import type { Page } from '@playwright/test';
import { browseFeedResponse } from '../../perf/fixtures/browse-feed';
import type { LabVitals } from '../../perf/lab-snapshot';

export type { LabVitals };

declare global {
  interface Window {
    __labVitals?: LabVitals;
  }
}

export async function fulfillConduitApi(page: Page): Promise<void> {
  await page.route(/\/api\//, async route => {
    const request = route.request();
    const url = new URL(request.url());
    const result = browseFeedResponse(request.method(), url.pathname, url.searchParams);
    await route.fulfill({
      status: result.status,
      contentType: 'application/json',
      body: JSON.stringify(result.body),
    });
  });
}

export async function installLabObservers(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const vitals: LabVitals = { lcp: 0, cls: 0, tbt: 0 };
    window.__labVitals = vitals;

    try {
      new PerformanceObserver(list => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        if (last) {
          vitals.lcp = last.startTime;
        }
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {}

    try {
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
          if (!shift.hadRecentInput) {
            vitals.cls += shift.value;
          }
        }
      }).observe({ type: 'layout-shift', buffered: true });
    } catch {}

    try {
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          const blocking = entry.duration - 50;
          if (blocking > 0) {
            vitals.tbt += blocking;
          }
        }
      }).observe({ type: 'longtask', buffered: true });
    } catch {}
  });
}

export async function readLabVitals(page: Page): Promise<LabVitals> {
  await page.waitForFunction(() => (window.__labVitals?.lcp ?? 0) > 0, null, { timeout: 15_000 });
  await page.waitForFunction(
    () => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      return !!nav && performance.now() - nav.loadEventEnd > 1000;
    },
    null,
    { timeout: 15_000 },
  );
  return page.evaluate(() => window.__labVitals ?? { lcp: 0, cls: 0, tbt: 0 });
}
