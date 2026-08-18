/// <reference types="vite/client" />

import type { AuthState } from './auth/types';
import type { User } from './models/user.model';

export interface ConduitDebug {
  getToken: () => string | null;
  getAuthState: () => AuthState;
  getCurrentUser: () => User | null;
}

declare global {
  interface Window {
    __conduit_debug__?: ConduitDebug;
  }
}

export {};
