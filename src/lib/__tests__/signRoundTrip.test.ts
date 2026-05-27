/**
 * Frontend → backend signature round-trip.
 *
 * The other two tests cover each side in isolation:
 *   - signSubmissionPayload.test.ts uses a stub wallet (verifies structure)
 *   - backend/anyoneWallet.test.ts uses an inline signer (verifies decoding)
 *
 * This test wires the real frontend helper to the real backend verifier so a
 * change to either side's protocolID, counterparty, or encoding gets caught
 * by the contract — not just by each side's unit tests passing in isolation.
 *
 * Uses a deterministic seeded PrivateKey (per the monster-battle pattern) so
 * the round-trip is reproducible across test runs.
 */
import { describe, it, expect } from 'vitest';
import { PrivateKey, ProtoWallet, Utils, type WalletClient } from '@bsv/sdk';
import { signSubmissionPayload } from '../signSubmissionPayload';
import { anyoneWallet } from '../../../backend/src/lib/anyoneWallet';

// Deterministic users keyed by an integer seed. `new PrivateKey(n)` returns
// the same key for the same n, so seed=1 is "user 1", seed=2 is "user 2", etc.
// Tests stay reproducible and any future multi-user case is one extra call.
function makeUserWallet(seed = 1) {
  const priv = new PrivateKey(seed);
  const identityKey = priv.toPublicKey().toString();
  // ProtoWallet exposes the createSignature shape the frontend helper needs.
  const wallet = new ProtoWallet(priv) as unknown as WalletClient;
  return { wallet, identityKey };
}

describe('signSubmissionPayload → anyoneWallet round-trip', () => {
  it('a freshly signed payload verifies on the backend', async () => {
    const { wallet, identityKey } = makeUserWallet();
    const payload = { cropName: 'tomato', brixValue: 12.5, notes: 'sweet' };

    const sig = await signSubmissionPayload(wallet, identityKey, payload);

    await expect(
      anyoneWallet.verifySignature({
        data: Utils.toArray(sig.payloadJson, 'utf8'),
        signature: Utils.toArray(sig.userSignature, 'hex'),
        protocolID: [2, 'brixit submission'],
        keyID: sig.userKeyID,
        counterparty: sig.userIdentityKey,
      }),
    ).resolves.toEqual({ valid: true });
  });

  it('verification fails when the payload is mutated after signing', async () => {
    const { wallet, identityKey } = makeUserWallet();
    const original = { cropName: 'tomato', brixValue: 12.5 };
    const sig = await signSubmissionPayload(wallet, identityKey, original);

    // Replace the canonical bytes with a tampered version — what an attacker
    // would do to inflate a brix reading after the fact.
    const tampered = JSON.stringify({ brixValue: 99.9, cropName: 'tomato' });

    await expect(
      anyoneWallet.verifySignature({
        data: Utils.toArray(tampered, 'utf8'),
        signature: Utils.toArray(sig.userSignature, 'hex'),
        protocolID: [2, 'brixit submission'],
        keyID: sig.userKeyID,
        counterparty: sig.userIdentityKey,
      }),
    ).rejects.toThrow();
  });

  it('verification fails when the claimed identity key is wrong', async () => {
    const { wallet, identityKey } = makeUserWallet();
    const sig = await signSubmissionPayload(wallet, identityKey, { x: 1 });

    const impostorIdentity = PrivateKey.fromRandom().toPublicKey().toString();

    await expect(
      anyoneWallet.verifySignature({
        data: Utils.toArray(sig.payloadJson, 'utf8'),
        signature: Utils.toArray(sig.userSignature, 'hex'),
        protocolID: [2, 'brixit submission'],
        keyID: sig.userKeyID,
        counterparty: impostorIdentity,
      }),
    ).rejects.toThrow();
  });

  it('two signatures over the same payload produce different signatures (fresh keyID per call)', async () => {
    const { wallet, identityKey } = makeUserWallet();
    const payload = { cropName: 'apple', brixValue: 14.0 };

    const a = await signSubmissionPayload(wallet, identityKey, payload);
    const b = await signSubmissionPayload(wallet, identityKey, payload);

    expect(a.userKeyID).not.toBe(b.userKeyID);
    expect(a.userSignature).not.toBe(b.userSignature);

    // Both still verify against their own keyIDs.
    await expect(
      anyoneWallet.verifySignature({
        data: Utils.toArray(a.payloadJson, 'utf8'),
        signature: Utils.toArray(a.userSignature, 'hex'),
        protocolID: [2, 'brixit submission'],
        keyID: a.userKeyID,
        counterparty: a.userIdentityKey,
      }),
    ).resolves.toEqual({ valid: true });
  });

  it('key reordering on the input produces the same canonical bytes and a valid signature', async () => {
    const { wallet, identityKey } = makeUserWallet();
    // Different JS object key order — canonicalJSON normalizes this so the
    // signature should still verify against the canonicalized form.
    const a = await signSubmissionPayload(wallet, identityKey, { z: 1, a: 2 });
    const b = await signSubmissionPayload(wallet, identityKey, { a: 2, z: 1 });

    expect(a.payloadJson).toBe(b.payloadJson);

    await expect(
      anyoneWallet.verifySignature({
        data: Utils.toArray(b.payloadJson, 'utf8'),
        signature: Utils.toArray(b.userSignature, 'hex'),
        protocolID: [2, 'brixit submission'],
        keyID: b.userKeyID,
        counterparty: b.userIdentityKey,
      }),
    ).resolves.toEqual({ valid: true });
  });
});
