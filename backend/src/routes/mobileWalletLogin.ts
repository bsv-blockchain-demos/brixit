/**
 * Mobile wallet login route.
 *
 * Endpoint:
 *   POST /api/auth/mobile-wallet-login
 *
 * Flow:
 *   1. Validate input (identityKey, certificateSerialNumber, certificate)
 *   2. Verify certificate issuer matches COMMONSOURCE_SERVER_KEY
 *   3. Verify certificate subject matches identityKey
 *   4. Verify certificate signature using @bsv/sdk
 *   5. Create or update user record (no userData — mobile users can fill profile later)
 *   6. Return JWT tokens
 *
 * Why no nonce?
 *   The standard login uses createNonce/verifyNonce to prove the wallet is currently
 *   available. In the mobile QR flow, the relay's ECDH pairing handshake already
 *   provides this guarantee — the mobile encrypted pairing_approved using its identity
 *   key, which required the private key to be present. Certificate verification then
 *   proves CommonSource vouched for that identity key.
 */
import { Router } from 'express';
import { Certificate as BsvCertificate } from '@bsv/sdk';
import * as jose from 'jose';
import { config } from '../config.js';
import prisma from '../db/client.js';

const router = Router();

interface CertificateDTO {
  certifier: string;
  serialNumber: string;
  type: string;
  subject?: string;
  revocationOutpoint?: string;
  fields?: Record<string, string>;
  signature?: string;
  [key: string]: unknown;
}

interface MobileWalletAuthRequest {
  identityKey: string;
  certificateSerialNumber: string;
  certificate: CertificateDTO;
}

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

router.post('/', async (req, res) => {
  try {
    const body = req.body as MobileWalletAuthRequest;
    const { identityKey, certificateSerialNumber, certificate } = body;

    // 1. Validate input
    if (!identityKey || !certificateSerialNumber || !certificate) {
      res.status(400).json({ success: false, error: 'Missing required fields' });
      return;
    }

    // 2. Verify certificate issuer
    if (certificate.certifier !== config.commonsourceServerKey) {
      res.status(401).json({ success: false, error: 'Invalid certificate issuer' });
      return;
    }

    // 3. Verify certificate subject matches the claimed identity key
    if (certificate.subject !== identityKey) {
      res.status(401).json({ success: false, error: 'Certificate subject mismatch' });
      return;
    }

    // 4. Verify certificate signature
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

    // 5. Create or update user
    const identityKeyShort = identityKey.slice(0, 32);
    const authEmail = `wallet-${identityKeyShort}@brixit.example`;

    const existingIdentity = await prisma.walletIdentity.findUnique({
      where: { identityKey },
    });

    let userId: string;

    if (existingIdentity) {
      userId = existingIdentity.userId;
      await prisma.walletIdentity.update({
        where: { identityKey },
        data: {
          certificateSerial: certificateSerialNumber,
          lastVerifiedAt: new Date(),
        },
      });
    } else {
      const newUser = await prisma.user.create({
        data: {
          email: authEmail,
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

    // 6. Fetch roles and generate tokens
    const roles = await prisma.userRole.findMany({ where: { userId } });
    const roleNames = roles.map((r: { role: string }) => r.role);

    const { accessToken, refreshToken } = await generateTokens(userId, authEmail, '', roleNames);

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
        display_name: null,
        roles: roleNames,
      },
    });
  } catch (err) {
    console.error('[mobile-wallet-login] Error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error occurred';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
