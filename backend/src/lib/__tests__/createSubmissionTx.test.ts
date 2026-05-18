import { describe, it, expect, vi } from 'vitest';
import { PrivateKey, type WalletInterface } from '@bsv/sdk';
import {
  createSubmissionTx,
  BRIXIT_SUBMISSION_BASKET,
  type SubmissionEntry,
} from '../createSubmissionTx.js';

// ─── Mock wallet ─────────────────────────────────────────────────────────────
//
// PushDrop.lock calls wallet.getPublicKey + wallet.createSignature internally.
// We return a real pubkey (so the SDK can build a valid LockingScript) and a
// stub signature. createAction/signAction are pure vi.fn spies we control.

interface MockWallet {
  getPublicKey: ReturnType<typeof vi.fn>;
  createSignature: ReturnType<typeof vi.fn>;
  createAction: ReturnType<typeof vi.fn>;
  signAction: ReturnType<typeof vi.fn>;
}

function makeMockWallet(overrides: Partial<MockWallet> = {}): MockWallet {
  const pubKeyHex = PrivateKey.fromRandom().toPublicKey().toString();
  const stubSig = new Array(70).fill(0);
  const fakeTxid = 'a'.repeat(64);

  return {
    getPublicKey: vi.fn().mockResolvedValue({ publicKey: pubKeyHex }),
    createSignature: vi.fn().mockResolvedValue({ signature: stubSig }),
    createAction: vi.fn().mockResolvedValue({ txid: fakeTxid, tx: new Uint8Array() }),
    signAction: vi.fn().mockResolvedValue({ txid: 'b'.repeat(64), tx: new Uint8Array() }),
    ...overrides,
  };
}

function asWallet(m: MockWallet): WalletInterface {
  return m as unknown as WalletInterface;
}

function makeEntry(submissionUuid: string, identityKey?: string): SubmissionEntry {
  return {
    submissionUuid,
    userIdentityKey: identityKey ?? '02' + '11'.repeat(32),
    userKeyID: `keyid-${submissionUuid}`,
    payloadJson: JSON.stringify({ cropName: 'tomato', brixValue: 12.5 }),
    userSignature: 'aa'.repeat(70),
  };
}

// ─── NEW ─────────────────────────────────────────────────────────────────────

describe('createSubmissionTx — NEW', () => {
  it('builds one PushDrop output per entry in a single createAction call', async () => {
    const wallet = makeMockWallet();
    const entries = [makeEntry('uuid-1'), makeEntry('uuid-2'), makeEntry('uuid-3')];

    const result = await createSubmissionTx({
      op: 'NEW',
      wallet: asWallet(wallet),
      entries,
    });

    expect(wallet.createAction).toHaveBeenCalledTimes(1);
    const call = wallet.createAction.mock.calls[0][0];
    expect(call.outputs).toHaveLength(3);
    expect(result.results).toHaveLength(3);
    expect(result.results.map((r) => r.submissionUuid)).toEqual(['uuid-1', 'uuid-2', 'uuid-3']);
  });

  it('puts every PushDrop output in the brixit-submissions basket', async () => {
    const wallet = makeMockWallet();
    await createSubmissionTx({
      op: 'NEW',
      wallet: asWallet(wallet),
      entries: [makeEntry('a'), makeEntry('b')],
    });
    const outputs = wallet.createAction.mock.calls[0][0].outputs;
    for (const o of outputs) {
      expect(o.basket).toBe(BRIXIT_SUBMISSION_BASKET);
      expect(o.satoshis).toBe(1);
    }
  });

  it('attaches customInstructions with the spend params per output', async () => {
    const wallet = makeMockWallet();
    await createSubmissionTx({
      op: 'NEW',
      wallet: asWallet(wallet),
      entries: [makeEntry('uuid-x')],
    });
    const out = wallet.createAction.mock.calls[0][0].outputs[0];
    const ci = JSON.parse(out.customInstructions);
    expect(ci).toMatchObject({
      keyID: 'uuid-x',
      counterparty: 'anyone',
      submissionUuid: 'uuid-x',
      op: 'NEW',
      previousTxid: '',
    });
    expect(ci.protocolID).toEqual([2, 'brixit submission']);
  });

  it('tags each output with uuid_<id> and user_<identityKey>', async () => {
    const wallet = makeMockWallet();
    const entry = makeEntry('uuid-z');
    await createSubmissionTx({
      op: 'NEW',
      wallet: asWallet(wallet),
      entries: [entry],
    });
    const out = wallet.createAction.mock.calls[0][0].outputs[0];
    expect(out.tags).toEqual(['uuid_uuid-z', `user_${entry.userIdentityKey}`]);
  });

  it('labels the action brixit-submission and merges extraLabels', async () => {
    const wallet = makeMockWallet();
    await createSubmissionTx({
      op: 'NEW',
      wallet: asWallet(wallet),
      entries: [makeEntry('uuid-1')],
      extraLabels: ['migration-test'],
    });
    const call = wallet.createAction.mock.calls[0][0];
    expect(call.labels).toEqual(['brixit-submission', 'migration-test']);
  });

  it('sets options.randomizeOutputs=false and options.acceptDelayedBroadcast=false', async () => {
    const wallet = makeMockWallet();
    await createSubmissionTx({
      op: 'NEW',
      wallet: asWallet(wallet),
      entries: [makeEntry('uuid-1')],
    });
    const call = wallet.createAction.mock.calls[0][0];
    expect(call.options).toMatchObject({
      randomizeOutputs: false,
      acceptDelayedBroadcast: false,
    });
  });

  it('calls wallet.createSignature once per entry for the server anchor signature', async () => {
    const wallet = makeMockWallet();
    await createSubmissionTx({
      op: 'NEW',
      wallet: asWallet(wallet),
      entries: [makeEntry('u1'), makeEntry('u2'), makeEntry('u3')],
    });
    // PushDrop.lock also calls createSignature once per output (its own auto-signature).
    // So total = 2 × entries. Server-anchor signatures use the SERVER_ANCHOR_PROTOCOL.
    const anchorCalls = wallet.createSignature.mock.calls.filter(
      (c) => Array.isArray(c[0].protocolID) && c[0].protocolID[1] === 'brixit anchor',
    );
    expect(anchorCalls).toHaveLength(3);
    expect(anchorCalls.map((c) => c[0].keyID)).toEqual(['u1', 'u2', 'u3']);
    for (const c of anchorCalls) {
      expect(c[0].counterparty).toBe('anyone');
    }
  });

  it('returns per-entry outpoints in txid.vout form, sharing the same txid', async () => {
    const fakeTxid = 'c'.repeat(64);
    const wallet = makeMockWallet({
      createAction: vi.fn().mockResolvedValue({ txid: fakeTxid, tx: new Uint8Array() }),
    });
    const result = await createSubmissionTx({
      op: 'NEW',
      wallet: asWallet(wallet),
      entries: [makeEntry('u1'), makeEntry('u2')],
    });
    expect(result.txid).toBe(fakeTxid);
    expect(result.results[0].pushDropOutpoint).toBe(`${fakeTxid}.0`);
    expect(result.results[1].pushDropOutpoint).toBe(`${fakeTxid}.1`);
  });

  it('throws when entries is empty', async () => {
    const wallet = makeMockWallet();
    await expect(
      createSubmissionTx({ op: 'NEW', wallet: asWallet(wallet), entries: [] }),
    ).rejects.toThrow(/entries must not be empty/i);
  });

  it('throws when createAction does not return txid/tx', async () => {
    const wallet = makeMockWallet({
      createAction: vi.fn().mockResolvedValue({}),
    });
    await expect(
      createSubmissionTx({
        op: 'NEW',
        wallet: asWallet(wallet),
        entries: [makeEntry('u1')],
      }),
    ).rejects.toThrow();
  });

  it('exposes the 10 PushDrop fields hex-encoded in each result', async () => {
    const wallet = makeMockWallet();
    const result = await createSubmissionTx({
      op: 'NEW',
      wallet: asWallet(wallet),
      entries: [makeEntry('u1')],
    });
    expect(result.results[0].fields).toHaveLength(10);
    // Field [0] is 'brixit-submission' utf8-encoded → hex of those bytes
    const expectedField0 = Buffer.from('brixit-submission', 'utf8').toString('hex');
    expect(result.results[0].fields![0]).toBe(expectedField0);
  });

  it('returns the serverSignature hex for each entry', async () => {
    const wallet = makeMockWallet();
    const result = await createSubmissionTx({
      op: 'NEW',
      wallet: asWallet(wallet),
      entries: [makeEntry('u1')],
    });
    expect(result.results[0].serverSignature).toMatch(/^[0-9a-f]+$/);
    // Our stub returns 70 zero bytes → 140 hex chars
    expect(result.results[0].serverSignature).toBe('00'.repeat(70));
  });
});
