import { apiFetch } from './client';
import type { User } from '../models/user.model';

export function loginUser(credentials: { email: string; password: string }): Promise<{ user: User }> {
  return apiFetch<{ user: User }>('/users/login', {
    method: 'POST',
    body: JSON.stringify({ user: credentials }),
  });
}

export function registerUser(credentials: {
  username: string;
  email: string;
  password: string;
}): Promise<{ user: User }> {
  return apiFetch<{ user: User }>('/users', {
    method: 'POST',
    body: JSON.stringify({ user: credentials }),
  });
}

export function updateUser(user: Partial<User>): Promise<{ user: User }> {
  return apiFetch<{ user: User }>('/user', {
    method: 'PUT',
    body: JSON.stringify({ user }),
  });
}
