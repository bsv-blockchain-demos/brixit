/**
 * createSubmissionTx — builds, funds, and broadcasts the on-chain anchor
 * transaction(s) for a BRIXit submission session.
 *
 * Each *reading* gets its own PushDrop output (so EDIT/DELETE can target a
 * single reading), but NEW submissions batch all readings into one
 * transaction with N PushDrop outputs — one fee, one broadcast, granular
 * downstream operations.
 *
 *   NEW    → 1 tx, N PushDrop outputs (wallet funds, no inputs to spend)
 *   EDIT   → 1 tx, 1 input (the previous PushDrop UTXO), 1 PushDrop output
 *   DELETE → 1 tx, 1 input (the previous PushDrop UTXO), 1 P2PKH output back
 *            to the treasury (`brixit-delete` label is the deletion ledger)
 *
 * PushDrop field schema (10 fields, fixed, versioned):
 *   [0] protocol_marker      'brixit-submission'                  (utf8)
 *   [1] version              '1'                                  (utf8)
 *   [2] submission_uuid      DB primary key                       (utf8)
 *   [3] user_identity_key    33-byte pubkey                       (hex)
 *   [4] user_keyID           random per-reading                   (utf8)
 *   [5] payload_json         canonical JSON                       (utf8)
 *   [6] op                   'NEW' | 'EDIT'                       (utf8)
 *   [7] previous_txid        '' on NEW                            (utf8)
 *   [8] user_signature       user sig over payload, ctp 'anyone'  (hex)
 *   [9] server_signature     treasury sig over sha256(fields[0..8]) (hex)
 *
 * See transaction-flow.md for the createAction → sign → signAction pattern.
 *
 * Wallet requirement: a real BRC-100 wallet (createAction/signAction).
 * ProtoWallet alone is not sufficient.
 */

import {
  PushDrop,
  Transaction,
  LockingScript,
  Hash,
  Utils,
  type AtomicBEEF,
  type WalletInterface,
  type WalletProtocol,
} from '@bsv/sdk';

// ─── Constants ───────────────────────────────────────────────────────────────

const PROTOCOL_MARKER = 'brixit-submission';
const PROTOCOL_VERSION = '1';

/** PushDrop protocol ID for output lock + input unlock derivation. */
const PUSHDROP_PROTOCOL: WalletProtocol = [2, 'brixit submission'];

/** Protocol ID for the server's anchor signature (separate so verifiers know which key was used). */
const SERVER_ANCHOR_PROTOCOL: WalletProtocol = [2, 'brixit anchor'];

/** counterparty: 'anyone' makes the derived public key publicly recomputable. */
const PUSHDROP_COUNTERPARTY = 'anyone';
const SERVER_ANCHOR_COUNTERPARTY = 'anyone';

/** PushDrop output value — token-style 1 sat. */
const PUSHDROP_SATOSHIS = 1;

/** Basket that holds live submission anchors. Find them later via listOutputs. */
export const BRIXIT_SUBMISSION_BASKET = 'brixit-submissions';

// ─── Public types ────────────────────────────────────────────────────────────

export type SubmissionOp = 'NEW' | 'EDIT' | 'DELETE';

/** One signed reading. NEW takes an array of these (one per crop in the session). */
export interface SubmissionEntry {
  /** DB primary key for the reading. */
  submissionUuid: string;
  /** Submitter's identity pubkey (33-byte compressed, hex). */
  userIdentityKey: string;
  /** Random per-reading keyID the user passed to createSignature(counterparty:'anyone'). */
  userKeyID: string;
  /** Canonical JSON of the reading payload — exact bytes the user signed. */
  payloadJson: string;
  /** User's signature over `payloadJson`, hex-encoded. */
  userSignature: string;
}

interface PreviousPushDropOutpoint {
  /** 'txid.vout' */
  outpoint: string;
  /** BEEF of the source tx (so the wallet can verify and consume the input). */
  sourceBEEF: number[];
  /** Satoshi value of the previous output. */
  sourceSatoshis: number;
  /** Locking script of the previous output, hex. */
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
      /** P2PKH locking script (hex) the spent sats return to. */
      deletionPayoutLockingScriptHex: string;
      deletionPayoutSatoshis: number;
      extraLabels?: string[];
    };

export interface PerEntryResult {
  submissionUuid: string;
  /** 'txid.vout' for NEW/EDIT; undefined for DELETE (no PushDrop output). */
  pushDropOutpoint?: string;
  /** Position in `action.outputs` (== vout for non-randomized actions). */
  outputIndex?: number;
  /** Server signature hex; absent for DELETE. */
  serverSignature?: string;
  /** All 10 PushDrop fields, hex-encoded — useful for logging. Absent for DELETE. */
  fields?: string[];
}

export interface CreateSubmissionTxResult {
  txid: string;
  rawTxBEEF: AtomicBEEF;
  results: PerEntryResult[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function utf8Field(s: string): number[] {
  return Utils.toArray(s, 'utf8');
}

function hexField(hex: string): number[] {
  return Utils.toArray(hex, 'hex');
}

/**
 * sha256(length-prefixed concat of fields[0..8]). Length prefixes prevent
 * field-boundary ambiguity — two different field splits cannot produce the
 * same hash.
 */
function buildServerSigPreimage(fields: number[][]): number[] {
  const out: number[] = [];
  for (const f of fields) {
    const len = f.length;
    out.push((len >>> 24) & 0xff, (len >>> 16) & 0xff, (len >>> 8) & 0xff, len & 0xff);
    for (const b of f) out.push(b);
  }
  return Hash.sha256(out);
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

/**
 * Build a single PushDrop output for one signed reading. The server signs
 * sha256(fields[0..8]) with its identity key — included as field [9] so a
 * verifier can recompute the hash from the on-chain script alone.
 */
async function buildPushDropOutput(args: {
  pushDrop: PushDrop;
  wallet: WalletInterface;
  entry: SubmissionEntry;
  op: 'NEW' | 'EDIT';
  previousTxid: string;
}): Promise<BuiltPushDropOutput> {
  const { pushDrop, wallet, entry, op, previousTxid } = args;

  const fieldsWithoutServerSig: number[][] = [
    utf8Field(PROTOCOL_MARKER),
    utf8Field(PROTOCOL_VERSION),
    utf8Field(entry.submissionUuid),
    hexField(entry.userIdentityKey),
    utf8Field(entry.userKeyID),
    utf8Field(entry.payloadJson),
    utf8Field(op),
    utf8Field(previousTxid),
    hexField(entry.userSignature),
  ];

  const preimage = buildServerSigPreimage(fieldsWithoutServerSig);
  const { signature: serverSigBytes } = await wallet.createSignature({
    data: preimage,
    protocolID: SERVER_ANCHOR_PROTOCOL,
    keyID: entry.submissionUuid,
    counterparty: SERVER_ANCHOR_COUNTERPARTY,
  });
  const serverSignatureHex = Utils.toHex(serverSigBytes as number[]);

  const fields: number[][] = [
    ...fieldsWithoutServerSig,
    hexField(serverSignatureHex),
  ];

  const lock = await pushDrop.lock(
    [...fields],
    PUSHDROP_PROTOCOL,
    entry.submissionUuid,                // lock keyID = submissionUuid (stable across edits)
    PUSHDROP_COUNTERPARTY,
  );

  const customInstructions = JSON.stringify({
    protocolID: PUSHDROP_PROTOCOL,
    keyID: entry.submissionUuid,
    counterparty: PUSHDROP_COUNTERPARTY,
    submissionUuid: entry.submissionUuid,
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

/** Shared helper: spend one PushDrop UTXO via the 3-step createAction flow. */
async function spendPreviousPushDrop(args: {
  wallet: WalletInterface;
  pushDrop: PushDrop;
  keyID: string;
  previous: PreviousPushDropOutpoint;
  outputs: BuiltPushDropOutput[] | Array<{
    outputDescription: string;
    lockingScript: string;
    satoshis: number;
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

// ─── Main ────────────────────────────────────────────────────────────────────

export async function createSubmissionTx(
  input: CreateSubmissionTxInput,
): Promise<CreateSubmissionTxResult> {
  const pushDrop = new PushDrop(input.wallet);

  // ── NEW: N PushDrop outputs, no inputs (wallet funds + broadcasts) ─────────
  if (input.op === 'NEW') {
    if (input.entries.length === 0) {
      throw new Error('createSubmissionTx: entries must not be empty for NEW');
    }

    // Build each PushDrop output (one server signature per reading — local
    // wallet calls, fast).
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

  // ── EDIT: spend previous PushDrop → new PushDrop ───────────────────────────
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

  // ── DELETE: spend previous PushDrop → P2PKH back to treasury ───────────────
  const { txid, tx } = await spendPreviousPushDrop({
    wallet: input.wallet,
    pushDrop,
    keyID: input.submissionUuid,
    previous: input.previous,
    outputs: [{
      outputDescription: 'brixit submission delete payout',
      lockingScript: input.deletionPayoutLockingScriptHex,
      satoshis: input.deletionPayoutSatoshis,
    }],
    description: `BRIXit submission delete (${input.submissionUuid})`,
    labels: ['brixit-delete', ...(input.extraLabels ?? [])],
  });

  return {
    txid,
    rawTxBEEF: tx,
    results: [{
      submissionUuid: input.submissionUuid,
      // No pushDropOutpoint / serverSignature / fields for DELETE
    }],
  };
}
