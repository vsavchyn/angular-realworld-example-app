import { chromium, type Page } from 'playwright';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { ARTICLES, FEATURED_SLUG } from './fixtures/browse-feed.ts';
import { fulfillConduitApi, installLabObservers, readLabVitals, type LabVitals } from '../tests/perf/helpers.ts';

const SAMPLES = 3;
const BASE_URL = 'http://localhost:4200';

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

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function bundleMetrics() {
  const assetsDir = join(process.cwd(), 'dist', 'assets');
  const files = readdirSync(assetsDir).map(name => {
    const path = join(assetsDir, name);
    const buf = readFileSync(path);
    return { name, size: buf.length, gzip: gzipSync(buf).length };
  });
  const js = files.filter(f => f.name.endsWith('.js')).sort((a, b) => b.size - a.size);
  const css = files.filter(f => f.name.endsWith('.css')).sort((a, b) => b.size - a.size);
  return { js, css, mainJs: js[0] ?? null };
}

async function measurePage(browserPage: Page, spec: (typeof pages)[number]): Promise<LabVitals> {
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

const browser = await chromium.launch({
  channel: 'chrome',
  executablePath: '/usr/bin/google-chrome',
});

const results: Record<string, { samples: LabVitals[]; median: LabVitals }> = {};

for (const spec of pages) {
  const samples: LabVitals[] = [];
  for (let i = 0; i < SAMPLES; i++) {
    const context = await browser.newContext({ baseURL: BASE_URL });
    const page = await context.newPage();
    samples.push(await measurePage(page, spec));
    await context.close();
  }
  results[spec.name] = {
    samples,
    median: {
      lcp: median(samples.map(s => s.lcp)),
      cls: median(samples.map(s => s.cls)),
      tbt: median(samples.map(s => s.tbt)),
    },
  };
}

await browser.close();

const payload = {
  collectedAt: new Date().toISOString(),
  samplesPerPage: SAMPLES,
  budgets: { lcpMs: 2500, cls: 0.1, tbtMs: 300, mainJsBytes: 500_000 },
  vitals: results,
  bundle: bundleMetrics(),
};

mkdirSync('perf/reports/data', { recursive: true });
writeFileSync('perf/reports/data/lab.json', JSON.stringify(payload, null, 2));
console.log(JSON.stringify(payload, null, 2));
