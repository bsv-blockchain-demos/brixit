/**
 * Turns a thrown API error into something a person can act on.
 *
 * The API client throws `new Error(body.error ?? \`API error ${status}\`)`, and
 * fetch itself throws a bare `TypeError: Failed to fetch` when the request
 * never reaches a server. That last one is what admins were being shown, and
 * it says nothing about what to do next.
 */
export interface DescribedError {
  title: string;
  detail: string;
}

export function describeApiError(error: unknown): DescribedError {
  const raw = error instanceof Error ? error.message : String(error ?? '');

  // fetch's network failure. Wording differs per browser, hence the alternatives.
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(raw)) {
    return {
      title: "Can't reach the server",
      detail:
        'The request never got a response. Check your connection, and that the API is running and reachable at its configured address.',
    };
  }

  if (/\b(401|unauthor)/i.test(raw)) {
    return {
      title: 'Your session has expired',
      detail: 'Sign out and back in with your wallet, then try again.',
    };
  }

  if (/\b(403|forbidden)/i.test(raw)) {
    return {
      title: 'Not allowed',
      detail: 'This account does not have permission to view that. It needs the admin role.',
    };
  }

  if (/\b404\b|not found/i.test(raw)) {
    return {
      title: 'That endpoint is missing',
      detail: 'The server responded but has no route for this request, which usually means a version mismatch between the app and the API.',
    };
  }

  if (/\b5\d{2}\b|internal server/i.test(raw)) {
    return {
      title: 'The server hit an error',
      detail: `Nothing is wrong on your side. ${raw}`,
    };
  }

  // A message the backend chose deliberately is better than anything generic.
  return {
    title: 'Could not load this',
    detail: raw || 'No further detail was returned.',
  };
}
