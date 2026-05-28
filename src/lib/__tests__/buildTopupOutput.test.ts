/**
 * Tests for the BRC-29 wallet-payment output the local-wallet top-up flow
 * builds. Two layers:
 *   - Stub-wallet unit tests verify the helper's contract with createAction
 *     (right protocolID, composite keyID, P2PKH lock to the derived pubkey).
 *   - ProtoWallet round-trip tests prove BRC-29 symmetry — the same derived
 *     pubkey is produced by sender and receiver when each uses the other as
 *     counterparty, which is the property that makes the receiver able to
 *     internalize the payment.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  Hash,
  LockingScript,
  P2PKH,
  PrivateKey,
  ProtoWallet,
  PublicKey,
  Transaction,
  Utils,
  type WalletClient,
} from '@bsv/sdk';
import { BRC29_PROTOCOL, buildTopupOutput } from '../buildTopupOutput';

// PublicKey.fromString validates the point — random hex won't pass.
const TREASURY_PUBKEY = new PrivateKey(101).toPublicKey().toString();
const SENDER_DERIVED_PUBKEY = new PrivateKey(202).toPublicKey().toString();

function makeStubWallet() {
  return {
    getPublicKey: vi.fn().mockResolvedValue({ publicKey: SENDER_DERIVED_PUBKEY }),
  } as unknown as WalletClient;
}

describe('buildTopupOutput — unit', () => {
  it('calls wallet.getPublicKey with BRC29 protocolID, composite keyID, and treasury as counterparty', async () => {
    const wallet = makeStubWallet();
    await buildTopupOutput({
      wallet,
      payee: TREASURY_PUBKEY,
      network: 'mainnet',
      derivationPrefix: 'PFX',
      derivationSuffix: 'SFX',
    });

    expect(wallet.getPublicKey).toHaveBeenCalledTimes(1);
    const args = (wallet.getPublicKey as any).mock.calls[0][0];
    expect(args.counterparty).toBe(TREASURY_PUBKEY);
    expect(args.protocolID).toEqual(BRC29_PROTOCOL);
    expect(args.keyID).toBe('PFX SFX');
  });

  it('composes keyID as "<prefix> <suffix>" with a single space', async () => {
    const wallet = makeStubWallet();
    const result = await buildTopupOutput({
      wallet,
      payee: TREASURY_PUBKEY,
      network: 'mainnet',
      derivationPrefix: 'aGVsbG8=',
      derivationSuffix: 'd29ybGQ=',
    });
    expect(result.keyID).toBe('aGVsbG8= d29ybGQ=');
  });

  it('returns the derived public key from the wallet verbatim', async () => {
    const wallet = makeStubWallet();
    const result = await buildTopupOutput({
      wallet,
      payee: TREASURY_PUBKEY,
      network: 'mainnet',
      derivationPrefix: 'PFX',
      derivationSuffix: 'SFX',
    });
    expect(result.derivedPubKey).toBe(SENDER_DERIVED_PUBKEY);
  });

  it('produces customInstructions as parseable JSON with the three BRC-29 fields', async () => {
    const wallet = makeStubWallet();
    const result = await buildTopupOutput({
      wallet,
      payee: TREASURY_PUBKEY,
      network: 'mainnet',
      derivationPrefix: 'PFX',
      derivationSuffix: 'SFX',
    });
    const parsed = JSON.parse(result.customInstructions);
    expect(parsed).toEqual({
      derivationPrefix: 'PFX',
      derivationSuffix: 'SFX',
      payee: TREASURY_PUBKEY,
    });
  });

  it('locks to the P2PKH of the derived public key', async () => {
    const wallet = makeStubWallet();
    const result = await buildTopupOutput({
      wallet,
      payee: TREASURY_PUBKEY,
      network: 'mainnet',
      derivationPrefix: 'PFX',
      derivationSuffix: 'SFX',
    });

    // Reconstruct the expected script independently and compare.
    const expected = new P2PKH()
      .lock(PublicKey.fromString(SENDER_DERIVED_PUBKEY).toAddress('mainnet'))
      .toHex();
    expect(result.lockingScript).toBe(expected);
  });

  it('respects the network argument when encoding the P2PKH address', async () => {
    const wallet = makeStubWallet();
    const mainnet = await buildTopupOutput({
      wallet,
      payee: TREASURY_PUBKEY,
      network: 'mainnet',
      derivationPrefix: 'PFX',
      derivationSuffix: 'SFX',
    });
    const testnet = await buildTopupOutput({
      wallet,
      payee: TREASURY_PUBKEY,
      network: 'testnet',
      derivationPrefix: 'PFX',
      derivationSuffix: 'SFX',
    });
    // Network only affects base58 encoding, not the hash160 bytes in-script.
    expect(mainnet.lockingScript).toBe(testnet.lockingScript);
  });

  it('surfaces wallet.getPublicKey errors', async () => {
    const wallet = {
      getPublicKey: vi.fn().mockRejectedValue(new Error('user rejected')),
    } as unknown as WalletClient;
    await expect(
      buildTopupOutput({
        wallet,
        payee: TREASURY_PUBKEY,
        network: 'mainnet',
        derivationPrefix: 'PFX',
        derivationSuffix: 'SFX',
      }),
    ).rejects.toThrow('user rejected');
  });
});

describe('buildTopupOutput — BRC-29 round-trip with two ProtoWallets', () => {
  // Deterministic seeded users
  function makePair(senderSeed = 1, receiverSeed = 2) {
    const senderPriv = new PrivateKey(senderSeed);
    const receiverPriv = new PrivateKey(receiverSeed);
    return {
      senderWallet: new ProtoWallet(senderPriv) as unknown as WalletClient,
      receiverWallet: new ProtoWallet(receiverPriv) as unknown as WalletClient,
      senderIdentity: senderPriv.toPublicKey().toString(),
      receiverIdentity: receiverPriv.toPublicKey().toString(),
    };
  }

  it("sender's derived pubkey equals receiver's derived pubkey (BRC-29 symmetry)", async () => {
    const { senderWallet, receiverWallet, senderIdentity, receiverIdentity } = makePair();
    const derivationPrefix = 'PFX-test';
    const derivationSuffix = 'SFX-test';
    const keyID = `${derivationPrefix} ${derivationSuffix}`;

    // Sender derives toward the receiver
    const built = await buildTopupOutput({
      wallet: senderWallet,
      payee: receiverIdentity,
      network: 'mainnet',
      derivationPrefix,
      derivationSuffix,
    });

    // `forSelf: true` is what makes BRC-29 symmetric — without it the receiver
    // gets the sender's child key, not its own.
    const { publicKey: receiverDerived } = await receiverWallet.getPublicKey({
      counterparty: senderIdentity,
      protocolID: BRC29_PROTOCOL,
      keyID,
      forSelf: true,
    });

    expect(built.derivedPubKey).toBe(receiverDerived);
  });

  it('produces a locking script that decodes as a valid P2PKH with the right hash160', async () => {
    const { senderWallet, receiverIdentity } = makePair();
    const built = await buildTopupOutput({
      wallet: senderWallet,
      payee: receiverIdentity,
      network: 'mainnet',
      derivationPrefix: 'PFX',
      derivationSuffix: 'SFX',
    });

    const script = LockingScript.fromHex(built.lockingScript);
    const chunks = script.chunks;

    // P2PKH structure: OP_DUP OP_HASH160 <20-byte push> OP_EQUALVERIFY OP_CHECKSIG
    expect(chunks).toHaveLength(5);
    expect(chunks[0].op).toBe(0x76); // OP_DUP
    expect(chunks[1].op).toBe(0xa9); // OP_HASH160
    expect(chunks[2].data).toBeDefined();
    expect(chunks[2].data!.length).toBe(20);
    expect(chunks[3].op).toBe(0x88); // OP_EQUALVERIFY
    expect(chunks[4].op).toBe(0xac); // OP_CHECKSIG

    const expectedHash = Hash.hash160(Utils.toArray(built.derivedPubKey, 'hex'));
    expect(chunks[2].data).toEqual(expectedHash);
  });

  it('locking script survives Transaction serialization round-trip (Transaction.fromHex matches)', async () => {
    const { senderWallet, receiverIdentity } = makePair();
    const built = await buildTopupOutput({
      wallet: senderWallet,
      payee: receiverIdentity,
      network: 'mainnet',
      derivationPrefix: 'PFX',
      derivationSuffix: 'SFX',
    });

    // Wrap the output in a minimal Transaction
    const tx = new Transaction();
    tx.addOutput({
      lockingScript: LockingScript.fromHex(built.lockingScript),
      satoshis: 1000,
    });
    const txHex = tx.toHex();
    const parsed = Transaction.fromHex(txHex);

    expect(parsed.outputs).toHaveLength(1);
    expect(parsed.outputs[0].lockingScript.toHex()).toBe(built.lockingScript);
    expect(parsed.outputs[0].satoshis).toBe(1000);
  });

  it('different prefix/suffix values produce different derived pubkeys (no key reuse across remittances)', async () => {
    const { senderWallet, receiverIdentity } = makePair();

    const a = await buildTopupOutput({
      wallet: senderWallet,
      payee: receiverIdentity,
      network: 'mainnet',
      derivationPrefix: 'PFX-a',
      derivationSuffix: 'SFX-a',
    });
    const b = await buildTopupOutput({
      wallet: senderWallet,
      payee: receiverIdentity,
      network: 'mainnet',
      derivationPrefix: 'PFX-b',
      derivationSuffix: 'SFX-b',
    });

    expect(a.derivedPubKey).not.toBe(b.derivedPubKey);
    expect(a.lockingScript).not.toBe(b.lockingScript);
  });

  it('same prefix/suffix produces a deterministic derived pubkey across calls', async () => {
    const { senderWallet, receiverIdentity } = makePair();
    const args = {
      wallet: senderWallet,
      payee: receiverIdentity,
      network: 'mainnet' as const,
      derivationPrefix: 'PFX',
      derivationSuffix: 'SFX',
    };

    const a = await buildTopupOutput(args);
    const b = await buildTopupOutput(args);
    expect(a.derivedPubKey).toBe(b.derivedPubKey);
    expect(a.lockingScript).toBe(b.lockingScript);
  });
});
