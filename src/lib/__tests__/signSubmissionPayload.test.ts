import { describe, it, expect, vi } from 'vitest';
import type { WalletClient } from '@bsv/sdk';
import { signSubmissionPayload } from '../signSubmissionPayload';
import { canonicalJSON } from '../canonicalJSON';

function makeStubWallet() {
  return {
    createSignature: vi.fn().mockResolvedValue({
      signature: new Array(70).fill(0xaa),  // 70 bytes of 0xaa → 140 hex chars
    }),
  };
}

const USER_PUBKEY = '02' + 'cd'.repeat(32);

describe('signSubmissionPayload', () => {
  it('serializes the payload with canonical JSON', async () => {
    const wallet = makeStubWallet();
    const payload = { z: 1, a: 2 };

    const result = await signSubmissionPayload(
      wallet as unknown as WalletClient,
      USER_PUBKEY,
      payload,
    );
    expect(result.payloadJson).toBe(canonicalJSON(payload));
  });

  it('returns the user identity key it was given', async () => {
    const wallet = makeStubWallet();
    const result = await signSubmissionPayload(
      wallet as unknown as WalletClient,
      USER_PUBKEY,
      { cropName: 'tomato', brixValue: 12.5 },
    );
    expect(result.userIdentityKey).toBe(USER_PUBKEY);
  });

  it('calls wallet.createSignature with the canonical JSON bytes', async () => {
    const wallet = makeStubWallet();
    const payload = { cropName: 'tomato', brixValue: 12.5 };
    await signSubmissionPayload(wallet as unknown as WalletClient, USER_PUBKEY, payload);

    expect(wallet.createSignature).toHaveBeenCalledTimes(1);
    const args = wallet.createSignature.mock.calls[0][0];

    const expectedBytes = Array.from(
      new TextEncoder().encode(canonicalJSON(payload)),
    );
    expect(args.data).toEqual(expectedBytes);
    expect(args.protocolID).toEqual([2, 'brixit submission']);
    expect(args.counterparty).toBe('anyone');
    expect(typeof args.keyID).toBe('string');
    expect(args.keyID.length).toBeGreaterThan(0);
  });

  it('generates a fresh random keyID on every call', async () => {
    const wallet = makeStubWallet();
    const seen = new Set<string>();
    for (let i = 0; i < 8; i++) {
      const r = await signSubmissionPayload(
        wallet as unknown as WalletClient,
        USER_PUBKEY,
        { i },
      );
      seen.add(r.userKeyID);
    }
    expect(seen.size).toBe(8);
  });

  it('returns the signature hex-encoded', async () => {
    const wallet = makeStubWallet();
    const result = await signSubmissionPayload(
      wallet as unknown as WalletClient,
      USER_PUBKEY,
      { foo: 'bar' },
    );
    expect(result.userSignature).toBe('aa'.repeat(70));
  });

  it('produces the same payloadJson regardless of input key order', async () => {
    const wallet = makeStubWallet();
    const r1 = await signSubmissionPayload(
      wallet as unknown as WalletClient,
      USER_PUBKEY,
      { z: 1, a: 2 },
    );
    const r2 = await signSubmissionPayload(
      wallet as unknown as WalletClient,
      USER_PUBKEY,
      { a: 2, z: 1 },
    );
    expect(r1.payloadJson).toBe(r2.payloadJson);
  });

  it('surfaces wallet.createSignature errors', async () => {
    const wallet = {
      createSignature: vi.fn().mockRejectedValue(new Error('user rejected')),
    };
    await expect(
      signSubmissionPayload(wallet as unknown as WalletClient, USER_PUBKEY, {}),
    ).rejects.toThrow('user rejected');
  });
});
