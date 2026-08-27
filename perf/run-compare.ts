import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const HARNESS_FILES = [
  'perf/app-profile.ts',
  'perf/lab-snapshot.ts',
  'perf/lab-pages.ts',
  'perf/preview-server.ts',
  'perf/ensure-preview.ts',
  'perf/collect-env.ts',
  'perf/collect-lab-metrics.ts',
  'perf/run-k6.ts',
  'perf/run-demo.ts',
  'perf/fixtures/browse-feed.ts',
  'perf/mock-api/server.ts',
  'perf/k6/browse-feed.js',
  'tests/perf/helpers.ts',
  'tests/perf/web-vitals.spec.ts',
  'tests/perf/bundle-budget.spec.ts',
  'playwright.perf.config.ts',
];

const PERF_SCRIPTS = {
  'perf:mock': 'bun run perf/mock-api/server.ts',
  'perf:frontend': 'playwright test -c playwright.perf.config.ts',
  'perf:lab': 'bun run perf/collect-lab-metrics.ts',
  'perf:system': 'bun run perf/run-k6.ts smoke',
  'perf:system:load': 'bun run perf/run-k6.ts load',
  'perf:demo': 'bun run perf/run-demo.ts',
};

function git(cwd: string, args: string[]): Promise<number> {
  return run(cwd, 'git', args);
}

async function run(cwd: string, command: string, args: string[]): Promise<number> {
  const proc = Bun.spawn([command, ...args], {
    cwd,
    stderr: 'inherit',
    stdout: 'inherit',
  });
  return proc.exited;
}

async function capture(cwd: string, command: string, args: string[]): Promise<string> {
  const proc = Bun.spawn([command, ...args], {
    cwd,
    stderr: 'pipe',
    stdout: 'pipe',
  });
  const text = await new Response(proc.stdout).text();
  await proc.exited;
  return text.trim();
}

function overlayHarness(from: string, to: string): void {
  for (const rel of HARNESS_FILES) {
    const dest = join(to, rel);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(join(from, rel), dest);
  }
  const pkgPath = join(to, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
    scripts: Record<string, string>;
  };
  pkg.scripts = { ...pkg.scripts, ...PERF_SCRIPTS };
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
}

async function prepareTree(cwd: string): Promise<void> {
  if (!existsSync(join(cwd, 'realworld', 'assets'))) {
    const sub = await run(cwd, 'git', ['submodule', 'update', '--init', '--recursive']);
    if (sub !== 0) {
      throw new Error(`git submodule update failed in ${cwd}`);
    }
  }
  if (!existsSync(join(cwd, 'node_modules'))) {
    const install = await run(cwd, 'bun', ['install', '--registry', 'https://registry.npmjs.org']);
    if (install !== 0) {
      throw new Error(`bun install failed in ${cwd}`);
    }
  }
  const browsers = await run(cwd, 'bunx', ['playwright', 'install', 'chromium']);
  if (browsers !== 0) {
    throw new Error(`playwright install chromium failed in ${cwd}`);
  }
}

async function runLab(cwd: string): Promise<void> {
  const frontend = await run(cwd, 'bun', ['run', 'perf:frontend']);
  if (frontend !== 0) {
    console.warn(`perf:frontend failed in ${cwd} (continuing so lab medians still get recorded)`);
  }
  const lab = await run(cwd, 'bun', ['run', 'perf:lab']);
  if (lab !== 0) {
    throw new Error(`perf:lab failed in ${cwd}`);
  }
}

const here = (await capture(process.cwd(), 'git', ['rev-parse', '--show-toplevel'])) || process.cwd();
const parent = dirname(here);
const reactWt = join(parent, 'angular-realworld-example-app-react-perf');

if (!existsSync(join(reactWt, '.git')) && !existsSync(join(reactWt, 'package.json'))) {
  console.log(`Adding worktree ${reactWt} from origin/react-migration`);
  const add = await git(here, ['worktree', 'add', '--force', reactWt, 'origin/react-migration']);
  if (add !== 0) {
    throw new Error('git worktree add failed for origin/react-migration');
  }
}

console.log('Overlaying perf harness onto the React worktree');
overlayHarness(here, reactWt);

console.log('Preparing Angular tree');
await prepareTree(here);
console.log('Running Angular lab');
await runLab(here);

console.log('Preparing React tree');
await prepareTree(reactWt);
console.log('Running React lab');
await runLab(reactWt);

const reactLab = join(reactWt, 'perf/reports/data/react/lab.json');
const destDir = join(here, 'perf/reports/data/react');
mkdirSync(destDir, { recursive: true });
if (!existsSync(reactLab)) {
  throw new Error(`React lab snapshot missing at ${reactLab}`);
}
copyFileSync(reactLab, join(destDir, 'lab.json'));

console.log('Running k6 smoke against the mock (shared protocol baseline)');
const demo = await run(here, 'bun', ['run', 'perf:demo']);
if (demo !== 0) {
  throw new Error('perf:demo (k6 smoke) failed');
}

const report = await run(here, 'bun', ['run', 'perf/generate-compare-report.ts']);
if (report !== 0) {
  throw new Error('generate-compare-report failed');
}

console.log('Wrote perf/reports/angular-vs-react.html');
