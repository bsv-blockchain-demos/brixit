/**
 * Resolve an outpoint to everything needed to spend it: BEEF, locking script,
 * satoshis, and the customInstructions we stored at creation time.
 *
 * Today this is backed by `wallet.listOutputs`. When we move to an overlay
 * service for indexing, swap the implementation here — call sites stay the same.
 */
import { Transaction, type WalletInterface } from '@bsv/sdk';
import { BRIXIT_SUBMISSION_BASKET } from './createSubmissionTx.js';

export interface OutpointData {
  outpoint: string;
  sourceBEEF: number[];
  sourceSatoshis: number;
  sourceLockingScriptHex: string;
  customInstructions?: string;
}

export async function getTransaction(
  wallet: WalletInterface,
  outpoint: string,
  submissionUuid: string,
  basket: string = BRIXIT_SUBMISSION_BASKET,
): Promise<OutpointData> {
  const [txid, voutStr] = outpoint.split('.');
  const vout = Number(voutStr);
  if (!txid || !Number.isFinite(vout) || vout < 0) {
    throw new Error(`Invalid outpoint format: "${outpoint}" (expected "txid.vout")`);
  }

  // Every PushDrop output is tagged uuid_<submissionUuid> at creation time, so
  // scoping the lookup to that tag keeps the result (and its BEEF) to this one
  // output regardless of how large the basket grows.
  const result = await wallet.listOutputs({
    basket,
    tags: [`uuid_${submissionUuid}`],
    tagQueryMode: 'all',
    include: 'entire transactions',
    includeCustomInstructions: true,
  });

  const match = result.outputs.find((o) => o.outpoint === outpoint);
  if (!match) {
    throw new Error(`Outpoint ${outpoint} not found in basket "${basket}"`);
  }
  if (!result.BEEF) {
    throw new Error(`listOutputs returned no BEEF for ${outpoint}`);
  }

  const beef = Array.isArray(result.BEEF) ? result.BEEF : Array.from(result.BEEF);
  const tx = Transaction.fromBEEF(beef, txid);
  const out = tx.outputs[vout];
  if (!out?.lockingScript) {
    throw new Error(`Output ${vout} missing from tx ${txid}`);
  }

  return {
    outpoint,
    sourceBEEF: beef,
    sourceSatoshis: match.satoshis,
    sourceLockingScriptHex: out.lockingScript.toHex(),
    customInstructions: match.customInstructions,
  };
}
