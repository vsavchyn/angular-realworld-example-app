import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

export type AppKind = 'angular' | 'react';

export type AppProfile = {
  kind: AppKind;
  label: string;
  distRoot: string;
  mainJsBudget: number;
};

export type DistAsset = {
  name: string;
  size: number;
  gzip: number;
};

const PROFILES = {
  angular: {
    label: 'Conduit (Angular)',
    distRoot: 'dist/angular-conduit/browser',
    mainJsBudget: 1_000_000,
  },
  react: {
    label: 'Conduit (React)',
    distRoot: 'dist',
    mainJsBudget: 500_000,
  },
} as const satisfies Record<AppKind, Omit<AppProfile, 'kind'>>;

export function detectApp(cwd = process.cwd()): AppProfile {
  const hasAngular = existsSync(join(cwd, 'angular.json'));
  const hasVite = existsSync(join(cwd, 'vite.config.ts'));
  if (hasAngular && !hasVite) {
    return { kind: 'angular', ...PROFILES.angular };
  }
  if (hasVite && !hasAngular) {
    return { kind: 'react', ...PROFILES.react };
  }
  throw new Error(`Cannot detect the SPA in ${cwd}. Expected exactly one of angular.json or vite.config.ts.`);
}

function walkFiles(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) {
    return acc;
  }
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(path, acc);
    } else {
      acc.push(path);
    }
  }
  return acc;
}

export function listDistAssets(cwd: string, distRoot: string, ext: '.js' | '.css'): DistAsset[] {
  const root = join(cwd, distRoot);
  return walkFiles(root)
    .filter(path => path.endsWith(ext) && !path.endsWith('.map'))
    .map(path => {
      const buf = readFileSync(path);
      return {
        name: relative(root, path).replaceAll('\\', '/'),
        size: buf.length,
        gzip: gzipSync(buf).length,
      };
    })
    .sort((a, b) => b.size - a.size);
}

export function bundleMetrics(cwd = process.cwd(), distRoot?: string) {
  const root = distRoot ?? detectApp(cwd).distRoot;
  const js = listDistAssets(cwd, root, '.js');
  const css = listDistAssets(cwd, root, '.css');
  const totalJs = js.reduce((sum, file) => sum + file.size, 0);
  const totalJsGzip = js.reduce((sum, file) => sum + file.gzip, 0);
  return {
    js,
    css,
    totalJs,
    totalJsGzip,
    mainJs: js[0] ?? null,
  };
}

export function distExists(cwd = process.cwd()): boolean {
  const profile = detectApp(cwd);
  return existsSync(join(cwd, profile.distRoot, 'index.html'));
}

export function previewUrl(port = Number(process.env.PREVIEW_PORT ?? 4200)): string {
  return `http://localhost:${port}`;
}
