import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Page } from 'playwright';
import { bundleMetrics, detectApp, previewUrl } from './app-profile.ts';
import { writeEnv } from './collect-env.ts';
import { ensurePreview } from './ensure-preview.ts';
import { LAB_PAGES } from './lab-pages.ts';
import { LAB_BUDGETS, type LabSnapshot, type LabVitals } from './lab-snapshot.ts';
import { fulfillConduitApi, installLabObservers, readLabVitals } from '../tests/perf/helpers.ts';

const SAMPLES = 5;
const BASE_URL = previewUrl();

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

async function measurePage(browserPage: Page, spec: (typeof LAB_PAGES)[number]): Promise<LabVitals> {
  await installLabObservers(browserPage);
  await fulfillConduitApi(browserPage);
  await browserPage.goto(`${BASE_URL}${spec.path}`, { waitUntil: 'load' });
  await browserPage.locator(spec.ready.selector).first().waitFor({ state: 'visible' });
  const text = (await browserPage.locator(spec.ready.selector).first().textContent()) ?? '';
  if (text.trim() !== spec.ready.text) {
    throw new Error(`${spec.name}: expected "${spec.ready.text}", got "${text}"`);
  }
  return readLabVitals(browserPage);
}

const preview = await ensurePreview();
const profile = detectApp();

const browser = await chromium.launch();
const vitals = {} as LabSnapshot['vitals'];

for (const spec of LAB_PAGES) {
  const samples: LabVitals[] = [];
  for (let i = 0; i < SAMPLES; i++) {
    const context = await browser.newContext({ baseURL: BASE_URL });
    const page = await context.newPage();
    samples.push(await measurePage(page, spec));
    await context.close();
  }
  vitals[spec.name] = {
    samples,
    median: {
      lcp: median(samples.map(s => s.lcp)),
      cls: median(samples.map(s => s.cls)),
      tbt: median(samples.map(s => s.tbt)),
    },
  };
}

await browser.close();
preview.stop();

const snapshot: LabSnapshot = {
  app: profile.kind,
  collectedAt: new Date().toISOString(),
  samplesPerPage: SAMPLES,
  budgets: { ...LAB_BUDGETS, mainJsBytes: profile.mainJsBudget },
  vitals,
  bundle: bundleMetrics(),
};

const destDir = join(process.cwd(), 'perf/reports/data', profile.kind);
mkdirSync(destDir, { recursive: true });
writeFileSync(join(destDir, 'lab.json'), JSON.stringify(snapshot, null, 2));
await writeEnv();
console.log(`Wrote ${destDir}/lab.json`);
console.log(JSON.stringify(snapshot, null, 2));
