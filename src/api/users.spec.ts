import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loginUser, registerUser, updateUser } from './users';
import { fetchCurrentUser } from '../auth/session';
import { getToken } from '../auth/jwt';
import { API_BASE } from './client';
import type { User } from '../models/user.model';

const mockUser: User = {
  email: 'test@example.com',
  token: 'test-jwt-token',
  username: 'testuser',
  bio: 'Test bio',
  image: 'https://example.com/avatar.jpg',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('users api + current user', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    window.localStorage.removeItem('jwtToken');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('logs in against /users/login and wraps credentials', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ user: mockUser }));
    const result = await loginUser({ email: 'test@example.com', password: 'password123' });
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE}/users/login`);
    expect(fetchMock.mock.calls[0][1].body).toBe(
      JSON.stringify({ user: { email: 'test@example.com', password: 'password123' } }),
    );
    expect(result.user).toEqual(mockUser);
  });

  it('registers against /users', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ user: mockUser }));
    await registerUser({ username: 'newuser', email: 'new@example.com', password: 'password123' });
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE}/users`);
  });

  it('updates the current user with PUT /user', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ user: { ...mockUser, bio: 'Updated bio' } }));
    const result = await updateUser({ bio: 'Updated bio' });
    expect(fetchMock.mock.calls[0][1].method).toBe('PUT');
    expect(result.user.bio).toBe('Updated bio');
  });

  it('saves the token on successful GET /user', async () => {
    window.localStorage['jwtToken'] = 'old';
    fetchMock.mockResolvedValue(jsonResponse({ user: mockUser }));
    await fetchCurrentUser();
    expect(getToken()).toBe(mockUser.token);
  });

  it('clears the token on 4XX GET /user', async () => {
    window.localStorage['jwtToken'] = 'bad-token';
    fetchMock.mockResolvedValue(jsonResponse({ errors: { message: ['Unauthorized'] } }, 401));
    await expect(fetchCurrentUser()).rejects.toMatchObject({ status: 401 });
    expect(window.localStorage.getItem('jwtToken')).toBeNull();
  });

  it('keeps the token on 5XX GET /user', async () => {
    window.localStorage['jwtToken'] = 'keep-me';
    fetchMock.mockResolvedValue(jsonResponse({ errors: { server: ['down'] } }, 500));
    await expect(fetchCurrentUser()).rejects.toMatchObject({ status: 500 });
    expect(window.localStorage.getItem('jwtToken')).toBe('keep-me');
  });
});
