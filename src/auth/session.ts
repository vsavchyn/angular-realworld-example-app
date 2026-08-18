import type { QueryClient } from '@tanstack/react-query';
import { apiFetch, isClientError, isServerOrNetworkError } from '../api/client';
import { destroyToken, getToken, hasToken, saveToken } from './jwt';
import type { User } from '../models/user.model';
import type { AuthState } from './types';

export const userQueryKey = ['user'] as const;

let queryClientRef: QueryClient | null = null;

export function bindQueryClient(queryClient: QueryClient): void {
  queryClientRef = queryClient;
}

export function purgeAuth(): void {
  destroyToken();
  queryClientRef?.setQueryData(userQueryKey, null);
  queryClientRef?.removeQueries({ queryKey: userQueryKey });
}

export function setAuth(user: User): void {
  saveToken(user.token);
  queryClientRef?.setQueryData(userQueryKey, user);
}

export function setCurrentUser(user: User): void {
  queryClientRef?.setQueryData(userQueryKey, user);
}

export async function fetchCurrentUser(): Promise<User> {
  try {
    const data = await apiFetch<{ user: User }>('/user');
    if (!data?.user) {
      throw { errors: { user: ['invalid response'] }, status: 0 };
    }
    saveToken(data.user.token);
    return data.user;
  } catch (error) {
    if (isClientError(error)) {
      destroyToken();
    }
    throw error;
  }
}

export function userQueryOptions() {
  return {
    queryKey: userQueryKey,
    queryFn: fetchCurrentUser,
    enabled: hasToken(),
    retry: false as const,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchInterval: (query: { state: { error: unknown; fetchFailureCount: number } }) => {
      if (!hasToken()) {
        return false;
      }
      if (isServerOrNetworkError(query.state.error) && query.state.error) {
        const attempt = Math.max(query.state.fetchFailureCount, 1);
        return Math.min(2000 * 2 ** (attempt - 1), 16000);
      }
      return false;
    },
  };
}

export function deriveAuthState(queryClient: QueryClient): AuthState {
  if (!hasToken()) {
    return 'unauthenticated';
  }
  const state = queryClient.getQueryState(userQueryKey);
  if (!state || state.status === 'pending') {
    return 'loading';
  }
  if (state.status === 'success' && state.data) {
    return 'authenticated';
  }
  if (state.status === 'error') {
    if (isClientError(state.error)) {
      return 'unauthenticated';
    }
    return 'unavailable';
  }
  return 'loading';
}

export async function bootstrapAuth(queryClient: QueryClient): Promise<void> {
  if (!getToken()) {
    return;
  }
  try {
    await queryClient.fetchQuery(userQueryOptions());
  } catch {
    // 4xx already cleared the token; 5xx stays in cache as error → unavailable
  }
}
