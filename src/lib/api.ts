/**
 * Frontend API client for the Express backend.
 *
 * Access token is kept in-memory only — never written to localStorage.
 * Refresh token is managed by the backend as an HttpOnly cookie and is
 * never accessible to JavaScript.
 */

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// --- Access token (in-memory only) ---

let accessToken: string | null = null;

export function setAccessToken(token: string) {
  accessToken = token;
}

export function clearAccessToken() {
  accessToken = null;
}

export function getAccessToken(): string | null {
  return accessToken;
}

// --- Token refresh ---

/**
 * Requests a new access token from the backend using the HttpOnly refresh
 * token cookie. The cookie is sent automatically by the browser.
 * Returns true if a new access token was obtained.
 */
export async function refreshAccessToken(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) return false;

    const data = await res.json();
    if (data.access_token) {
      accessToken = data.access_token;
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// --- Core fetch helpers ---

interface FetchOptions extends RequestInit {
  skipAuth?: boolean;
}

/**
 * Authenticated fetch wrapper. Automatically attaches the JWT Bearer token
 * and retries once on 401 by attempting a cookie-based token refresh.
 */
export async function apiFetch(path: string, options: FetchOptions = {}): Promise<Response> {
  const { skipAuth, ...fetchOptions } = options;
  const url = `${API_BASE}${path}`;

  const headers: Record<string, string> = {
    ...(fetchOptions.headers as Record<string, string> || {}),
  };

  // Don't set Content-Type for FormData (browser sets multipart boundary)
  if (!(fetchOptions.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }

  if (!skipAuth && accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  let res = await fetch(url, { ...fetchOptions, headers, credentials: 'include' });

  // Auto-refresh on 401
  if (res.status === 401 && !skipAuth) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${accessToken}`;
      res = await fetch(url, { ...fetchOptions, headers, credentials: 'include' });
    }
  }

  return res;
}

/**
 * GET helper that returns parsed JSON.
 */
export async function apiGet<T = unknown>(path: string, options: FetchOptions = {}): Promise<T> {
  const res = await apiFetch(path, { method: 'GET', ...options });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `API error ${res.status}`);
  }
  return res.json();
}

/**
 * POST helper that returns parsed JSON.
 */
export async function apiPost<T = unknown>(path: string, body?: unknown, options: FetchOptions = {}): Promise<T> {
  const fetchOptions: FetchOptions = { method: 'POST', ...options };
  if (body instanceof FormData) {
    fetchOptions.body = body;
  } else if (body !== undefined) {
    fetchOptions.body = JSON.stringify(body);
  }
  const res = await apiFetch(path, fetchOptions);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `API error ${res.status}`);
  }
  return res.json();
}

/**
 * PUT helper.
 */
export async function apiPut<T = unknown>(path: string, body?: unknown, options: FetchOptions = {}): Promise<T> {
  const res = await apiFetch(path, {
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `API error ${res.status}`);
  }
  return res.json();
}

/**
 * DELETE helper.
 */
export async function apiDelete<T = unknown>(path: string, options: FetchOptions = {}): Promise<T> {
  const res = await apiFetch(path, { method: 'DELETE', ...options });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `API error ${res.status}`);
  }
  return res.json();
}
