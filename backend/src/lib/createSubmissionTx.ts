/**
 * PushDrop anchor for submission readings. One PushDrop output per reading;
 * NEW batches all readings of a session into a single tx.
 *
 * Field schema:
 *   [0] protocol_marker  'brixit-submission'   (utf8)
 *   [1] version          '1'                   (utf8)
 *   [2] submission_uuid                        (utf8)
 *   [3] user_identity_key                      (hex)
 *   [4] user_keyID                             (utf8)
 *   [5] payload_json                           (utf8)
 *   [6] op               'NEW' | 'EDIT'        (utf8)
 *   [7] previous_txid    '' on NEW             (utf8)
 *   [8] user_signature   over payload_json                (hex)
 *   [9] server_signature over payload_json || user_signature (hex)
 */

import {
  PushDrop,
  Transaction,
  LockingScript,
  Utils,
  type AtomicBEEF,
  type WalletInterface,
  type WalletProtocol,
} from '@bsv/sdk';

const PROTOCOL_MARKER = 'brixit-submission';
const PROTOCOL_VERSION = '1';
const PUSHDROP_PROTOCOL: WalletProtocol = [2, 'brixit submission'];
const SERVER_ANCHOR_PROTOCOL: WalletProtocol = [2, 'brixit anchor'];
// UTXO control: only the server spends, so the lock key stays private to it.
const PUSHDROP_COUNTERPARTY = 'self';
// Data attestation inside field[9]: 'anyone' so anyone can verify the server signed off.
const SERVER_ANCHOR_COUNTERPARTY = 'anyone';
const PUSHDROP_SATOSHIS = 1;
export const BRIXIT_SUBMISSION_BASKET = 'brixit-submissions';

/** Holds 1-sat P2PKH payouts from DELETE ops, awaiting sweep. */
export const BRIXIT_DELETED_BASKET = 'brixit-deleted';

export type SubmissionOp = 'NEW' | 'EDIT' | 'DELETE';

export interface SubmissionEntry {
  submissionUuid: string;
  /** 33-byte compressed pubkey, hex. */
  userIdentityKey: string;
  userKeyID: string;
  /** Canonical JSON — exact bytes the user signed. */
  payloadJson: string;
  /** Hex-encoded. */
  userSignature: string;
}

interface PreviousPushDropOutpoint {
  /** 'txid.vout' */
  outpoint: string;
  sourceBEEF: number[];
  sourceSatoshis: number;
  sourceLockingScriptHex: string;
}

export type CreateSubmissionTxInput =
  | {
      op: 'NEW';
      wallet: WalletInterface;
      entries: SubmissionEntry[];
      extraLabels?: string[];
    }
  | {
      op: 'EDIT';
      wallet: WalletInterface;
      entry: SubmissionEntry;
      previousTxid: string;
      previous: PreviousPushDropOutpoint;
      extraLabels?: string[];
    }
  | {
      op: 'DELETE';
      wallet: WalletInterface;
      submissionUuid: string;
      previousTxid: string;
      previous: PreviousPushDropOutpoint;
      /** P2PKH locking script the spent sats return to, hex. */
      deletionPayoutLockingScriptHex: string;
      deletionPayoutSatoshis: number;
      /** JSON `{ protocolID, keyID }` — lets a sweep unlock without external state. */
      deletionPayoutCustomInstructions: string;
      extraLabels?: string[];
    };

export interface PerEntryResult {
  submissionUuid: string;
  /** 'txid.vout' for NEW/EDIT, undefined for DELETE. */
  pushDropOutpoint?: string;
  outputIndex?: number;
  serverSignature?: string;
  fields?: string[];
}

export interface CreateSubmissionTxResult {
  txid: string;
  rawTxBEEF: AtomicBEEF;
  results: PerEntryResult[];
}

function utf8Field(s: string): number[] {
  return Utils.toArray(s, 'utf8');
}

function hexField(hex: string): number[] {
  return Utils.toArray(hex, 'hex');
}

interface BuiltPushDropOutput {
  outputDescription: string;
  lockingScript: string;
  satoshis: number;
  basket: string;
  customInstructions: string;
  tags: string[];
  serverSignature: string;
  fieldsHex: string[];
}

async function buildPushDropOutput(args: {
  pushDrop: PushDrop;
  wallet: WalletInterface;
  entry: SubmissionEntry;
  op: 'NEW' | 'EDIT';
  previousTxid: string;
}): Promise<BuiltPushDropOutput> {
  const { pushDrop, wallet, entry, op, previousTxid } = args;

  const payloadBytes = utf8Field(entry.payloadJson);
  const userSignatureBytes = hexField(entry.userSignature);

  // User signature is verified upstream at the route level — callers must
  // ensure entries are pre-validated. This module trusts its inputs.

  // Sign payload + user_sig so neither half can be replayed independently.
  const serverSigInput = [...payloadBytes, ...userSignatureBytes];
  const { signature: serverSigBytes } = await wallet.createSignature({
    data: serverSigInput,
    protocolID: SERVER_ANCHOR_PROTOCOL,
    keyID: entry.submissionUuid,
    counterparty: SERVER_ANCHOR_COUNTERPARTY,
  });
  const serverSignatureHex = Utils.toHex(serverSigBytes as number[]);

  const fields: number[][] = [
    utf8Field(PROTOCOL_MARKER),
    utf8Field(PROTOCOL_VERSION),
    utf8Field(entry.submissionUuid),
    hexField(entry.userIdentityKey),
    utf8Field(entry.userKeyID),
    payloadBytes,
    utf8Field(op),
    utf8Field(previousTxid),
    userSignatureBytes,
    hexField(serverSignatureHex),
  ];

  // Copy because PushDrop.lock mutates; keyID stable across edits.
  const lock = await pushDrop.lock(
    [...fields],
    PUSHDROP_PROTOCOL,
    entry.submissionUuid,
    PUSHDROP_COUNTERPARTY,
  );

  const customInstructions = JSON.stringify({
    protocolID: PUSHDROP_PROTOCOL,
    keyID: entry.submissionUuid,
    op,
    previousTxid,
  });

  return {
    outputDescription: op === 'NEW' ? 'brixit submission anchor' : 'brixit submission edit',
    lockingScript: lock.toHex(),
    satoshis: PUSHDROP_SATOSHIS,
    basket: BRIXIT_SUBMISSION_BASKET,
    customInstructions,
    tags: [
      `uuid_${entry.submissionUuid}`,
      `user_${entry.userIdentityKey}`,
    ],
    serverSignature: serverSignatureHex,
    fieldsHex: fields.map((f) => Utils.toHex(f)),
  };
}

// createAction → sign → signAction, spending a single PushDrop UTXO.
async function spendPreviousPushDrop(args: {
  wallet: WalletInterface;
  pushDrop: PushDrop;
  keyID: string;
  previous: PreviousPushDropOutpoint;
  outputs: BuiltPushDropOutput[] | Array<{
    outputDescription: string;
    lockingScript: string;
    satoshis: number;
    basket?: string;
    customInstructions?: string;
    tags?: string[];
  }>;
  description: string;
  labels: string[];
}): Promise<{ txid: string; tx: AtomicBEEF }> {
  const { wallet, pushDrop, keyID, previous, outputs, description, labels } = args;

  const sourceLockingScript = LockingScript.fromHex(previous.sourceLockingScriptHex);
  const unlockTemplate = pushDrop.unlock(
    PUSHDROP_PROTOCOL,
    keyID,
    PUSHDROP_COUNTERPARTY,
    'all',
    false,
    previous.sourceSatoshis,
    sourceLockingScript,
  );
  const unlockingScriptLength = await unlockTemplate.estimateLength();

  const actionRes = await wallet.createAction({
    description,
    inputBEEF: previous.sourceBEEF,
    inputs: [
      {
        inputDescription: 'previous brixit submission output',
        outpoint: previous.outpoint,
        unlockingScriptLength,
      },
    ],
    outputs: outputs.map((o) =>
      'basket' in o
        ? {
            outputDescription: o.outputDescription,
            lockingScript: o.lockingScript,
            satoshis: o.satoshis,
            basket: o.basket,
            customInstructions: o.customInstructions,
            tags: o.tags,
          }
        : o,
    ),
    labels,
    options: { 
      randomizeOutputs: false,
      acceptDelayedBroadcast: false,
     },
  });

  if (!actionRes.signableTransaction) {
    throw new Error('createAction did not return a signableTransaction');
  }

  const { reference, tx: signableBEEF } = actionRes.signableTransaction;
  const txToSign = Transaction.fromBEEF(signableBEEF);
  const sourceTx = Transaction.fromBEEF(previous.sourceBEEF);
  txToSign.inputs[0].unlockingScriptTemplate = unlockTemplate;
  txToSign.inputs[0].sourceTransaction = sourceTx;
  await txToSign.sign();

  const unlockingScript = txToSign.inputs[0].unlockingScript;
  if (!unlockingScript) {
    throw new Error('Missing unlocking script after signing previous PushDrop input');
  }

  const finalized = await wallet.signAction({
    reference,
    spends: { '0': { unlockingScript: unlockingScript.toHex() } },
  });
  if (!finalized.tx || !finalized.txid) {
    throw new Error('signAction did not return a finalized transaction');
  }

  return { txid: finalized.txid, tx: finalized.tx };
}

export async function createSubmissionTx(
  input: CreateSubmissionTxInput,
): Promise<CreateSubmissionTxResult> {
  const pushDrop = new PushDrop(input.wallet);

  if (input.op === 'NEW') {
    if (input.entries.length === 0) {
      throw new Error('createSubmissionTx: entries must not be empty for NEW');
    }

    const built: BuiltPushDropOutput[] = [];
    for (const entry of input.entries) {
      built.push(await buildPushDropOutput({
        pushDrop,
        wallet: input.wallet,
        entry,
        op: 'NEW',
        previousTxid: '',
      }));
    }

    const action = await input.wallet.createAction({
      description: `BRIXit submission anchor (${input.entries.length} reading${input.entries.length === 1 ? '' : 's'})`,
      outputs: built.map((b) => ({
        outputDescription: b.outputDescription,
        lockingScript: b.lockingScript,
        satoshis: b.satoshis,
        basket: b.basket,
        customInstructions: b.customInstructions,
        tags: b.tags,
      })),
      labels: ['brixit-submission', ...(input.extraLabels ?? [])],
      options: { 
        randomizeOutputs: false,
        acceptDelayedBroadcast: false,
      },
    });

    if (!action.txid || !action.tx) {
      throw new Error('createAction did not finalize the NEW submission transaction');
    }

    return {
      txid: action.txid,
      rawTxBEEF: action.tx,
      results: built.map((b, i) => ({
        submissionUuid: input.entries[i].submissionUuid,
        pushDropOutpoint: `${action.txid}.${i}`,
        outputIndex: i,
        serverSignature: b.serverSignature,
        fields: b.fieldsHex,
      })),
    };
  }

  if (input.op === 'EDIT') {
    const built = await buildPushDropOutput({
      pushDrop,
      wallet: input.wallet,
      entry: input.entry,
      op: 'EDIT',
      previousTxid: input.previousTxid,
    });

    const { txid, tx } = await spendPreviousPushDrop({
      wallet: input.wallet,
      pushDrop,
      keyID: input.entry.submissionUuid,
      previous: input.previous,
      outputs: [built],
      description: `BRIXit submission edit (${input.entry.submissionUuid})`,
      labels: ['brixit-edit', ...(input.extraLabels ?? [])],
    });

    return {
      txid,
      rawTxBEEF: tx,
      results: [{
        submissionUuid: input.entry.submissionUuid,
        pushDropOutpoint: `${txid}.0`,
        outputIndex: 0,
        serverSignature: built.serverSignature,
        fields: built.fieldsHex,
      }],
    };
  }

  // DELETE: spend previous PushDrop → basketed P2PKH for later sweep.
  const { txid, tx } = await spendPreviousPushDrop({
    wallet: input.wallet,
    pushDrop,
    keyID: input.submissionUuid,
    previous: input.previous,
    outputs: [{
      outputDescription: 'brixit submission delete payout',
      lockingScript: input.deletionPayoutLockingScriptHex,
      satoshis: input.deletionPayoutSatoshis,
      basket: BRIXIT_DELETED_BASKET,
      customInstructions: input.deletionPayoutCustomInstructions,
      tags: [`uuid_${input.submissionUuid}`],
    }],
    description: `BRIXit submission delete (${input.submissionUuid})`,
    labels: ['brixit-delete', ...(input.extraLabels ?? [])],
  });

  return {
    txid,
    rawTxBEEF: tx,
    results: [{ submissionUuid: input.submissionUuid }],
  };
}
