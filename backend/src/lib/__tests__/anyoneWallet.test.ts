/**
 * Covers the verification path that lives in the routes (autoVerifySubmission,
 * submissions PUT) — proves that anyoneWallet.verifySignature accepts a real
 * counterparty='anyone' signature and rejects a tampered one.
 */
import { describe, it, expect } from 'vitest';
import { PrivateKey, ProtoWallet, Utils, type WalletProtocol } from '@bsv/sdk';
import { anyoneWallet } from '../anyoneWallet.js';

const PROTOCOL: WalletProtocol = [2, 'brixit submission'];

async function makeSignedPayload(payloadJson: string) {
  const userPriv = PrivateKey.fromRandom();
  const userIdentityKey = userPriv.toPublicKey().toString();
  const userKeyID = Utils.toBase64(new Array(16).fill(0).map(() => Math.floor(Math.random() * 256)));
  const userWallet = new ProtoWallet(userPriv);
  const { signature } = await userWallet.createSignature({
    data: Utils.toArray(payloadJson, 'utf8'),
    protocolID: PROTOCOL,
    keyID: userKeyID,
    counterparty: 'anyone',
  });
  return { userIdentityKey, userKeyID, signature };
}

describe('anyoneWallet verification', () => {
  it('accepts a real signature made with counterparty=anyone', async () => {
    const payloadJson = JSON.stringify({ cropName: 'tomato', brixValue: 12.5 });
    const { userIdentityKey, userKeyID, signature } = await makeSignedPayload(payloadJson);

    await expect(
      anyoneWallet.verifySignature({
        data: Utils.toArray(payloadJson, 'utf8'),
        signature,
        protocolID: PROTOCOL,
        keyID: userKeyID,
        counterparty: userIdentityKey,
      }),
    ).resolves.toEqual({ valid: true });
  });

  it('rejects a signature over different bytes than were signed', async () => {
    const original = JSON.stringify({ cropName: 'tomato', brixValue: 12.5 });
    const tampered = JSON.stringify({ cropName: 'tomato', brixValue: 99.9 });
    const { userIdentityKey, userKeyID, signature } = await makeSignedPayload(original);

    await expect(
      anyoneWallet.verifySignature({
        data: Utils.toArray(tampered, 'utf8'),
        signature,
        protocolID: PROTOCOL,
        keyID: userKeyID,
        counterparty: userIdentityKey,
      }),
    ).rejects.toThrow();
  });

  it('rejects a signature when the claimed identity key does not match the signer', async () => {
    const payloadJson = JSON.stringify({ cropName: 'tomato', brixValue: 12.5 });
    const { userKeyID, signature } = await makeSignedPayload(payloadJson);
    const wrongIdentity = PrivateKey.fromRandom().toPublicKey().toString();

    await expect(
      anyoneWallet.verifySignature({
        data: Utils.toArray(payloadJson, 'utf8'),
        signature,
        protocolID: PROTOCOL,
        keyID: userKeyID,
        counterparty: wrongIdentity,
      }),
    ).rejects.toThrow();
  });

  it('rejects when the keyID does not match what was used to sign', async () => {
    const payloadJson = JSON.stringify({ cropName: 'tomato', brixValue: 12.5 });
    const { userIdentityKey, signature } = await makeSignedPayload(payloadJson);

    await expect(
      anyoneWallet.verifySignature({
        data: Utils.toArray(payloadJson, 'utf8'),
        signature,
        protocolID: PROTOCOL,
        keyID: 'wrong-key-id',
        counterparty: userIdentityKey,
      }),
    ).rejects.toThrow();
  });
});
