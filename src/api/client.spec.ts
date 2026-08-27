import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, setUnauthorizedHandler, API_BASE } from './client';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(body === undefined ? '' : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('apiFetch', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    window.localStorage.removeItem('jwtToken');
    setUnauthorizedHandler(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('prefixes the RealWorld API base URL', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ tags: ['react'] }));
    await apiFetch('/tags');
    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/tags`, expect.any(Object));
  });

  it('omits credentials on cross-origin requests', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ tags: [] }));
    await apiFetch('/tags');
    expect(fetchMock.mock.calls[0][1].credentials).toBe('omit');
  });

  it('attaches the JWT token when present', async () => {
    window.localStorage['jwtToken'] = 'abc';
    fetchMock.mockResolvedValue(jsonResponse({ user: {} }));
    await apiFetch('/user');
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get('Authorization')).toBe('Token abc');
  });

  it('purges auth on 401 except for /user', async () => {
    const unauthorized = vi.fn();
    setUnauthorizedHandler(unauthorized);
    fetchMock.mockResolvedValue(jsonResponse({ errors: { message: ['Unauthorized'] } }, 401));
    await expect(apiFetch('/articles')).rejects.toMatchObject({ status: 401 });
    expect(unauthorized).toHaveBeenCalled();
  });

  it('does not purge auth on 401 for /user', async () => {
    const unauthorized = vi.fn();
    setUnauthorizedHandler(unauthorized);
    fetchMock.mockResolvedValue(jsonResponse({ errors: { message: ['Unauthorized'] } }, 401));
    await expect(apiFetch('/user')).rejects.toMatchObject({ status: 401 });
    expect(unauthorized).not.toHaveBeenCalled();
  });

  it('normalizes validation errors', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ errors: { email: ['is invalid'] } }, 422));
    await expect(apiFetch('/users')).rejects.toEqual({
      errors: { email: ['is invalid'] },
      status: 422,
    });
  });

  it('normalizes network failures', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(apiFetch('/tags')).rejects.toMatchObject({
      status: 0,
      errors: { network: ['Unable to connect. Please check your internet connection.'] },
    });
  });

  it('treats malformed JSON as a network-style error', async () => {
    fetchMock.mockResolvedValue(
      new Response('{ not json', { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    await expect(apiFetch('/user')).rejects.toMatchObject({ status: 200 });
  });
});
