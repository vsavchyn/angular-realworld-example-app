# Performance tests

Tiered checks that run on both Conduit SPAs. Angular (`main`) and React (`react-migration`) share this lab after you merge it.

Frontend lab tests catch bundle and render regressions on a **production** static preview. System tests catch protocol issues with cheap HTTP virtual users against a **local mock**.

Do **not** load-test `https://api.realworld.show`. That API is not ours.

## Quick start

```bash
bun run setup          # if needed
bun run perf:mock      # terminal 1 — local RealWorld mock on :8081
bun run perf:system    # terminal 2 — k6 smoke (1 VU, 30s)
bun run perf:frontend  # Web Vitals + JS bundle budget against the production preview
bun run perf:lab       # 5 cold samples/page → perf/reports/data/<app>/lab.json
```

One-shot smoke (starts the mock if it is not already up, then runs k6):

```bash
bun run perf:demo
```

Compare Angular (`main` / this branch) to React (`react-migration`). Sequential on one machine so CPU and port `:4200` stay fair:

```bash
bun run perf:compare
```

That overlays the harness onto a `react-migration` worktree, runs both labs, runs k6 smoke, and writes `perf/reports/angular-vs-react.html`.

## Scripts

| Script             | What it does                                                                           |
| ------------------ | -------------------------------------------------------------------------------------- |
| `perf:mock`        | Bun mock API on `http://localhost:8081/api`                                            |
| `perf:system`      | k6 **smoke**: 1 VU, 30s, writes `perf/reports/data/k6-smoke.json`                      |
| `perf:system:load` | k6 **load**: ramp 0→10 VUs / 30s, hold 1m, ramp down                                   |
| `perf:frontend`    | Production `bun run build` + static preview + Playwright Web Vitals + JS bundle budget |
| `perf:lab`         | 5 cold Chromium samples per page. Writes `perf/reports/data/<angular\|react>/lab.json` |
| `perf:demo`        | Start mock if needed, then k6 smoke                                                    |
| `perf:compare`     | Sequential Angular then React labs, then the comparison HTML                           |
| `perf:report`      | Rebuild `perf/reports/angular-vs-react.html` from snapshots already on disk            |

The lab detects the SPA from `angular.json` vs `vite.config.ts`. You do not pass a target flag.

Point the SPA at the mock during local UI work:

```bash
# React
VITE_API_BASE=http://localhost:8081/api bun run start
```

Angular hardcodes `https://api.realworld.show/api` in the interceptor. Lab tests intercept `/api/` in the browser, so they do not need that change.

## Profiles

| Profile               | When to use                        | Shape                       |
| --------------------- | ---------------------------------- | --------------------------- |
| smoke                 | Every local demo / future PR check | 1 VU for 30s                |
| load                  | Local capacity demo                | 10 VUs, ~2 minutes          |
| stress / spike / soak | Documented only, not a default     | Not wired to `package.json` |

### Anonymous browse-feed

Most Conduit traffic is read-heavy. `perf/k6/browse-feed.js` models one session:

1. `GET /api/tags`
2. `GET /api/articles?limit=10&offset=0`
3. ~20% of iterations also open the first article (`GET` article + comments, in parallel)
4. Think time 1–2s
5. ~20% of iterations paginate (`offset=10`)

No register, login, or writes.

Thresholds are tight for the in-process mock (`http_req_failed < 1%`, p95 `< 200ms`, checks `> 99%`). A self-hosted RealWorld backend should use looser SLOs (for example p95 `< 500ms`).

## Frontend lab

`playwright.perf.config.ts` is separate from the RealWorld e2e suite. It builds the app, serves `perf/preview-server.ts` on port 4200 (SPA fallback), and runs:

- Web Vitals on `/`, `/login`, and `/article/{fixture-slug}` (LCP `< 2.5s`, CLS `< 0.1`, TBT `< 300ms`)
- Bundle budget on the largest JS file under the production dist root
  - Angular `dist/angular-conduit/browser` (1 MB, matches `angular.json` initial `maximumError`)
  - React `dist` (500 kB)

Playwright `page.route` fulfills API calls from `perf/fixtures/browse-feed.ts` so metrics are frontend-owned. CDN Ionicons and Google Fonts stay unblocked.

If something is already listening on port 4200, Playwright reuses it. Stop `bun run start` first so tests hit the production preview rather than the dev server.

## Mock API

`perf/mock-api/server.ts` serves the RealWorld JSON subset used by browse-feed. Optional latency:

```bash
MOCK_LATENCY_MS=30 bun run perf:mock
```

## Out of scope (v1)

- CI workflow
- k6 browser hybrid / Lighthouse CI
- Hitting `api.realworld.show` with more than 0 VUs
- Authenticated write mix; soak/stress/spike as runnable defaults
- Adding `web-vitals` RUM to the app
