import type { AuthProof } from '@bsv/auth';
import { authActionForRequest, withProof, PROOF_ERROR_CODE } from './authProofRoutes';

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

// --- Authorization proof signer ---

export type AuthProofSigner = (action: string) => Promise<AuthProof>;

/**
 * Mints a signed proof for a write. Registered by WalletContext, which owns the
 * wallet; api.ts is a plain module with no access to React context.
 */
let authProofSigner: AuthProofSigner | null = null;

export function setAuthProofSigner(signer: AuthProofSigner | null) {
  authProofSigner = signer;
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
 * Authenticated fetch wrapper. Attaches the JWT Bearer token, and for the
 * writes listed in authProofRoutes attaches a freshly signed authorization
 * proof. Retries once on 401 by refreshing the token; a rejected proof is not
 * retried that way, because its nonce is spent on the first attempt.
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

  // PUT and DELETE are tunnelled through POST, so the override header decides
  // which action a path maps to.
  const effectiveMethod = headers['X-Brixit-Method'] || fetchOptions.method || 'GET';
  const action = skipAuth ? null : authActionForRequest(path, effectiveMethod);

  // Re-run per attempt: a retry needs a fresh nonce, not the spent one.
  const send = async (): Promise<Response> => {
    let body = fetchOptions.body;
    if (action) {
      if (!authProofSigner) {
        throw new Error('This action cannot be authorized right now. Reload the page and try again.');
      }
      let proof;
      try {
        proof = await authProofSigner(action);
      } catch {
        throw new Error('Your wallet is not connected. Reconnect it and try again.');
      }
      body = withProof(body, proof);
    }
    return fetch(url, { ...fetchOptions, body, headers, credentials: 'include' });
  };

  let res = await send();

  if (res.status === 401 && !skipAuth) {
    const proofRejected = action
      && (await res.clone().json().catch(() => null))?.code === PROOF_ERROR_CODE;

    if (!proofRejected && await refreshAccessToken()) {
      headers['Authorization'] = `Bearer ${accessToken}`;
      res = await send();
    }
  }

  return res;
}

/**
 * Builds the error thrown for a non-ok response. A rejected auth proof is
 * reported with a plain-language message rather than the server's protocol
 * vocabulary (e.g. "Proof already used"), which is not fit for user-facing UI.
 */
async function apiError(res: Response): Promise<Error> {
  const err = await res.json().catch(() => ({ error: res.statusText }));
  if (err.code === PROOF_ERROR_CODE) {
    return new Error('Could not verify this action. Please try again.');
  }
  return new Error(err.error || `API error ${res.status}`);
}

/**
 * GET helper that returns parsed JSON.
 */
export async function apiGet<T = unknown>(path: string, options: FetchOptions = {}): Promise<T> {
  const res = await apiFetch(path, { method: 'GET', ...options });
  if (!res.ok) {
    throw await apiError(res);
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
    throw await apiError(res);
  }
  return res.json();
}

/**
 * PUT helper.
 */
export async function apiPut<T = unknown>(path: string, body?: unknown, options: FetchOptions = {}): Promise<T> {
  // Tunnel PUT through POST + override header: some proxies in front of the API
  // reject PUT/DELETE outright. The backend rewrites the method before routing.
  const { headers: optHeaders, ...rest } = options;
  const res = await apiFetch(path, {
    ...rest,
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
    headers: { ...(optHeaders as Record<string, string> | undefined), 'X-Brixit-Method': 'PUT' },
  });
  if (!res.ok) {
    throw await apiError(res);
  }
  return res.json();
}

/**
 * DELETE helper.
 */
export async function apiDelete<T = unknown>(path: string, options: FetchOptions = {}): Promise<T> {
  // Tunnel DELETE through POST + override header (see apiPut).
  const { headers: optHeaders, ...rest } = options;
  const res = await apiFetch(path, {
    ...rest,
    method: 'POST',
    headers: { ...(optHeaders as Record<string, string> | undefined), 'X-Brixit-Method': 'DELETE' },
  });
  if (!res.ok) {
    throw await apiError(res);
  }
  return res.json();
}
