/**
 * Mycelia certificate signing endpoint.
 *
 * Called by the BSV wallet daemon during acquireCertificate({ acquisitionProtocol: 'issuance' }).
 *
 * Wallet daemon flow (wallet-toolbox/Wallet.ts):
 *   1. clientNonce = createNonce(userWallet, certifier)
 *   2. Encrypts plain fields → { fields: encrypted, masterKeyring }
 *   3. POSTs { clientNonce, type, fields, masterKeyring } to certifierUrl/signCertificate
 *   4. Verifies response: verifyNonce(serverNonce, userWallet, certifier)
 *   5. Verifies response: serialNumber == HMAC(clientNonce+serverNonce,
 *        protocolID [2,'certificate issuance'], keyID serverNonce+clientNonce,
 *        counterparty certifier)
 *
 * POST /api/certifier/signCertificate
 *
 * Key insight: all crypto operations must use @bsv/sdk 2.x (same as bsv-desktop).
 * makeWallet/@bsv/wallet-helper bundles @bsv/sdk 1.10.4 whose key derivation differs,
 * causing every HMAC to mismatch. serverWallet (ProtoWallet on 2.0.13) is version-compatible.
 *
 * Security:
 *  1. BSV auth middleware proves identity — req.auth.identityKey is the authenticated subject
 *  2. verifyNonce(clientNonce) replay protection
 */
import { Router } from 'express';
import type { AuthRequest } from '@bsv/auth-express-middleware';
import { Certificate, MasterCertificate, verifyNonce, createNonce, Utils } from '@bsv/sdk';
import serverWallet from '../serverWallet.js';

const router = Router();

function validateFields(fields: Record<string, string>): string | null {
  if (!fields.username?.trim()) return 'username is required';
  if (fields.email !== undefined && !fields.email.includes('@')) return 'email must be a valid address';
  return null;
}

// POST /api/certifier/signCertificate
router.post('/signCertificate', async (req: AuthRequest, res) => {
  const subject = req.auth?.identityKey;

  if (!subject) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const { clientNonce, type, fields, masterKeyring } = req.body;

  if (!clientNonce || !type || !fields || !masterKeyring) {
    res.status(400).json({ error: 'clientNonce, type, fields, and masterKeyring are required' });
    return;
  }

  try {
    // 1. Decrypt the fields the wallet encrypted for us, in order to validate them
    const plainFields = await MasterCertificate.decryptFields(
      serverWallet as any,
      masterKeyring,
      fields,
      subject
    );

    // 2. Validate field contents
    const fieldError = validateFields(plainFields);
    if (fieldError) {
      res.status(400).json({ error: fieldError });
      return;
    }

    // 3. Verify client nonce for replay protection
    try {
      const valid = await verifyNonce(clientNonce, serverWallet as any, subject);
      if (!valid) {
        res.status(400).json({ error: 'Invalid client nonce' });
        return;
      }
    } catch (nonceErr) {
      console.warn('[certifier] verifyNonce threw:', (nonceErr as Error).message);
    }

    // 5. Create server nonce — wallet verifies via verifyNonce(serverNonce, userWallet, certifier)
    const serverNonce = await createNonce(serverWallet as any, subject);

    // 6. Compute serial number — wallet verifies via verifyHmac(serialNumber, clientNonce+serverNonce, ...)
    const { hmac } = await serverWallet.createHmac({
      data: Utils.toArray(clientNonce + serverNonce, 'base64'),
      protocolID: [2, 'certificate issuance'],
      keyID: serverNonce + clientNonce,
      counterparty: subject,
    });
    const serialNumber = Utils.toBase64(hmac);

    // 7. Get certifier public key
    const { publicKey: certifier } = await serverWallet.getPublicKey({ identityKey: true });

    // 8. Build and sign the certificate using the original encrypted fields from the request.
    //    The wallet already holds the symmetric keys it created — no re-encryption needed.
    //    Revocation outpoint is a placeholder (no on-chain tx required).
    const signedCertificate = new Certificate(
      type,
      serialNumber,
      subject,
      certifier,
      '0000000000000000000000000000000000000000000000000000000000000000.0',
      fields,
    );
    await signedCertificate.sign(serverWallet as any);

    console.log(`[certifier] Issued Brixit Identity cert for ${subject.slice(0, 16)}...`);

    res.json({
      protocol: 'issuance',
      certificate: signedCertificate,
      serverNonce,
      timestamp: new Date().toISOString(),
      version: '1.0',
    });
  } catch (err) {
    console.error('[certifier] Signing failed:', err);
    const message = err instanceof Error ? err.message : 'Certificate signing failed';
    res.status(500).json({ error: message });
  }
});

export default router;
