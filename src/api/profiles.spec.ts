import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { followUser, getProfile, unfollowUser } from './profiles';
import { API_BASE } from './client';
import type { Profile } from '../models/profile.model';

const mockProfile: Profile = {
  username: 'testuser',
  bio: 'Test bio',
  image: 'https://example.com/avatar.jpg',
  following: false,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('profiles api', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    window.localStorage.removeItem('jwtToken');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('unwraps a profile by username', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ profile: mockProfile }));
    const profile = await getProfile('testuser');
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE}/profiles/testuser`);
    expect(profile).toEqual(mockProfile);
    expect((profile as unknown as { profile?: unknown }).profile).toBeUndefined();
  });

  it('follows with POST and empty JSON body', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ profile: { ...mockProfile, following: true } }));
    const profile = await followUser('testuser');
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
    expect(fetchMock.mock.calls[0][1].body).toBe(JSON.stringify({}));
    expect(profile.following).toBe(true);
  });

  it('unfollows with DELETE', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ profile: mockProfile }));
    await unfollowUser('testuser');
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE}/profiles/testuser/follow`);
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
  });

  it('surfaces HTTP errors', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ errors: { profile: ['not found'] } }, 404));
    await expect(getProfile('missing')).rejects.toMatchObject({ status: 404 });
  });
});
