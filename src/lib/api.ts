/**
 * Frontend API client for the Express backend.
 * Replaces all Supabase client usage with fetch-based calls.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// --- Token management ---

let accessToken: string | null = null;
let refreshToken: string | null = null;

const TOKEN_STORAGE_KEY = 'brixit_access_token';
const REFRESH_STORAGE_KEY = 'brixit_refresh_token';

export function loadTokensFromStorage() {
  accessToken = localStorage.getItem(TOKEN_STORAGE_KEY);
  refreshToken = localStorage.getItem(REFRESH_STORAGE_KEY);
}

export function setTokens(access: string, refresh: string) {
  accessToken = access;
  refreshToken = refresh;
  localStorage.setItem(TOKEN_STORAGE_KEY, access);
  localStorage.setItem(REFRESH_STORAGE_KEY, refresh);
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(REFRESH_STORAGE_KEY);
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function getRefreshToken(): string | null {
  return refreshToken;
}

// --- Core fetch helpers ---

async function tryRefreshToken(): Promise<boolean> {
  if (!refreshToken) return false;

  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) {
      clearTokens();
      return false;
    }

    const data = await res.json();
    accessToken = data.access_token;
    localStorage.setItem(TOKEN_STORAGE_KEY, data.access_token);
    return true;
  } catch {
    clearTokens();
    return false;
  }
}

interface FetchOptions extends RequestInit {
  skipAuth?: boolean;
}

/**
 * Authenticated fetch wrapper. Automatically attaches JWT and retries on 401.
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

  let res = await fetch(url, { ...fetchOptions, headers });

  // Auto-refresh on 401
  if (res.status === 401 && !skipAuth && refreshToken) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${accessToken}`;
      res = await fetch(url, { ...fetchOptions, headers });
    }
  }

  return res;
}

/**
 * GET helper that returns parsed JSON.
 */
export async function apiGet<T = any>(path: string, options: FetchOptions = {}): Promise<T> {
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
export async function apiPost<T = any>(path: string, body?: any, options: FetchOptions = {}): Promise<T> {
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
export async function apiPut<T = any>(path: string, body?: any, options: FetchOptions = {}): Promise<T> {
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
export async function apiDelete<T = any>(path: string, options: FetchOptions = {}): Promise<T> {
  const res = await apiFetch(path, { method: 'DELETE', ...options });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `API error ${res.status}`);
  }
  return res.json();
}
