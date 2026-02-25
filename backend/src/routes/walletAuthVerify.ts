/**
 * Wallet authentication verification route.
 * Migrated from: supabase/functions/wallet-auth-verify/index.ts
 *
 * Endpoint:
 *   POST /api/auth/wallet-login
 *
 * Flow:
 *   1. Validate input (identityKey, certificate, userData)
 *   2. Verify certificate issuer matches COMMONSOURCE_SERVER_KEY
 *   3. Verify certificate signature using @bsv/sdk
 *   4. Reverse-geocode lat/lng via GeoNames
 *   5. Check wallet_identities table for existing user
 *   6. If new: create user + wallet_identities row
 *   7. If existing: update last_verified_at
 *   8. Upsert user profile (display_name, location)
 *   9. Fetch user roles
 *  10. Generate JWT (replaces Supabase magic link hack)
 *
 * NOTE: Steps 5-9 contain DB calls that are stubbed with TODO comments.
 *       These will be implemented once the database layer is decided.
 */
import { Router } from 'express';
import { Certificate as BsvCertificate } from '@bsv/sdk';
import * as jose from 'jose';
import { config } from '../config.js';
import { reverseGeocode } from '../utils/geocode.js';
import prisma from '../db/client.js';

const router = Router();

// --- Type definitions (ported from edge function) ---

interface CertificateDTO {
  certifier: string;
  serialNumber: string;
  type: string;
  subject?: string;
  revocationOutpoint?: string;
  fields?: Record<string, string>;
  signature?: string;
  [key: string]: any;
}

interface UserData {
  displayName: string;
  description?: string;
  locationLat: number;
  locationLng: number;
  email?: string;
  phoneNumber?: string;
}

interface WalletAuthRequest {
  identityKey: string;
  certificateSerialNumber: string;
  certificate: CertificateDTO;
  userData: UserData;
}

// --- JWT helper ---

const jwtSecret = new TextEncoder().encode(config.jwtSecret);

async function generateTokens(userId: string, email: string, displayName: string, roles: string[]) {
  const accessToken = await new jose.SignJWT({
    sub: userId,
    email,
    display_name: displayName,
    roles,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(config.jwtAccessExpiry)
    .sign(jwtSecret);

  const refreshToken = await new jose.SignJWT({
    sub: userId,
    type: 'refresh',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(config.jwtRefreshExpiry)
    .sign(jwtSecret);

  return { accessToken, refreshToken };
}

// --- Route handler ---

router.post('/', async (req, res) => {
  try {
    const body = req.body as WalletAuthRequest;
    const { identityKey, certificateSerialNumber, certificate, userData } = body;

    // 1. Validate input
    if (!identityKey || !certificateSerialNumber || !certificate || !userData) {
      res.status(400).json({ success: false, error: 'Missing required fields' });
      return;
    }

    // 2. Verify certificate issuer
    if (certificate.certifier !== config.commonsourceServerKey) {
      res.status(401).json({ success: false, error: 'Invalid certificate issuer' });
      return;
    }

    if (certificate.subject !== identityKey) {
      res.status(401).json({ success: false, error: 'Certificate subject mismatch' });
      return;
    }

    // 3. Verify certificate signature using @bsv/sdk
    const cert = new BsvCertificate(
      certificate.type,
      certificate.serialNumber,
      certificate.subject as string,
      certificate.certifier,
      certificate.revocationOutpoint as string,
      certificate.fields as Record<string, string>,
      certificate.signature as string,
    );
    const valid = await cert.verify();

    if (!valid) {
      res.status(401).json({ success: false, error: 'Invalid certificate signature' });
      return;
    }

    // 4. Reverse-geocode lat/lng
    const location = await reverseGeocode(userData.locationLat, userData.locationLng);

    // 5. Check if wallet identity exists
    const existingIdentity = await prisma.walletIdentity.findUnique({
      where: { identityKey },
    });

    let userId: string;
    const identityKeyShort = typeof identityKey === 'string' ? identityKey.slice(0, 32) : 'unknown';
    const authEmail = userData.email || `wallet-${identityKeyShort}@brixit.example`;

    if (existingIdentity) {
      // 6a. Existing user — update verification timestamp
      userId = existingIdentity.userId;

      await prisma.walletIdentity.update({
        where: { identityKey },
        data: {
          certificateSerial: certificateSerialNumber,
          lastVerifiedAt: new Date(),
        },
      });
    } else {
      // 6b. New user — create user + wallet identity + default role
      const newUser = await prisma.user.create({
        data: {
          email: authEmail,
          displayName: userData.displayName,
          country: location.country,
          state: location.state,
          city: location.city,
          locationLat: userData.locationLat,
          locationLng: userData.locationLng,
          walletIdentity: {
            create: {
              identityKey,
              certificateSerial: certificateSerialNumber,
              lastVerifiedAt: new Date(),
            },
          },
          roles: {
            create: { role: 'contributor' },
          },
        },
      });
      userId = newUser.id;
    }

    // 7. Upsert user profile (update display_name, location on every login)
    await prisma.user.update({
      where: { id: userId },
      data: {
        displayName: userData.displayName,
        country: location.country,
        state: location.state,
        city: location.city,
        locationLat: userData.locationLat,
        locationLng: userData.locationLng,
      },
    });

    // 8. Fetch user roles
    const roles = await prisma.userRole.findMany({ where: { userId } });
    const roleNames = roles.map((r: { role: string }) => r.role);

    // 9. Generate JWT tokens (replaces Supabase magic link hack)
    const { accessToken, refreshToken } = await generateTokens(
      userId,
      authEmail,
      userData.displayName,
      roleNames,
    );

    // Set refresh token as HttpOnly cookie — never exposed to JS
    const secure = config.nodeEnv === 'production' ? '; Secure' : '';
    res.setHeader(
      'Set-Cookie',
      `refresh_token=${encodeURIComponent(refreshToken)}; HttpOnly; SameSite=Strict; Path=/api/auth; Max-Age=${7 * 24 * 60 * 60}${secure}`,
    );

    res.json({
      success: true,
      access_token: accessToken,
      expires_in: 3600,
      token_type: 'bearer',
      user: {
        id: userId,
        display_name: userData.displayName,
        roles: roleNames,
      },
    });
  } catch (err) {
    console.error('[wallet-auth-verify] Error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error occurred';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
