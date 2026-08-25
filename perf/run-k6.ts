const profile = Bun.argv[2] ?? 'smoke';
const script = 'perf/k6/browse-feed.js';
const k6Args = ['run', '-e', `PROFILE=${profile}`, script];

async function commandExists(name: string): Promise<boolean> {
  const proc = Bun.spawn(['sh', '-c', `command -v ${name}`], {
    stdout: 'ignore',
    stderr: 'ignore',
  });
  return (await proc.exited) === 0;
}

async function run(command: string, args: string[]): Promise<number> {
  const proc = Bun.spawn([command, ...args], {
    stdout: 'inherit',
    stderr: 'inherit',
    stdin: 'inherit',
  });
  return proc.exited;
}

if (await commandExists('k6')) {
  process.exit(await run('k6', k6Args));
}

if (await commandExists('docker')) {
  console.log('k6 binary not found; falling back to docker run --network host grafana/k6');
  process.exit(
    await run('docker', [
      'run',
      '--rm',
      '--network',
      'host',
      '-e',
      `API_BASE=${process.env.API_BASE ?? 'http://localhost:8081/api'}`,
      '-v',
      `${process.cwd()}:/src`,
      '-w',
      '/src',
      'grafana/k6',
      ...k6Args,
    ]),
  );
}

console.error('k6 is not installed and docker is not available.');
console.error('Install k6: https://grafana.com/docs/k6/latest/set-up/install-k6/');
console.error('Or install Docker and re-run (the script falls back to grafana/k6).');
process.exit(1);
