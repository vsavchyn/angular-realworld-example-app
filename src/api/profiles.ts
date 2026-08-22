import { apiFetch } from './client';
import type { Profile } from '../models/profile.model';

export async function getProfile(username: string): Promise<Profile> {
  const data = await apiFetch<{ profile: Profile }>('/profiles/' + encodeURIComponent(username));
  return data.profile;
}

export async function followUser(username: string): Promise<Profile> {
  const data = await apiFetch<{ profile: Profile }>('/profiles/' + encodeURIComponent(username) + '/follow', {
    method: 'POST',
    body: JSON.stringify({}),
  });
  return data.profile;
}

export async function unfollowUser(username: string): Promise<Profile> {
  const data = await apiFetch<{ profile: Profile }>('/profiles/' + encodeURIComponent(username) + '/follow', {
    method: 'DELETE',
  });
  return data.profile;
}
