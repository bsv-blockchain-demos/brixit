/**
 * In-memory stores for email OTP verification and cert issuance pre-authorization.
 *
 * Both are keyed by email/identityKey and expire automatically.
 * These are intentionally in-memory — OTPs are ephemeral by design.
 * If you need multi-instance support, replace with Redis.
 */

const OTP_TTL_MS = 10 * 60 * 1000;   // 10 minutes
const AUTH_TTL_MS = 10 * 60 * 1000;  // 10 minutes (same window)

interface OtpEntry {
  otp: string;
  expiresAt: number;
  attempts: number;
}

interface PreAuthEntry {
  email: string;
  expiresAt: number;
}

// email → OTP entry
const otpStore = new Map<string, OtpEntry>();

// identityKey → pre-authorized email (set after OTP verified)
const preAuthStore = new Map<string, PreAuthEntry>();

// --- OTP store ---

export function storeOtp(email: string, otp: string): void {
  otpStore.set(email.toLowerCase(), {
    otp,
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
  });
}

export function verifyOtp(email: string, otp: string): 'valid' | 'invalid' | 'expired' | 'too_many_attempts' {
  const entry = otpStore.get(email.toLowerCase());
  if (!entry) return 'invalid';
  if (Date.now() > entry.expiresAt) {
    otpStore.delete(email.toLowerCase());
    return 'expired';
  }
  if (entry.attempts >= 5) return 'too_many_attempts';

  entry.attempts++;
  if (entry.otp !== otp) return 'invalid';

  otpStore.delete(email.toLowerCase());
  return 'valid';
}

// --- Pre-auth store (identityKey → verified email) ---

export function storePreAuth(identityKey: string, email: string): void {
  preAuthStore.set(identityKey, {
    email: email.toLowerCase(),
    expiresAt: Date.now() + AUTH_TTL_MS,
  });
}

export function consumePreAuth(identityKey: string, email: string): boolean {
  const entry = preAuthStore.get(identityKey);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    preAuthStore.delete(identityKey);
    return false;
  }
  if (entry.email !== email.toLowerCase()) return false;

  preAuthStore.delete(identityKey);
  return true;
}
