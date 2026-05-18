/**
 * Recursively key-sorted JSON so the same object always produces the same
 * bytes — required for signature reproducibility across client and server.
 *
 * Assumes JSON-safe values; callers normalize Date / BigInt / undefined first.
 */
export function canonicalJSON(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    out[key] = canonicalize((value as Record<string, unknown>)[key]);
  }
  return out;
}
