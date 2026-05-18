/**
 * Deterministic JSON serialization: object keys are sorted recursively so the
 * same logical value always produces the same bytes.
 *
 * Used to make submission payloads signable + verifiable across client and
 * server — without a canonical form, two parties stringifying the same object
 * can produce different bytes, which would invalidate signatures.
 *
 * Note: assumes all values are JSON-safe (no Date, BigInt, undefined values,
 * function values, etc.). Callers must normalize those before passing in.
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
