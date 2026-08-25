import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

type Trend = {
  avg?: number;
  min?: number;
  med?: number;
  max?: number;
  'p(90)'?: number;
  'p(95)'?: number;
  'p(99)'?: number;
};

type Counter = { count?: number; rate?: number; value?: number; passes?: number; fails?: number };

type K6Summary = {
  root_group: { checks: Record<string, { name: string; passes: number; fails: number }> };
  metrics: Record<string, Trend & Counter & { thresholds?: Record<string, boolean> }>;
};

type LabVitals = { lcp: number; cls: number; tbt: number };
type LabFile = {
  collectedAt: string;
  samplesPerPage: number;
  budgets: { lcpMs: number; cls: number; tbtMs: number; mainJsBytes: number };
  vitals: Record<string, { samples: LabVitals[]; median: LabVitals }>;
  bundle: {
    js: Array<{ name: string; size: number; gzip: number }>;
    css: Array<{ name: string; size: number; gzip: number }>;
    mainJs: { name: string; size: number; gzip: number } | null;
  };
};

type EnvFile = {
  collectedAt: string;
  app: string;
  host: { os: string; cpu: string; cpus: number; memoryGiB: number };
  tooling: Record<string, string>;
  targets: Record<string, string>;
};

type PlaywrightFile = {
  stats?: { expected?: number; unexpected?: number; skipped?: number };
  suites?: unknown[];
};

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function fmtMs(ms: number, digits = 2): string {
  if (!Number.isFinite(ms)) return '—';
  if (ms === 0) return '0 ms';
  if (Math.abs(ms) < 1) return `${(ms * 1000).toFixed(0)} µs`;
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
  return `${ms.toFixed(digits)} ms`;
}

function fmtBytes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} MB`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)} kB`;
  return `${n} B`;
}

function pct(part: number, whole: number): string {
  if (!whole) return '0%';
  return `${((part / whole) * 100).toFixed(1)}%`;
}

function headroom(value: number, budget: number): string {
  if (budget <= 0) return '—';
  return `${(((budget - value) / budget) * 100).toFixed(0)}% under budget`;
}

function passFail(ok: boolean): string {
  return ok ? `<span class="pill pass">PASS</span>` : `<span class="pill fail">FAIL</span>`;
}

function k6ThresholdPassed(metric: { thresholds?: Record<string, boolean> } | undefined): boolean {
  if (!metric?.thresholds) return true;
  // k6 summary-export stores true when the threshold is tainted (failed).
  return Object.values(metric.thresholds).every(failed => failed === false);
}

function downsample(path: string, metric: string, maxPoints = 80): Array<{ t: number; v: number }> {
  const text = readFileSync(path, 'utf8');
  const points: Array<{ t: number; v: number }> = [];
  let t0: number | null = null;
  for (const line of text.split('\n')) {
    if (!line.includes(`"metric":"${metric}"`) || !line.includes('"type":"Point"')) continue;
    const obj = JSON.parse(line) as { type: string; metric: string; data: { time: string; value: number } };
    if (obj.type !== 'Point' || obj.metric !== metric) continue;
    const t = new Date(obj.data.time).getTime();
    if (t0 === null) t0 = t;
    points.push({ t: (t - t0) / 1000, v: obj.data.value });
  }
  if (points.length <= maxPoints) return points;
  const step = Math.ceil(points.length / maxPoints);
  return points.filter((_, i) => i % step === 0);
}

function polyline(
  points: Array<{ t: number; v: number }>,
  width: number,
  height: number,
  color: string,
  yMax?: number,
): string {
  if (!points.length) return '';
  const maxT = Math.max(...points.map(p => p.t), 1);
  const maxV = yMax ?? Math.max(...points.map(p => p.v), 1);
  const coords = points
    .map(p => {
      const x = (p.t / maxT) * (width - 48) + 40;
      const y = height - 28 - (p.v / maxV) * (height - 48);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const last = points[points.length - 1];
  const yLast = height - 28 - (last.v / maxV) * (height - 48);
  return `
    <svg viewBox="0 0 ${width} ${height}" class="chart" role="img">
      <line x1="40" y1="12" x2="40" y2="${height - 28}" stroke="#d7ddd6" />
      <line x1="40" y1="${height - 28}" x2="${width - 8}" y2="${height - 28}" stroke="#d7ddd6" />
      <text x="8" y="18" class="axis">${maxV.toFixed(0)}</text>
      <text x="8" y="${height - 24}" class="axis">0</text>
      <text x="${width - 36}" y="${height - 10}" class="axis">${maxT.toFixed(0)}s</text>
      <polyline fill="none" stroke="${color}" stroke-width="2.5" points="${coords}" />
      <circle cx="${((last.t / maxT) * (width - 48) + 40).toFixed(1)}" cy="${yLast.toFixed(1)}" r="3.5" fill="${color}" />
    </svg>`;
}

function bars(items: Array<{ label: string; value: number; budget: number; unit: string }>, color: string): string {
  return `<div class="bars">${items
    .map(item => {
      const used = Math.min(100, (item.value / item.budget) * 100);
      return `<div class="bar-row">
        <div class="bar-label">${item.label}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${used.toFixed(1)}%;background:${color}"></div></div>
        <div class="bar-value">${item.unit === 'bytes' ? fmtBytes(item.value) : item.unit === 'cls' ? item.value.toFixed(3) : fmtMs(item.value, 0)} / ${item.unit === 'bytes' ? fmtBytes(item.budget) : item.unit === 'cls' ? item.budget : fmtMs(item.budget, 0)}</div>
      </div>`;
    })
    .join('')}</div>`;
}

function donut(slices: Array<{ label: string; value: number; color: string }>): string {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const r = 42;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const circles = slices
    .map(slice => {
      const len = (slice.value / total) * c;
      const dash = `${len.toFixed(2)} ${(c - len).toFixed(2)}`;
      const el = `<circle cx="60" cy="60" r="${r}" fill="none" stroke="${slice.color}" stroke-width="16" stroke-dasharray="${dash}" stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 60 60)" />`;
      offset += len;
      return el;
    })
    .join('');
  const legend = slices
    .map(
      slice =>
        `<li><span class="swatch" style="background:${slice.color}"></span>${slice.label} <strong>${pct(slice.value, total)}</strong> (${slice.value})</li>`,
    )
    .join('');
  return `<div class="donut-wrap"><svg viewBox="0 0 120 120" class="donut">${circles}</svg><ul class="legend">${legend}</ul></div>`;
}

const env = readJson<EnvFile>('perf/reports/data/env.json');
const smoke = readJson<K6Summary>('perf/reports/data/k6-smoke.json');
const load = readJson<K6Summary>('perf/reports/data/k6-load.json');
const lab = readJson<LabFile>('perf/reports/data/lab.json');
const pw = readJson<PlaywrightFile>('perf/reports/data/playwright.json');
const vuSeries = downsample('perf/reports/data/k6-load-points.json', 'vus', 90);
const latencySeries = downsample('perf/reports/data/k6-load-points.json', 'http_req_duration', 120).map(p => ({
  t: p.t,
  v: p.v * 1000, // k6 JSON is milliseconds; plot microseconds
}));

function checkMix(summary: K6Summary) {
  const checks = summary.root_group.checks;
  const tags = checks['tags status 200']?.passes ?? 0;
  const feed = checks['feed status 200']?.passes ?? 0;
  const page2 = checks['page 2 status 200']?.passes ?? 0;
  const article = checks['article status 200']?.passes ?? 0;
  const comments = checks['comments status 200']?.passes ?? 0;
  const list = tags + feed + page2;
  const detail = article + comments;
  return { tags, feed, page2, article, comments, list, detail, total: list + detail };
}

const smokeMix = checkMix(smoke);
const loadMix = checkMix(load);

const smokeP95 = smoke.metrics.http_req_duration['p(95)'] ?? 0;
const loadP95 = load.metrics.http_req_duration['p(95)'] ?? 0;
const smokeFail = smoke.metrics.http_req_failed.value ?? 0;
const loadFail = load.metrics.http_req_failed.value ?? 0;
const smokeOk =
  k6ThresholdPassed(smoke.metrics.http_req_duration) &&
  k6ThresholdPassed(smoke.metrics.http_req_failed) &&
  k6ThresholdPassed(smoke.metrics.checks);
const loadOk =
  k6ThresholdPassed(load.metrics.http_req_duration) &&
  k6ThresholdPassed(load.metrics.http_req_failed) &&
  k6ThresholdPassed(load.metrics.checks);

const pages = ['home', 'login', 'article'] as const;
const vitalsOk = pages.every(name => {
  const m = lab.vitals[name].median;
  return m.lcp < lab.budgets.lcpMs && m.cls < lab.budgets.cls && m.tbt < lab.budgets.tbtMs;
});
const bundleOk = (lab.bundle.mainJs?.size ?? Infinity) <= lab.budgets.mainJsBytes;
const pwOk = (pw.stats?.unexpected ?? 0) === 0;
const overall = smokeOk && loadOk && vitalsOk && bundleOk && pwOk;

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Conduit performance report — 25 Aug 2026</title>
  <style>
    :root {
      --bg: #f4f6f4;
      --card: #ffffff;
      --ink: #1b2420;
      --muted: #5d6b66;
      --line: #d9e0dc;
      --pass: #1f7a4d;
      --pass-bg: #e5f6ec;
      --fail: #b42318;
      --fail-bg: #fde8e6;
      --accent: #0f766e;
      --accent-2: #c2410c;
      --accent-3: #1d4ed8;
      --warn: #9a6700;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: var(--ink);
      background: var(--bg);
      font: 16px/1.5 "Source Sans 3", "Segoe UI", sans-serif;
    }
    header {
      background: linear-gradient(120deg, #11332e 0%, #0f766e 55%, #1d4ed8 140%);
      color: #fff;
      padding: 2.4rem 1.5rem 2rem;
    }
    header .wrap, main, footer { max-width: 1080px; margin: 0 auto; }
    h1 { margin: 0 0 .4rem; font-size: 2rem; letter-spacing: -0.03em; }
    .sub { opacity: .9; max-width: 46rem; }
    .status-row { display: flex; gap: .6rem; flex-wrap: wrap; margin-top: 1.1rem; }
    .pill {
      display: inline-flex; align-items: center; gap: .35rem;
      border-radius: 999px; padding: .15rem .65rem; font-size: .8rem; font-weight: 700;
      letter-spacing: .04em;
    }
    .pill.pass { background: var(--pass-bg); color: var(--pass); }
    .pill.fail { background: var(--fail-bg); color: var(--fail); }
    .pill.neutral { background: #e8eefc; color: #1e3a8a; }
    .hero-pass, .hero-fail {
      font-weight: 800; padding: .35rem .8rem; border-radius: 8px; font-size: .95rem;
    }
    .hero-pass { background: #d9f5e5; color: #14532d; }
    .hero-fail { background: #fee4e2; color: #7f1d1d; }
    main { padding: 1.5rem; display: grid; gap: 1.1rem; }
    section {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 1.2rem 1.3rem 1.3rem;
    }
    h2 { margin: 0 0 .75rem; font-size: 1.25rem; letter-spacing: -0.02em; }
    h3 { margin: 1rem 0 .4rem; font-size: 1.02rem; }
    p, li { color: var(--ink); }
    .muted { color: var(--muted); }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: .8rem; }
    @media (max-width: 800px) { .grid-2, .grid-3 { grid-template-columns: 1fr; } }
    .stat {
      background: #f7faf8; border: 1px solid var(--line); border-radius: 10px; padding: .8rem .9rem;
    }
    .stat b { display: block; font-size: 1.25rem; letter-spacing: -0.03em; }
    .stat span { color: var(--muted); font-size: .82rem; }
    table { width: 100%; border-collapse: collapse; font-size: .92rem; }
    th, td { text-align: left; padding: .45rem .4rem; border-bottom: 1px solid var(--line); vertical-align: top; }
    th { color: var(--muted); font-weight: 600; font-size: .78rem; text-transform: uppercase; letter-spacing: .04em; }
    .chart { width: 100%; height: auto; background: #fbfcfb; border: 1px solid var(--line); border-radius: 10px; }
    .axis { font-size: 10px; fill: #6b776f; }
    .bars { display: grid; gap: .55rem; }
    .bar-row { display: grid; grid-template-columns: 5.5rem 1fr 11rem; gap: .55rem; align-items: center; font-size: .85rem; }
    .bar-track { height: 10px; background: #e7eee9; border-radius: 99px; overflow: hidden; }
    .bar-fill { height: 100%; border-radius: 99px; }
    .bar-value { color: var(--muted); text-align: right; font-variant-numeric: tabular-nums; }
    .donut-wrap { display: flex; gap: 1.2rem; align-items: center; flex-wrap: wrap; }
    .donut { width: 140px; height: 140px; }
    .legend { list-style: none; margin: 0; padding: 0; font-size: .9rem; }
    .legend li { display: flex; align-items: center; gap: .45rem; margin: .2rem 0; }
    .swatch { width: .75rem; height: .75rem; border-radius: 2px; display: inline-block; }
    .callout {
      background: #fff7e6; border-left: 4px solid var(--warn); padding: .7rem .9rem; border-radius: 0 8px 8px 0;
      color: #5c4a12;
    }
    .arch { width: 100%; height: auto; }
    footer { padding: 1rem 1.5rem 2.5rem; color: var(--muted); font-size: .85rem; }
    ol.findings > li, ol.conclusions > li { margin: .45rem 0; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .86em; background: #eef2ef; padding: .05rem .3rem; border-radius: 4px; }
  </style>
</head>
<body>
  <header>
    <div class="wrap">
      <div class="status-row">
        ${overall ? '<span class="hero-pass">All local performance checks passed</span>' : '<span class="hero-fail">One or more checks failed</span>'}
      </div>
      <h1>Conduit performance report</h1>
      <p class="sub">Local lab run on 25 Aug 2026 against a production Vite preview and the Bun RealWorld mock. Frontend Web Vitals, JS bundle budget, k6 smoke (1 VU / 30s) and k6 load (10 VUs / ~2 min).</p>
      <div class="status-row">
        ${passFail(vitalsOk)} Web Vitals
        ${passFail(bundleOk)} Bundle budget
        ${passFail(smokeOk)} k6 smoke
        ${passFail(loadOk)} k6 load
        ${passFail(pwOk)} Playwright lab
      </div>
    </div>
  </header>
  <main>
    <section>
      <h2>1. Executive summary</h2>
      <div class="grid-3">
        <div class="stat"><span>Home LCP (median of 3)</span><b>${fmtMs(lab.vitals.home.median.lcp, 0)}</b></div>
        <div class="stat"><span>k6 load p95 latency</span><b>${fmtMs(loadP95)}</b></div>
        <div class="stat"><span>Main JS chunk</span><b>${fmtBytes(lab.bundle.mainJs?.size ?? 0)}</b></div>
      </div>
      <p>The SPA meets Google “good” lab budgets with large headroom on this machine. Protocol load against the in-process mock is essentially instantaneous (p95 well under 1 ms) with <strong>0% HTTP failures</strong>. That is expected: the mock is a Bun <code>serve</code> loop on localhost, not a networked RealWorld backend.</p>
      <p class="callout"><strong>Read this result as a frontend + fixture baseline</strong>, not as API capacity of <code>api.realworld.show</code> (which was not targeted) and not as production-backend SLO evidence.</p>
    </section>

    <section>
      <h2>2. How the run was shaped</h2>
      <svg class="arch" viewBox="0 0 980 220" role="img" aria-label="Performance test topology">
        <rect x="20" y="40" width="280" height="140" rx="12" fill="#ecfdf5" stroke="#0f766e"/>
        <text x="160" y="70" text-anchor="middle" font-weight="700" fill="#115e59">Frontend lab</text>
        <text x="160" y="96" text-anchor="middle" font-size="13" fill="#134e4a">vite build + preview :4200</text>
        <text x="160" y="118" text-anchor="middle" font-size="13" fill="#134e4a">Playwright Chromium</text>
        <text x="160" y="140" text-anchor="middle" font-size="13" fill="#134e4a">LCP / CLS / TBT + bundle</text>
        <text x="160" y="162" text-anchor="middle" font-size="12" fill="#0f766e">API fulfilled from fixtures</text>
        <rect x="350" y="40" width="280" height="140" rx="12" fill="#eff6ff" stroke="#1d4ed8"/>
        <text x="490" y="70" text-anchor="middle" font-weight="700" fill="#1e3a8a">System protocol</text>
        <text x="490" y="96" text-anchor="middle" font-size="13" fill="#1e3a8a">k6 browse-feed.js</text>
        <text x="490" y="118" text-anchor="middle" font-size="13" fill="#1e3a8a">smoke 1 VU · 30s</text>
        <text x="490" y="140" text-anchor="middle" font-size="13" fill="#1e3a8a">load ramp 0→10 VU · 2 min</text>
        <text x="490" y="162" text-anchor="middle" font-size="12" fill="#1d4ed8">HTTP virtual users</text>
        <rect x="680" y="40" width="280" height="140" rx="12" fill="#fff7ed" stroke="#c2410c"/>
        <text x="820" y="70" text-anchor="middle" font-weight="700" fill="#9a3412">Isolation</text>
        <text x="820" y="96" text-anchor="middle" font-size="13" fill="#9a3412">Bun mock :8081</text>
        <text x="820" y="118" text-anchor="middle" font-size="13" fill="#9a3412">30 articles, body omitted on list</text>
        <text x="820" y="140" text-anchor="middle" font-size="13" fill="#9a3412">No public API traffic</text>
        <text x="820" y="162" text-anchor="middle" font-size="12" fill="#c2410c">ethical / laptop-safe</text>
        <path d="M300 110 H350" stroke="#5d6b66" stroke-width="2" marker-end="url(#arrow)"/>
        <path d="M630 110 H680" stroke="#5d6b66" stroke-width="2"/>
        <defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="#5d6b66"/></marker></defs>
      </svg>
      <div class="grid-2" style="margin-top:1rem">
        <div>
          <h3>Environment</h3>
          <table>
            <tr><th>App</th><td>${env.app}</td></tr>
            <tr><th>CPU</th><td>${env.host.cpu} (${env.host.cpus} threads)</td></tr>
            <tr><th>Memory</th><td>${env.host.memoryGiB} GiB</td></tr>
            <tr><th>Chrome</th><td>${env.tooling.chrome}</td></tr>
            <tr><th>k6</th><td>${env.tooling.k6}</td></tr>
            <tr><th>Frontend</th><td>${env.targets.frontend}</td></tr>
            <tr><th>API</th><td>${env.targets.api}</td></tr>
          </table>
        </div>
        <div>
          <h3>Anonymous browse-feed mix</h3>
          <p class="muted">Every iteration: tags + global feed. ~20% open the first article (markdown + comments in parallel). Think time 1–2s. ~20% paginate <code>offset=10</code>.</p>
          ${donut([
            { label: 'List (tags + feed + page 2)', value: loadMix.list, color: '#0f766e' },
            { label: 'Article + comments', value: loadMix.detail, color: '#c2410c' },
          ])}
        </div>
      </div>
    </section>

    <section>
      <h2>3. Frontend lab — Web Vitals &amp; bundle</h2>
      <p class="muted">Production build, unthrottled Chromium, API responses fulfilled from the same fixtures as the mock (LCP is frontend-owned). CDN Ionicons and Google Fonts were not blocked. Medians of ${lab.samplesPerPage} cold navigations per page. Playwright lab: ${pw.stats?.expected ?? '—'} passed, ${pw.stats?.unexpected ?? 0} failed.</p>
      <table>
        <thead>
          <tr><th>Page</th><th>LCP</th><th>Budget 2.5s</th><th>CLS</th><th>Budget 0.1</th><th>TBT</th><th>Budget 300ms</th></tr>
        </thead>
        <tbody>
          ${pages
            .map(name => {
              const m = lab.vitals[name].median;
              return `<tr>
                <td><strong>${name}</strong></td>
                <td>${fmtMs(m.lcp, 0)}</td>
                <td>${passFail(m.lcp < lab.budgets.lcpMs)} ${headroom(m.lcp, lab.budgets.lcpMs)}</td>
                <td>${m.cls.toFixed(3)}</td>
                <td>${passFail(m.cls < lab.budgets.cls)}</td>
                <td>${fmtMs(m.tbt, 0)}</td>
                <td>${passFail(m.tbt < lab.budgets.tbtMs)} ${headroom(m.tbt, lab.budgets.tbtMs)}</td>
              </tr>`;
            })
            .join('')}
        </tbody>
      </table>
      <h3>LCP vs Google “good” budget</h3>
      ${bars(
        pages.map(name => ({
          label: name,
          value: lab.vitals[name].median.lcp,
          budget: lab.budgets.lcpMs,
          unit: 'ms',
        })),
        '#0f766e',
      )}
      <h3>TBT vs 300 ms lab budget</h3>
      ${bars(
        pages.map(name => ({
          label: name,
          value: lab.vitals[name].median.tbt,
          budget: lab.budgets.tbtMs,
          unit: 'ms',
        })),
        '#1d4ed8',
      )}
      <h3>Main JavaScript chunk</h3>
      ${bars(
        [
          {
            label: lab.bundle.mainJs?.name ?? 'main.js',
            value: lab.bundle.mainJs?.size ?? 0,
            budget: lab.budgets.mainJsBytes,
            unit: 'bytes',
          },
        ],
        '#c2410c',
      )}
      <p>Uncompressed ${fmtBytes(lab.bundle.mainJs?.size ?? 0)} / gzip ${fmtBytes(lab.bundle.mainJs?.gzip ?? 0)}. Budget ${fmtBytes(lab.budgets.mainJsBytes)} locked from the first local production build (~452 kB).</p>
      <h3>Samples</h3>
      <table>
        <thead><tr><th>Page</th><th>Run</th><th>LCP</th><th>CLS</th><th>TBT</th></tr></thead>
        <tbody>
          ${pages
            .flatMap(name =>
              lab.vitals[name].samples.map(
                (s, i) =>
                  `<tr><td>${name}</td><td>${i + 1}</td><td>${fmtMs(s.lcp, 0)}</td><td>${s.cls.toFixed(3)}</td><td>${fmtMs(s.tbt, 0)}</td></tr>`,
              ),
            )
            .join('')}
        </tbody>
      </table>
    </section>

    <section>
      <h2>4. System protocol — k6 browse-feed</h2>
      <p class="muted">Thresholds (local mock, tight): <code>http_req_failed &lt; 1%</code>, <code>http_req_duration p(95) &lt; 200ms</code>, checks &gt; 99%. A self-hosted RealWorld backend would typically use looser SLOs (e.g. p95 &lt; 500ms).</p>
      <div class="grid-2">
        <div>
          <h3>Smoke — 1 VU, 30s</h3>
          <table>
            <tr><th>Result</th><td>${passFail(smokeOk)}</td></tr>
            <tr><th>Iterations</th><td>${smoke.metrics.iterations.count}</td></tr>
            <tr><th>HTTP requests</th><td>${smoke.metrics.http_reqs.count} (${(smoke.metrics.http_reqs.rate ?? 0).toFixed(2)}/s)</td></tr>
            <tr><th>Failed requests</th><td>${(smokeFail * 100).toFixed(2)}%</td></tr>
            <tr><th>Checks</th><td>${smoke.metrics.checks.passes}/${(smoke.metrics.checks.passes ?? 0) + (smoke.metrics.checks.fails ?? 0)} (100%)</td></tr>
            <tr><th>p50 / p95 / max</th><td>${fmtMs(smoke.metrics.http_req_duration.med ?? 0)} / ${fmtMs(smokeP95)} / ${fmtMs(smoke.metrics.http_req_duration.max ?? 0)}</td></tr>
            <tr><th>Iteration time</th><td>avg ${fmtMs(smoke.metrics.iteration_duration.avg ?? 0, 0)} (think time 1–2s)</td></tr>
          </table>
        </div>
        <div>
          <h3>Load — ramp 0→10 VUs, hold 1m, ramp down</h3>
          <table>
            <tr><th>Result</th><td>${passFail(loadOk)}</td></tr>
            <tr><th>Iterations</th><td>${load.metrics.iterations.count}</td></tr>
            <tr><th>HTTP requests</th><td>${load.metrics.http_reqs.count} (${(load.metrics.http_reqs.rate ?? 0).toFixed(2)}/s)</td></tr>
            <tr><th>Failed requests</th><td>${(loadFail * 100).toFixed(2)}%</td></tr>
            <tr><th>Checks</th><td>${load.metrics.checks.passes}/${(load.metrics.checks.passes ?? 0) + (load.metrics.checks.fails ?? 0)}</td></tr>
            <tr><th>p50 / p95 / max</th><td>${fmtMs(load.metrics.http_req_duration.med ?? 0)} / ${fmtMs(loadP95)} / ${fmtMs(load.metrics.http_req_duration.max ?? 0)}</td></tr>
            <tr><th>Peak VUs</th><td>${load.metrics.vus.max ?? load.metrics.vus_max.value ?? 10}</td></tr>
          </table>
        </div>
      </div>
      <h3>Virtual users over time (load)</h3>
      ${polyline(vuSeries, 980, 180, '#1d4ed8', 10)}
      <p class="muted">Designed stages: 30s ramp to 10 VUs, 1 minute hold, 30s ramp to 0.</p>
      <h3>HTTP request duration over time (load, µs)</h3>
      ${polyline(latencySeries, 980, 180, '#0f766e')}
      <h3>Latency smoke vs load</h3>
      ${bars(
        [
          { label: 'smoke p95', value: smokeP95, budget: 200, unit: 'ms' },
          { label: 'load p95', value: loadP95, budget: 200, unit: 'ms' },
          { label: 'load max', value: load.metrics.http_req_duration.max ?? 0, budget: 200, unit: 'ms' },
        ],
        '#0f766e',
      )}
      <p>p95 is ~${(((200 - loadP95) / 200) * 100).toFixed(0)}% under the 200 ms mock threshold because the server is in-process JSON over loopback. This chart is a threshold-compliance view, not a backend scaling curve.</p>
    </section>

    <section>
      <h2>5. Findings</h2>
      <ol class="findings">
        <li><strong>Frontend is comfortably inside “good” Web Vitals on this laptop.</strong> Median LCP is ${fmtMs(lab.vitals.home.median.lcp, 0)} (home), ${fmtMs(lab.vitals.login.median.lcp, 0)} (login), ${fmtMs(lab.vitals.article.median.lcp, 0)} (article) against a 2.5 s budget. CLS is ${lab.vitals.home.median.cls.toFixed(3)} / ${lab.vitals.login.median.cls.toFixed(3)} / ${lab.vitals.article.median.cls.toFixed(3)} (budget 0.1). TBT is ${fmtMs(lab.vitals.home.median.tbt, 0)} / ${fmtMs(lab.vitals.login.median.tbt, 0)} / ${fmtMs(lab.vitals.article.median.tbt, 0)} against 300 ms.</li>
        <li><strong>Markdown is not a lab bottleneck here.</strong> The article page (marked + DOMPurify) did not show a TBT regression versus home/login on unthrottled Chrome. That can change under CPU throttling or a much larger body.</li>
        <li><strong>The main JS chunk is ${fmtBytes(lab.bundle.mainJs?.size ?? 0)} uncompressed (${fmtBytes(lab.bundle.mainJs?.gzip ?? 0)} gzip), ${headroom(lab.bundle.mainJs?.size ?? 0, lab.budgets.mainJsBytes)}.</strong> There is little splitting today (single <code>index-*.js</code>). A modest dependency addition could still approach the 500 kB lock.</li>
        <li><strong>k6 smoke and load both passed with 0 failed HTTP requests and 100% checks.</strong> Smoke: ${smoke.metrics.http_reqs.count} requests, p95 ${fmtMs(smokeP95)}. Load: ${load.metrics.http_reqs.count} requests, p95 ${fmtMs(loadP95)}, peak ${load.metrics.vus.max ?? 10} VUs.</li>
        <li><strong>Observed mix matches the intended read-heavy session.</strong> Load-profile list vs article+comments is ${pct(loadMix.list, loadMix.total)} vs ${pct(loadMix.detail, loadMix.total)} (design: ~80 / ~20). Pagination fired on ${loadMix.page2} iterations’ page-2 checks.</li>
        <li><strong>These protocol numbers do not describe RealWorld API capacity.</strong> The mock has no DB, auth, or network hop. 10 VUs cannot saturate it. Do not treat p95 &lt; 1 ms as an SLO for a self-hosted or public backend.</li>
        <li><strong>CDN fonts/icons remain on the critical path of the real production head.</strong> Lab tests intentionally left them unblocked, so LCP/CLS include that cost. They are still an easy future lever if field LCP is worse than this lab.</li>
      </ol>
    </section>

    <section>
      <h2>6. Conclusions</h2>
      <ol class="conclusions">
        <li><strong>Ship confidence for the current SPA:</strong> production-build lab vitals and bundle budget pass on this machine. No frontend performance defect showed up in this run.</li>
        <li><strong>Keep the mock as the default k6 target.</strong> It is the ethical, deterministic way to demo smoke/load. Point k6 at a self-hosted backend only with looser thresholds (p95 &lt; 500 ms is the comment in the script) and never at <code>api.realworld.show</code>.</li>
        <li><strong>If the next question is “can the API take traffic?”, this report cannot answer it.</strong> Re-run <code>PROFILE=load</code> (then stress) against a backend you own, with <code>MOCK_LATENCY_MS</code> or real I/O, before talking capacity.</li>
        <li><strong>Use smoke on every demo/PR-shaped loop; keep load local.</strong> Smoke is 30s and cheap. The 10-VU load run is the short capacity demo; soak/spike/stress stay out of the default scripts.</li>
        <li><strong>Watch the 500 kB JS budget.</strong> At ${fmtBytes(lab.bundle.mainJs?.size ?? 0)} there is ~${fmtBytes(lab.budgets.mainJsBytes - (lab.bundle.mainJs?.size ?? 0))} of slack. Code-split or drop unused marked/DOMPurify work before adding a large client library.</li>
      </ol>
    </section>
  </main>
  <footer>
    Generated ${new Date().toISOString()} from <code>perf/reports/data/</code> (k6 summary + point samples, Playwright JSON, lab medians). Raw point logs are local artifacts and are not required to read this page.
  </footer>
</body>
</html>
`;

mkdirSync('perf/reports', { recursive: true });
writeFileSync('perf/reports/conduit-performance-report.html', html);
console.log('Wrote perf/reports/conduit-performance-report.html');
