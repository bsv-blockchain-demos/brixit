/**
 * Normalises an admin's rejection reason. Returns null when the value cannot
 * serve as a reason, which callers turn into a 400.
 */
export function validateRejectionMessage(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length === 0 ? null : trimmed;
}
