# Performance tests

Tiered checks for the Conduit SPA. Frontend lab tests catch bundle and render regressions on a **production** build. System tests catch API/capacity issues with cheap HTTP virtual users against a **local mock**.

Do **not** load-test `https://api.realworld.show`. That API is not ours.

## Quick start

```bash
bun run setup          # if needed
bun run perf:mock      # terminal 1 — local RealWorld mock on :8081
bun run perf:system    # terminal 2 — k6 smoke (1 VU, 30s)
bun run perf:frontend  # Web Vitals + bundle budget against vite preview
```

One-shot smoke (starts the mock if it is not already up, then runs k6):

```bash
bun run perf:demo
```

Optional short load (10 VUs, ~2 minutes). The mock must already be running:

```bash
bun run perf:system:load
```

## Scripts

| Script             | What it does                                                                        |
| ------------------ | ----------------------------------------------------------------------------------- |
| `perf:mock`        | Bun mock API on `http://localhost:8081/api`                                         |
| `perf:system`      | k6 **smoke**: 1 VU, 30s                                                             |
| `perf:system:load` | k6 **load**: ramp 0→10 VUs / 30s, hold 1m, ramp down                                |
| `perf:frontend`    | Production `vite build` + `vite preview` + Playwright Web Vitals + JS bundle budget |
| `perf:demo`        | Start mock if needed, then k6 smoke                                                 |

Point the SPA at the mock during local UI work:

```bash
VITE_API_BASE=http://localhost:8081/api bun run start
```

Production builds still default to `https://api.realworld.show/api`.

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

No register, login, or writes — those paths are sparse and would mutate a real backend.

Thresholds are tight for the in-process mock (`http_req_failed < 1%`, p95 `< 200ms`, checks `> 99%`). A self-hosted RealWorld backend should use looser SLOs (for example p95 `< 500ms`). Override the script’s `http_req_duration` threshold if you point k6 at your own server.

## k6

Prefer a local `k6` binary. `perf:system` / `perf:system:load` / `perf:demo` fall back to:

```bash
docker run --rm --network host -v "$PWD":/src -w /src grafana/k6 run -e PROFILE=smoke perf/k6/browse-feed.js
```

`--network host` lets the container reach `localhost:8081` (Linux). On Docker Desktop (macOS/Windows), host networking does not work the same way; install a local k6 binary instead.

Point k6 at a **self-hosted** RealWorld backend later (never the public demo API):

```bash
API_BASE=http://localhost:3000/api bun run perf:system
```

## Frontend lab

`playwright.perf.config.ts` is separate from the RealWorld e2e suite (no `slowMo`). It builds the app, serves `vite preview` on port 4200, and runs:

- Web Vitals on `/`, `/login`, and `/article/{fixture-slug}` (LCP `< 2.5s`, CLS `< 0.1`, TBT `< 300ms`)
- Bundle budget: largest `dist/assets/*.js` chunk ≤ 500 kB uncompressed (locked from the first local production build, ~452 kB)

Playwright `page.route` fulfills API calls from `perf/fixtures/browse-feed.ts` so metrics are frontend-owned. CDN Ionicons and Google Fonts stay unblocked so budgets match the real production head.

If something is already listening on port 4200, Playwright reuses it. For a true lab run, stop `bun run start` first (or run `bun run build && bun run preview` yourself) so tests hit a production preview rather than the Vite dev server.

## Mock API

`perf/mock-api/server.ts` serves the RealWorld JSON subset used by browse-feed:

- `GET /api/tags`
- `GET /api/articles` (list payloads **omit** `article.body`)
- `GET /api/articles/:slug` (includes markdown `body`)
- `GET /api/articles/:slug/comments`

About 30 fixture articles so pagination is real. Optional latency:

```bash
MOCK_LATENCY_MS=30 bun run perf:mock
```

## Out of scope (v1)

- CI workflow
- k6 browser hybrid / Lighthouse CI
- Hitting `api.realworld.show` with more than 0 VUs
- Authenticated write mix; soak/stress/spike as runnable defaults
- Adding `web-vitals` RUM to the app
