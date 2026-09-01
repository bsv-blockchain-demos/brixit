/**
 * SHA-256 over the fields a submitter can edit, in a fixed order.
 *
 * Captured when an admin rejects a reading and recomputed on resubmit, so a
 * reading must genuinely change before it returns to the pending queue.
 *
 * Hashing goes through @bsv/sdk's Hash/Utils, the same primitives the
 * transaction code uses, rather than node:crypto.
 */
import { Hash, Utils } from '@bsv/sdk';

export interface HashableSubmission {
  cropId: string | null;
  brandId: string | null;
  venueId: string | null;
  brixValue: unknown;
  cropVariety: string | null;
  assessmentDate: Date | string | null;
  purchaseDate: Date | string | null;
  outlierNotes: string | null;
}

// NUL cannot occur in a Postgres text value, so no field value can forge a
// field boundary the way a space, newline or pipe could.
const SEP = '\u0000';

function text(v: unknown): string {
  return v === null || v === undefined ? '' : String(v);
}

// Decimal columns arrive as Prisma Decimal or string; normalise so 14.00 === 14.
function num(v: unknown): string {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  // Preserve an unparseable value verbatim: folding it onto the empty string
  // would make it collide with an absent one.
  return Number.isFinite(n) ? n.toString() : String(v);
}

// Only the date part is user-editable, even though assessmentDate is a timestamp.
function day(v: Date | string | null | undefined): string {
  if (v === null || v === undefined || v === '') return '';
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toISOString().slice(0, 10);
}

export function submissionHash(s: HashableSubmission): string {
  const parts = [
    text(s.cropId),
    text(s.brandId),
    text(s.venueId),
    num(s.brixValue),
    text(s.cropVariety),
    day(s.assessmentDate),
    day(s.purchaseDate),
    text(s.outlierNotes),
  ];
  return Utils.toHex(Hash.sha256(Utils.toArray(parts.join(SEP), 'utf8')));
}
