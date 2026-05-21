/**
 * Per-field character caps on submission inputs. Routes enforce these before
 * touching the DB so a malicious client can't fill the DB with megabyte blobs
 * or balloon the on-chain payload_json field.
 */
export const FIELD_LIMITS = {
  NOTES: 500,                  // matches frontend
  CROP_NAME: 100,
  CROP_VARIETY: 100,
  BRAND_NAME: 100,
  LOCATION_NAME: 300,
  STREET_ADDRESS: 300,
  CITY: 100,
  STATE: 100,
  COUNTRY: 100,
  POS_TYPE: 50,

  // On-chain signing fields. These cap the PushDrop output size so a single
  // submission can't push the tx into 100s of KB of fees.
  PAYLOAD_JSON: 4096,          // 4 KB hard cap on the canonical JSON
  USER_SIGNATURE: 200,         // DER ECDSA ~144 hex chars + slack
  USER_KEY_ID: 80,             // base64 of 32 random bytes = 44 chars + slack
  USER_IDENTITY_KEY: 100,      // 33-byte compressed pubkey = 66 hex chars + slack
} as const;

/**
 * Returns null if the value is within bounds (or absent). Returns an error
 * message if it's over. Lets routes write `if (err) return res.status(400)...`.
 */
export function exceedsLimit(value: string | null | undefined, max: number, fieldName: string): string | null {
  if (value == null) return null;
  return value.length > max ? `${fieldName} too long (max ${max} characters)` : null;
}
