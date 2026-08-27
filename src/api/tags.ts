import { apiFetch } from './client';

export async function getTags(): Promise<string[]> {
  const data = await apiFetch<{ tags: string[] }>('/tags');
  return data.tags;
}
