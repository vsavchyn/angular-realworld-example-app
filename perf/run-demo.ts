const MOCK_URL = 'http://localhost:8081/api/tags';

async function mockIsUp(): Promise<boolean> {
  try {
    const response = await fetch(MOCK_URL);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForMock(timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await mockIsUp()) {
      return;
    }
    await Bun.sleep(100);
  }
  throw new Error('Mock API did not become ready on http://localhost:8081');
}

const alreadyRunning = await mockIsUp();
let mock: ReturnType<typeof Bun.spawn> | undefined;

if (!alreadyRunning) {
  mock = Bun.spawn(['bun', 'run', 'perf/mock-api/server.ts'], {
    stdout: 'inherit',
    stderr: 'inherit',
  });
  try {
    await waitForMock();
  } catch (error) {
    mock.kill();
    throw error;
  }
} else {
  console.log('Reusing mock API already running on :8081');
}

const k6 = Bun.spawn(['bun', 'run', 'perf/run-k6.ts', 'smoke'], {
  stdout: 'inherit',
  stderr: 'inherit',
});
const code = await k6.exited;

if (mock) {
  mock.kill();
}

process.exit(code);
