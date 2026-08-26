import { existsSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { detectApp } from './app-profile.ts';

const PORT = Number(process.env.PREVIEW_PORT ?? 4200);
const profile = detectApp();
const distRoot = resolve(process.cwd(), profile.distRoot);
const indexHtml = join(distRoot, 'index.html');

if (!existsSync(indexHtml)) {
  console.error(`No production build at ${profile.distRoot}. Run bun run build first.`);
  process.exit(1);
}

const MIME: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.map': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function resolveSafe(urlPath: string): string | null {
  const decoded = decodeURIComponent((urlPath.split('?')[0] || '/').replace(/\/+$/, '') || '/');
  const rel = decoded === '/' ? 'index.html' : decoded.replace(/^\//, '');
  const abs = resolve(distRoot, rel);
  const inside = relative(distRoot, abs);
  if (inside.startsWith('..') || inside.startsWith('/')) {
    return null;
  }
  return abs;
}

const server = Bun.serve({
  port: PORT,
  async fetch(request) {
    const url = new URL(request.url);
    const requested = resolveSafe(url.pathname);
    if (!requested) {
      return new Response('Forbidden', { status: 403 });
    }

    let filePath = requested;
    let file = Bun.file(filePath);
    if (!(await file.exists())) {
      const nestedIndex = join(requested, 'index.html');
      if (await Bun.file(nestedIndex).exists()) {
        filePath = nestedIndex;
        file = Bun.file(nestedIndex);
      } else {
        filePath = indexHtml;
        file = Bun.file(indexHtml);
      }
    }

    const mime = MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
    return new Response(file, {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': mime,
      },
    });
  },
});

console.log(`${profile.label} preview on http://localhost:${server.port} (${profile.distRoot})`);
