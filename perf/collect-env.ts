import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';
import { detectApp } from './app-profile.ts';

export type EnvFile = {
  collectedAt: string;
  app: string;
  host: {
    os: string;
    cpu: string;
    cpus: number;
    memoryGiB: number;
  };
  tooling: Record<string, string>;
  targets: Record<string, string>;
};

async function bunVersion(): Promise<string> {
  const proc = Bun.spawn(['bun', '--version'], { stdout: 'pipe', stderr: 'ignore' });
  const text = await new Response(proc.stdout).text();
  await proc.exited;
  return text.trim() || 'unknown';
}

export async function collectEnv(cwd = process.cwd()): Promise<EnvFile> {
  const profile = detectApp(cwd);
  const cpus = os.cpus();
  return {
    collectedAt: new Date().toISOString(),
    app: profile.label,
    host: {
      os: `${os.platform()} ${os.release()}`,
      cpu: cpus[0]?.model ?? 'unknown',
      cpus: cpus.length,
      memoryGiB: Math.round((os.totalmem() / 1024 ** 3) * 10) / 10,
    },
    tooling: {
      bun: await bunVersion(),
      playwright: 'chromium (bundled)',
      node: process.version,
    },
    targets: {
      frontend: `${previewLabel()} production static preview :4200`,
      api: 'Playwright fixture fulfill + Bun mock :8081',
    },
  };
}

function previewLabel(): string {
  try {
    return detectApp().kind;
  } catch {
    return 'spa';
  }
}

export async function writeEnv(cwd = process.cwd(), destDir = join(cwd, 'perf/reports/data')): Promise<EnvFile> {
  const env = await collectEnv(cwd);
  mkdirSync(destDir, { recursive: true });
  writeFileSync(join(destDir, 'env.json'), JSON.stringify(env, null, 2));
  return env;
}
