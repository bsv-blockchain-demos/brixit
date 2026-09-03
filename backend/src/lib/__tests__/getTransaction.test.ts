import { describe, it, expect, vi } from 'vitest';
import { P2PKH, PrivateKey, Transaction, type WalletInterface } from '@bsv/sdk';
import { getTransaction } from '../getTransaction.js';
import { BRIXIT_SUBMISSION_BASKET } from '../createSubmissionTx.js';

interface MockWallet {
  listOutputs: ReturnType<typeof vi.fn>;
}

function asWallet(m: MockWallet): WalletInterface {
  return m as unknown as WalletInterface;
}

// Builds a one-output transaction and its BEEF, mirroring what
// wallet.listOutputs({ include: 'entire transactions' }) would hand back.
function buildOutpointFixture(satoshis = 1) {
  const priv = PrivateKey.fromRandom();
  const lockingScript = new P2PKH().lock(priv.toPublicKey().toAddress());

  const tx = new Transaction();
  tx.addOutput({ lockingScript, satoshis });

  const beef = tx.toBEEF();
  const txid = tx.id('hex') as string;
  const outpoint = `${txid}.0`;

  return { beef, txid, outpoint, lockingScriptHex: lockingScript.toHex() };
}

describe('getTransaction', () => {
  it('rejects a malformed outpoint before calling the wallet', async () => {
    const listOutputs = vi.fn();
    const wallet = asWallet({ listOutputs });

    await expect(getTransaction(wallet, 'not-an-outpoint', 'uuid-1')).rejects.toThrow(
      /Invalid outpoint format/,
    );
    await expect(getTransaction(wallet, `${'a'.repeat(64)}.abc`, 'uuid-1')).rejects.toThrow(
      /Invalid outpoint format/,
    );
    expect(listOutputs).not.toHaveBeenCalled();
  });

  it('scopes listOutputs to the uuid_<submissionUuid> tag with tagQueryMode "all"', async () => {
    const { beef, outpoint } = buildOutpointFixture();
    const listOutputs = vi.fn().mockResolvedValue({ outputs: [], BEEF: beef, totalOutputs: 0 });
    const wallet = asWallet({ listOutputs });

    // Absent from the (empty) results, so this only asserts on the call args —
    // the "not found" path is covered separately below.
    await expect(getTransaction(wallet, outpoint, 'sub-123')).rejects.toThrow(/not found in basket/);

    expect(listOutputs).toHaveBeenCalledTimes(1);
    const args = listOutputs.mock.calls[0][0];
    expect(args.tags).toEqual(['uuid_sub-123']);
    expect(args.tagQueryMode).toBe('all');
    expect(args.basket).toBe(BRIXIT_SUBMISSION_BASKET);
  });

  it('resolves a matching outpoint and returns BEEF, locking script, satoshis, and customInstructions', async () => {
    const { beef, outpoint, lockingScriptHex } = buildOutpointFixture(1);
    const listOutputs = vi.fn().mockResolvedValue({
      outputs: [
        {
          outpoint,
          satoshis: 1,
          spendable: true,
          customInstructions: JSON.stringify({ protocolID: [2, 'brixit submission'], keyID: 'sub-123' }),
        },
      ],
      BEEF: beef,
      totalOutputs: 1,
    });
    const wallet = asWallet({ listOutputs });

    const result = await getTransaction(wallet, outpoint, 'sub-123');

    expect(result.outpoint).toBe(outpoint);
    expect(result.sourceSatoshis).toBe(1);
    expect(result.sourceLockingScriptHex).toBe(lockingScriptHex);
    expect(result.customInstructions).toBe(
      JSON.stringify({ protocolID: [2, 'brixit submission'], keyID: 'sub-123' }),
    );
    expect(result.sourceBEEF).toEqual(Array.isArray(beef) ? beef : Array.from(beef));
  });

  it('throws "not found in basket" when the outpoint is absent from the (tag-filtered) results', async () => {
    const { beef, outpoint } = buildOutpointFixture();
    // A different outpoint present in the response — proves the outpoint
    // check still guards even though the tag already narrowed the query.
    const other = buildOutpointFixture();
    const listOutputs = vi.fn().mockResolvedValue({
      outputs: [{ outpoint: other.outpoint, satoshis: 1, spendable: true }],
      BEEF: beef,
      totalOutputs: 1,
    });
    const wallet = asWallet({ listOutputs });

    await expect(getTransaction(wallet, outpoint, 'sub-123')).rejects.toThrow(
      `Outpoint ${outpoint} not found in basket "${BRIXIT_SUBMISSION_BASKET}"`,
    );
  });

  it('accepts an explicit basket override and passes it through to listOutputs', async () => {
    const { beef, outpoint } = buildOutpointFixture();
    const listOutputs = vi.fn().mockResolvedValue({ outputs: [], BEEF: beef, totalOutputs: 0 });
    const wallet = asWallet({ listOutputs });

    await expect(getTransaction(wallet, outpoint, 'sub-123', 'brixit-deleted')).rejects.toThrow(
      /not found in basket "brixit-deleted"/,
    );
    expect(listOutputs.mock.calls[0][0].basket).toBe('brixit-deleted');
  });
});
