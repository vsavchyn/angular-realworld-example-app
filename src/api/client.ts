import { getToken } from '../auth/jwt';

export const API_BASE = import.meta.env.VITE_API_BASE ?? 'https://api.realworld.show/api';

export interface ApiError {
  errors: { [key: string]: string | string[] };
  status: number;
}

const NETWORK_ERROR: ApiError = {
  errors: { network: ['Unable to connect. Please check your internet connection.'] },
  status: 0,
};

let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: () => void): void {
  unauthorizedHandler = handler;
}

function isApiErrorShape(body: unknown): body is { errors: ApiError['errors'] } {
  return !!body && typeof body === 'object' && 'errors' in body;
}

export function isApiError(error: unknown): error is ApiError {
  return !!error && typeof error === 'object' && 'status' in error && 'errors' in error;
}

export function isClientError(error: unknown): boolean {
  return isApiError(error) && error.status >= 400 && error.status < 500;
}

export function isServerOrNetworkError(error: unknown): boolean {
  if (!isApiError(error)) {
    return true;
  }
  return error.status === 0 || error.status >= 500;
}

/**
 * Fetch middleware chain replacing Angular HTTP interceptors:
 * - api: prefix API_BASE
 * - token: Authorization: Token <jwt>
 * - error: 401 purge (except GET /user) + normalize { errors, status }
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers);

  if (init.body != null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Token ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...init, headers, credentials: 'omit' });
  } catch {
    throw { ...NETWORK_ERROR };
  }

  if (response.status === 401 && path !== '/user') {
    unauthorizedHandler?.();
  }

  const text = await response.text();
  let body: unknown = undefined;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      throw { ...NETWORK_ERROR, status: response.status || 0 };
    }
  }

  if (!response.ok) {
    const normalized = isApiErrorShape(body) ? body : NETWORK_ERROR;
    throw { ...normalized, status: response.status };
  }

  return body as T;
}
