import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTags } from './tags';
import { API_BASE } from './client';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('tags api', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    window.localStorage.removeItem('jwtToken');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('unwraps tags from the response wrapper', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ tags: ['react', 'vite'] }));
    const tags = await getTags();
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE}/tags`);
    expect(tags).toEqual(['react', 'vite']);
    expect((tags as unknown as { tags?: unknown }).tags).toBeUndefined();
  });

  it('handles an empty list', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ tags: [] }));
    await expect(getTags()).resolves.toEqual([]);
  });

  it('surfaces HTTP errors', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ errors: { tags: ['unavailable'] } }, 500));
    await expect(getTags()).rejects.toMatchObject({ status: 500 });
  });
});
