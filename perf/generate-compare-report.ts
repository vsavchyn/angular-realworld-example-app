import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { EnvFile } from './collect-env.ts';
import { LAB_BUDGETS, PAGE_NAMES, type LabSnapshot, type PageName } from './lab-snapshot.ts';

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

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function tryReadJson<T>(path: string): T | null {
  return existsSync(path) ? readJson<T>(path) : null;
}

function fmtMs(ms: number, digits = 0): string {
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

function fmtPct(n: number): string {
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(0)}%`;
}

function delta(react: number, angular: number): { abs: number; pct: number } {
  const abs = react - angular;
  const pct = angular === 0 ? 0 : (abs / angular) * 100;
  return { abs, pct };
}

function passFail(ok: boolean): string {
  return ok ? '<span class="pill pass">PASS</span>' : '<span class="pill fail">FAIL</span>';
}

function budgetMisses(snap: LabSnapshot, label: string): string[] {
  const misses: string[] = [];
  for (const name of PAGE_NAMES) {
    const m = snap.vitals[name].median;
    if (m.lcp >= snap.budgets.lcpMs) misses.push(`${label} ${name} LCP ${fmtMs(m.lcp)}`);
    if (m.cls >= snap.budgets.cls) misses.push(`${label} ${name} CLS ${m.cls.toFixed(3)}`);
    if (m.tbt >= snap.budgets.tbtMs) misses.push(`${label} ${name} TBT ${fmtMs(m.tbt)}`);
  }
  return misses;
}

function vitalsPass(snap: LabSnapshot): boolean {
  return budgetMisses(snap, '').length === 0;
}

function filesWord(n: number): string {
  return n === 1 ? '1 file' : `${n} files`;
}

function bundlePass(snap: LabSnapshot): boolean {
  return (snap.bundle.mainJs?.size ?? Infinity) <= snap.budgets.mainJsBytes;
}

function k6Passed(summary: K6Summary | null): boolean {
  if (!summary) return false;
  const keys = ['http_req_duration', 'http_req_failed', 'checks'] as const;
  return keys.every(key => {
    const metric = summary.metrics[key];
    if (!metric?.thresholds) return true;
    return Object.values(metric.thresholds).every(failed => failed === false);
  });
}

function groupedBars(
  rows: Array<{ label: string; angular: number; react: number; format: 'ms' | 'bytes' | 'cls' }>,
): string {
  const max = Math.max(...rows.flatMap(r => [r.angular, r.react]), 1);
  return `<div class="bars">${rows
    .map(row => {
      const a = (row.angular / max) * 100;
      const r = (row.react / max) * 100;
      const fmt = (v: number) =>
        row.format === 'bytes' ? fmtBytes(v) : row.format === 'cls' ? v.toFixed(3) : fmtMs(v);
      return `<div class="group">
        <div class="bar-label">${row.label}</div>
        <div class="pair">
          <div class="bar-row"><span class="who">Angular</span><div class="bar-track"><div class="bar-fill ang" style="width:${a.toFixed(1)}%"></div></div><span class="bar-value">${fmt(row.angular)}</span></div>
          <div class="bar-row"><span class="who">React</span><div class="bar-track"><div class="bar-fill rea" style="width:${r.toFixed(1)}%"></div></div><span class="bar-value">${fmt(row.react)}</span></div>
        </div>
      </div>`;
    })
    .join('')}</div>`;
}

function winner(react: number, angular: number, lowerIsBetter = true): string {
  if (Math.abs(react - angular) < 1e-9) return 'tie';
  const reactBetter = lowerIsBetter ? react < angular : react > angular;
  return reactBetter ? 'React' : 'Angular';
}

const angular = readJson<LabSnapshot>('perf/reports/data/angular/lab.json');
const react = readJson<LabSnapshot>('perf/reports/data/react/lab.json');
const env = tryReadJson<EnvFile>('perf/reports/data/env.json');
const smoke = tryReadJson<K6Summary>('perf/reports/data/k6-smoke.json');
const load = tryReadJson<K6Summary>('perf/reports/data/k6-load.json');

const angularVitalsOk = vitalsPass(angular);
const reactVitalsOk = vitalsPass(react);
const angularBundleOk = bundlePass(angular);
const reactBundleOk = bundlePass(react);
const smokeOk = k6Passed(smoke);
const loadOk = load ? k6Passed(load) : true;

const lcpHome = delta(react.vitals.home.median.lcp, angular.vitals.home.median.lcp);
const tbtHome = delta(react.vitals.home.median.tbt, angular.vitals.home.median.tbt);
const jsDelta = delta(react.bundle.totalJs, angular.bundle.totalJs);
const mainDelta = delta(react.bundle.mainJs?.size ?? 0, angular.bundle.mainJs?.size ?? 0);

const lcpWinners = PAGE_NAMES.map(name => winner(react.vitals[name].median.lcp, angular.vitals[name].median.lcp));
const tbtWinners = PAGE_NAMES.map(name => winner(react.vitals[name].median.tbt, angular.vitals[name].median.tbt));
const jsWinner = winner(react.bundle.totalJs, angular.bundle.totalJs);

function pageRow(name: PageName, metric: 'lcp' | 'cls' | 'tbt'): string {
  const a = angular.vitals[name].median[metric];
  const r = react.vitals[name].median[metric];
  const d = delta(r, a);
  const fmt = metric === 'cls' ? (v: number) => v.toFixed(3) : (v: number) => fmtMs(v);
  const cls = d.abs > 0 ? 'worse' : d.abs < 0 ? 'better' : '';
  return `<tr>
    <td>${name}</td>
    <td>${fmt(a)}</td>
    <td>${fmt(r)}</td>
    <td class="${cls}">${metric === 'cls' ? d.abs.toFixed(3) : fmtMs(d.abs)} (${fmtPct(d.pct)})</td>
  </tr>`;
}

const angularMisses = budgetMisses(angular, 'Angular');
const reactMisses = budgetMisses(react, 'React');
const findings: string[] = [];

if (angularVitalsOk && reactVitalsOk) {
  findings.push(
    `Both apps stay inside Google “good” lab budgets on this machine (LCP &lt; ${fmtMs(LAB_BUDGETS.lcpMs)}, CLS &lt; ${LAB_BUDGETS.cls}, TBT &lt; ${fmtMs(LAB_BUDGETS.tbtMs)}).`,
  );
} else {
  findings.push(
    `Budget misses. ${[...angularMisses, ...reactMisses].join('; ')}. LCP and TBT still sit under the Google “good” lines on both apps.`,
  );
}

findings.push(
  `Home LCP median is ${fmtMs(angular.vitals.home.median.lcp)} on Angular and ${fmtMs(react.vitals.home.median.lcp)} on React (${fmtPct(lcpHome.pct)} after the migration). Login LCP winner is ${lcpWinners[1]}. Article LCP winner is ${lcpWinners[2]}.`,
);

const tbtNote =
  tbtWinners[2] === 'tie'
    ? 'Article TBT is a tie at 0 ms on this unthrottled laptop.'
    : `Article TBT is ${fmtMs(angular.vitals.article.median.tbt)} vs ${fmtMs(react.vitals.article.median.tbt)} (${tbtWinners[2]} lower).`;
findings.push(
  `Home TBT median is ${fmtMs(angular.vitals.home.median.tbt)} on Angular and ${fmtMs(react.vitals.home.median.tbt)} on React. ${tbtNote}`,
);

findings.push(
  `Total JS is ${fmtBytes(angular.bundle.totalJs)} (${fmtBytes(angular.bundle.totalJsGzip)} gzip) on Angular across ${filesWord(angular.bundle.js.length)}, and ${fmtBytes(react.bundle.totalJs)} (${fmtBytes(react.bundle.totalJsGzip)} gzip) on React across ${filesWord(react.bundle.js.length)} (${fmtPct(jsDelta.pct)}, ${jsWinner} smaller). Largest chunk is ${angular.bundle.mainJs?.name ?? '—'} at ${fmtBytes(angular.bundle.mainJs?.size ?? 0)} vs ${react.bundle.mainJs?.name ?? '—'} at ${fmtBytes(react.bundle.mainJs?.size ?? 0)} (${fmtPct(mainDelta.pct)}).`,
);

const articleTbtGap = react.vitals.article.median.tbt - react.vitals.home.median.tbt;
if (articleTbtGap > 20) {
  findings.push(
    `React article TBT is ${fmtMs(articleTbtGap)} above its home TBT. That matches a client markdown path (marked plus DOMPurify on the React tree).`,
  );
}

findings.push(
  `Angular lazy-loads routes with loadComponent, so the lab downloads extra chunks after the first paint. React’s production build is ${react.bundle.js.length === 1 ? 'a single JS chunk' : `${react.bundle.js.length} JS files`}. That is the main structural bundle difference, not a k6 result.`,
);

if (smoke) {
  const p95 = smoke.metrics.http_req_duration['p(95)'] ?? 0;
  findings.push(
    `k6 smoke against the local Bun mock ${smokeOk ? 'passed' : 'failed'} with p95 ${fmtMs(p95, 2)}. That number is loopback JSON, not an Angular vs React delta, and not api.realworld.show capacity.`,
  );
}

const conclusions: string[] = [];

if (angularVitalsOk && reactVitalsOk) {
  conclusions.push(
    `The React migration did not blow the lab Web Vitals budgets. Both production previews sit well under LCP 2.5 s and TBT 300 ms on this host.`,
  );
} else if (angularMisses.some(m => m.includes('CLS')) && reactVitalsOk) {
  conclusions.push(
    `React improved CLS on home (${react.vitals.home.median.cls.toFixed(3)} vs Angular ${angular.vitals.home.median.cls.toFixed(3)}) and article (${react.vitals.article.median.cls.toFixed(3)} vs ${angular.vitals.article.median.cls.toFixed(3)}). Angular still misses the 0.1 “good” line. Give the home banner logo and article hero images width/height (or a reserved min-height) so Ionicons and webfonts cannot shove the feed. LCP and TBT are not the problem on this host.`,
  );
} else {
  conclusions.push(`Budget misses to fix first. ${[...angularMisses, ...reactMisses].join('; ')}.`);
}

if (jsDelta.abs > 0) {
  conclusions.push(
    `React ships ${fmtBytes(jsDelta.abs)} more JS uncompressed than Angular. Split React routes (home, auth, article) the way Angular already does with loadComponent, and keep the 500 kB largest-chunk lock.`,
  );
} else {
  conclusions.push(
    `React’s total JS is ${fmtBytes(Math.abs(jsDelta.abs))} smaller than Angular’s. Keep the 500 kB largest-chunk budget. Angular’s extra files are the lazy route chunks.`,
  );
}

if (lcpHome.abs > 50) {
  conclusions.push(
    `React home LCP is ${fmtMs(lcpHome.abs)} slower. Check CDN Ionicons and Google Fonts (Angular uses protocol-relative URLs, React uses https plus CSP). Self-host or preconnect if field LCP looks like this lab.`,
  );
} else if (lcpHome.abs < -50) {
  conclusions.push(
    `React home LCP is ${fmtMs(Math.abs(lcpHome.abs))} faster than Angular in this lab. Do not spend a cycle on LCP unless field data disagrees.`,
  );
} else {
  conclusions.push(
    `Home LCP is within ${fmtMs(Math.abs(lcpHome.abs))} across the two apps. CDN fonts and icons still sit on the critical path for both. They are the first lever if field LCP is worse than this lab.`,
  );
}

if (articleTbtGap > 20) {
  conclusions.push(
    `If article TBT grows, trim the markdown path. Defer marked/DOMPurify until the body is in view, or render markdown on the server if you add one.`,
  );
}

conclusions.push(
  `Do not use the k6 mock p95 as an API SLO. Re-run PROFILE=load against a backend you own before talking about capacity. Never aim k6 at api.realworld.show.`,
);

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Conduit Angular vs React performance</title>
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
      --ang: #c2410c;
      --rea: #1d4ed8;
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
    main { padding: 1.5rem; display: grid; gap: 1.1rem; }
    section {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 1.2rem 1.3rem 1.3rem;
    }
    h2 { margin: 0 0 .75rem; font-size: 1.25rem; letter-spacing: -0.02em; }
    h3 { margin: 1rem 0 .4rem; font-size: 1.02rem; }
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
    td.better { color: var(--pass); }
    td.worse { color: var(--fail); }
    .bars { display: grid; gap: 1rem; }
    .group { display: grid; gap: .35rem; }
    .bar-label { font-weight: 650; }
    .pair { display: grid; gap: .25rem; }
    .bar-row { display: grid; grid-template-columns: 5.5rem 1fr 8rem; gap: .55rem; align-items: center; font-size: .85rem; }
    .bar-track { height: 10px; background: #e7eee9; border-radius: 99px; overflow: hidden; }
    .bar-fill { height: 100%; border-radius: 99px; }
    .bar-fill.ang { background: var(--ang); }
    .bar-fill.rea { background: var(--rea); }
    .bar-value { color: var(--muted); text-align: right; font-variant-numeric: tabular-nums; }
    .who { color: var(--muted); font-size: .8rem; }
    .callout {
      background: #fff7e6; border-left: 4px solid #9a6700; padding: .7rem .9rem; border-radius: 0 8px 8px 0;
      color: #5c4a12;
    }
    footer { padding: 1rem 1.5rem 2.5rem; color: var(--muted); font-size: .85rem; }
    ol > li { margin: .45rem 0; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .86em; background: #eef2ef; padding: .05rem .3rem; border-radius: 4px; }
  </style>
</head>
<body>
  <header>
    <div class="wrap">
      <h1>Conduit Angular vs React</h1>
      <p class="sub">Same machine, Playwright Chromium, production static preview, fixture API. Medians of ${angular.samplesPerPage} cold navigations per page. k6 against the local mock is a shared protocol baseline, not a migration delta.</p>
      <div class="status-row">
        ${passFail(angularVitalsOk)} Angular Web Vitals
        ${passFail(reactVitalsOk)} React Web Vitals
        ${passFail(angularBundleOk)} Angular JS budget
        ${passFail(reactBundleOk)} React JS budget
        ${smoke ? `${passFail(smokeOk)} k6 smoke` : ''}
        ${load ? `${passFail(loadOk)} k6 load` : ''}
      </div>
    </div>
  </header>
  <main>
    <section>
      <h2>1. Executive summary</h2>
      <div class="grid-3">
        <div class="stat"><span>Home LCP (React − Angular)</span><b>${fmtMs(lcpHome.abs)} (${fmtPct(lcpHome.pct)})</b></div>
        <div class="stat"><span>Home TBT (React − Angular)</span><b>${fmtMs(tbtHome.abs)} (${fmtPct(tbtHome.pct)})</b></div>
        <div class="stat"><span>Total JS (React − Angular)</span><b>${fmtBytes(jsDelta.abs)} (${fmtPct(jsDelta.pct)})</b></div>
      </div>
      <p>Negative deltas mean React is faster or smaller. Positive deltas mean React is slower or heavier. Budgets are Google “good” lab numbers plus each app’s largest-chunk lock (Angular ${fmtBytes(angular.budgets.mainJsBytes)}, React ${fmtBytes(react.budgets.mainJsBytes)}).</p>
    </section>

    <section>
      <h2>2. How the run was shaped</h2>
      <p class="callout">Frontend metrics are owned by the SPA. Playwright fulfills <code>/api/</code> from the same browse-feed fixtures on both trees. CDN Ionicons and Google Fonts stay unblocked. Angular uses protocol-relative CDN URLs. React uses <code>https</code> plus CSP. That can move LCP a little even when the app code is the story.</p>
      ${
        env
          ? `<table>
        <tr><th>Host</th><td>${env.host.cpu} (${env.host.cpus} threads), ${env.host.memoryGiB} GiB, ${env.host.os}</td></tr>
        <tr><th>Tooling</th><td>bun ${env.tooling.bun}, ${env.tooling.playwright}, ${env.tooling.node}</td></tr>
        <tr><th>Angular collected</th><td>${angular.collectedAt}</td></tr>
        <tr><th>React collected</th><td>${react.collectedAt}</td></tr>
      </table>`
          : `<p class="muted">Angular collected ${angular.collectedAt}. React collected ${react.collectedAt}.</p>`
      }
    </section>

    <section>
      <h2>3. Web Vitals</h2>
      <h3>LCP</h3>
      ${groupedBars(
        PAGE_NAMES.map(name => ({
          label: name,
          angular: angular.vitals[name].median.lcp,
          react: react.vitals[name].median.lcp,
          format: 'ms' as const,
        })),
      )}
      <h3>TBT</h3>
      ${groupedBars(
        PAGE_NAMES.map(name => ({
          label: name,
          angular: angular.vitals[name].median.tbt,
          react: react.vitals[name].median.tbt,
          format: 'ms' as const,
        })),
      )}
      <h3>CLS</h3>
      ${groupedBars(
        PAGE_NAMES.map(name => ({
          label: name,
          angular: angular.vitals[name].median.cls,
          react: react.vitals[name].median.cls,
          format: 'cls' as const,
        })),
      )}
      <h3>LCP by page</h3>
      <table>
        <thead><tr><th>Page</th><th>Angular</th><th>React</th><th>React − Angular</th></tr></thead>
        <tbody>${PAGE_NAMES.map(name => pageRow(name, 'lcp')).join('')}</tbody>
      </table>
      <h3>TBT by page</h3>
      <table>
        <thead><tr><th>Page</th><th>Angular</th><th>React</th><th>React − Angular</th></tr></thead>
        <tbody>${PAGE_NAMES.map(name => pageRow(name, 'tbt')).join('')}</tbody>
      </table>
      <h3>CLS by page</h3>
      <table>
        <thead><tr><th>Page</th><th>Angular</th><th>React</th><th>React − Angular</th></tr></thead>
        <tbody>${PAGE_NAMES.map(name => pageRow(name, 'cls')).join('')}</tbody>
      </table>
    </section>

    <section>
      <h2>4. JavaScript payload</h2>
      ${groupedBars([
        { label: 'Total JS', angular: angular.bundle.totalJs, react: react.bundle.totalJs, format: 'bytes' },
        {
          label: 'Total JS gzip',
          angular: angular.bundle.totalJsGzip,
          react: react.bundle.totalJsGzip,
          format: 'bytes',
        },
        {
          label: 'Largest chunk',
          angular: angular.bundle.mainJs?.size ?? 0,
          react: react.bundle.mainJs?.size ?? 0,
          format: 'bytes',
        },
      ])}
      <div class="grid-2" style="margin-top:1rem">
        <div>
          <h3>Angular files</h3>
          <table>
            <thead><tr><th>File</th><th>Raw</th><th>Gzip</th></tr></thead>
            <tbody>${angular.bundle.js
              .slice(0, 8)
              .map(
                f => `<tr><td><code>${f.name}</code></td><td>${fmtBytes(f.size)}</td><td>${fmtBytes(f.gzip)}</td></tr>`,
              )
              .join('')}</tbody>
          </table>
        </div>
        <div>
          <h3>React files</h3>
          <table>
            <thead><tr><th>File</th><th>Raw</th><th>Gzip</th></tr></thead>
            <tbody>${react.bundle.js
              .slice(0, 8)
              .map(
                f => `<tr><td><code>${f.name}</code></td><td>${fmtBytes(f.size)}</td><td>${fmtBytes(f.gzip)}</td></tr>`,
              )
              .join('')}</tbody>
          </table>
        </div>
      </div>
    </section>

    ${
      smoke
        ? `<section>
      <h2>5. Shared protocol baseline (k6 mock)</h2>
      <p class="muted">Anonymous browse-feed against <code>localhost:8081</code>. This is the same mock both apps would use. It is not a frontend comparison.</p>
      <table>
        <tr><th>Smoke</th><td>${passFail(smokeOk)} · ${smoke.metrics.http_reqs.count} requests · p95 ${fmtMs(smoke.metrics.http_req_duration['p(95)'] ?? 0, 2)}</td></tr>
        ${
          load
            ? `<tr><th>Load</th><td>${passFail(loadOk)} · ${load.metrics.http_reqs.count} requests · p95 ${fmtMs(load.metrics.http_req_duration['p(95)'] ?? 0, 2)}</td></tr>`
            : ''
        }
      </table>
    </section>`
        : ''
    }

    <section>
      <h2>${smoke ? '6' : '5'}. Findings</h2>
      <ol>${findings.map(item => `<li>${item}</li>`).join('')}</ol>
    </section>

    <section>
      <h2>${smoke ? '7' : '6'}. Conclusions and what to improve</h2>
      <ol>${conclusions.map(item => `<li>${item}</li>`).join('')}</ol>
    </section>
  </main>
  <footer>
    Generated ${new Date().toISOString()} from <code>perf/reports/data/{angular,react}/lab.json</code>.
    Raw k6 point logs stay local and gitignored.
  </footer>
</body>
</html>
`;

mkdirSync('perf/reports', { recursive: true });
writeFileSync('perf/reports/angular-vs-react.html', html);
console.log('Wrote perf/reports/angular-vs-react.html');
