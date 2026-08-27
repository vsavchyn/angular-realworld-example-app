import type { QueryClient } from '@tanstack/react-query';
import { getToken } from './jwt';
import { deriveAuthState, userQueryKey } from './session';
import type { User } from '../models/user.model';

export function setupDebugInterface(queryClient: QueryClient): void {
  window.__conduit_debug__ = {
    getToken: () => getToken() ?? null,
    getAuthState: () => deriveAuthState(queryClient),
    getCurrentUser: () => queryClient.getQueryData<User>(userQueryKey) ?? null,
  };
}
