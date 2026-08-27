import { detectApp, distExists, previewUrl } from './app-profile.ts';

export async function previewIsUp(url = previewUrl()): Promise<boolean> {
  try {
    const response = await fetch(url);
    return response.status < 500;
  } catch {
    return false;
  }
}

export async function ensurePreview(): Promise<{ stop: () => void }> {
  const url = previewUrl();
  if (await previewIsUp(url)) {
    console.log(`Reusing preview already running at ${url}`);
    return { stop() {} };
  }

  if (!distExists()) {
    console.log(`Building ${detectApp().label}…`);
    const build = Bun.spawn(['bun', 'run', 'build'], {
      cwd: process.cwd(),
      stderr: 'inherit',
      stdout: 'inherit',
    });
    const code = await build.exited;
    if (code !== 0) {
      throw new Error('bun run build failed');
    }
  }

  const preview = Bun.spawn(['bun', 'run', 'perf/preview-server.ts'], {
    cwd: process.cwd(),
    stderr: 'inherit',
    stdout: 'inherit',
  });

  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (await previewIsUp(url)) {
      return {
        stop() {
          preview.kill();
        },
      };
    }
    await Bun.sleep(200);
  }

  preview.kill();
  throw new Error(`Preview server did not become ready at ${url}`);
}
