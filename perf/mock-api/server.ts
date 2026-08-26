import { browseFeedResponse } from '../fixtures/browse-feed.ts';

const PORT = Number(process.env.MOCK_PORT ?? 8081);
const LATENCY_MS = Number(process.env.MOCK_LATENCY_MS ?? 0);

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors,
      'Content-Type': 'application/json',
    },
  });
}

const server = Bun.serve({
  port: PORT,
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    if (LATENCY_MS > 0) {
      await Bun.sleep(LATENCY_MS);
    }

    const url = new URL(request.url);
    const result = browseFeedResponse(request.method, url.pathname, url.searchParams);
    return json(result.status, result.body);
  },
});

console.log(`RealWorld mock API listening on http://localhost:${server.port}/api`);
if (LATENCY_MS > 0) {
  console.log(`Simulated backend latency: ${LATENCY_MS}ms`);
}
