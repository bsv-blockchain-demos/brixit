/**
 * Email OTP routes for Mycelia account creation.
 *
 * POST /api/auth/send-otp    — generate & email a 6-digit OTP
 * POST /api/auth/verify-otp  — validate OTP, store pre-auth for cert signing
 */
import { Router } from 'express';
import { sendOtpEmail } from '../utils/email.js';
import { storeOtp, verifyOtp, storePreAuth } from '../utils/otpStore.js';

const router = Router();

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// POST /api/auth/send-otp
router.post('/send-otp', async (req, res) => {
  const { email } = req.body;

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    res.status(400).json({ success: false, error: 'Valid email is required' });
    return;
  }

  const otp = generateOtp();
  storeOtp(email, otp);

  try {
    await sendOtpEmail(email, otp);
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to send verification email' });
  }
});

// POST /api/auth/verify-otp
router.post('/verify-otp', (req, res) => {
  const { email, otp, identityKey } = req.body;

  if (!email || !otp || !identityKey) {
    res.status(400).json({ success: false, error: 'email, otp, and identityKey are required' });
    return;
  }

  const result = verifyOtp(email, otp);

  if (result === 'valid') {
    storePreAuth(identityKey, email);
    res.json({ success: true });
  } else if (result === 'expired') {
    res.status(400).json({ success: false, error: 'Code has expired. Please request a new one.' });
  } else if (result === 'too_many_attempts') {
    res.status(429).json({ success: false, error: 'Too many attempts. Please request a new code.' });
  } else {
    res.status(400).json({ success: false, error: 'Invalid verification code' });
  }
});

export default router;
