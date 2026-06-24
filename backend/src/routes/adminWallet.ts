/**
 * Admin treasury wallet endpoints (admin role required).
 *
 *   GET  /balance            — spendable change in satoshis
 *   GET  /info               — chain, identity key, daily-rotating BRC-29 top-up address
 *   GET  /activity           — recent on-chain actions, filterable by label
 *   GET  /pending            — submission rows whose anchor never broadcast
 *   POST /topup/internalize  — internalize a wallet-payment tx built by an admin's local wallet
 *   POST /topup/sweep        — pull external P2PKH payments sent to the rotating address into the treasury
 */
import { Router } from 'express';
import type { Response } from 'express';
import { Beef, P2PKH, PrivateKey, PublicKey, Utils, type WalletProtocol } from '@bsv/sdk';
import prisma from '../db/client.js';
import { requireAuth, requireAdmin, type AuthenticatedRequest } from '../middleware/auth.js';
import serverWallet, {
  SERVER_WALLET_CHAIN,
  SERVER_WALLET_STORAGE_URL,
} from '../serverWallet.js';
import { enqueueWalletTask } from '../lib/walletQueue.js';

const router = Router();

router.use(requireAuth as any, requireAdmin as any);

// wallet-toolbox spec-op: returns balance (sats) in `totalOutputs`; `outputs` is empty.
const SPEC_OP_WALLET_BALANCE = '893b7646de0e1c9f741bd6e9169b76a8847ae34adef7bef1e6a285371206d2e8';
const LOW_BALANCE_WARNING_SATOSHIS = 10_000;

router.get('/balance', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const balance = await enqueueWalletTask(async () => {
      const { totalOutputs } = await serverWallet.listOutputs({
        basket: SPEC_OP_WALLET_BALANCE,
      });
      return totalOutputs;
    });

    res.json({
      satoshis: balance,
      lowBalanceWarning: balance < LOW_BALANCE_WARNING_SATOSHIS,
      threshold: LOW_BALANCE_WARNING_SATOSHIS,
    });
  } catch (err: any) {
    console.error('[admin-wallet] /balance failed:', err);
    res.status(500).json({ error: err?.message || 'Failed to fetch wallet balance' });
  }
});

// BRC-29 payment protocol — what internalizeAction({ protocol: 'wallet payment' })
// reconstructs internally. KeyID format: "<derivationPrefix> <derivationSuffix>".
const BRC29_PROTOCOL: WalletProtocol = [2, '3241645161d8'];

// Deterministic per-UTC-day so the address is stable for the day across
// restarts; funds to older derivations stay spendable.
function currentTopupDerivation(now: Date = new Date()): {
  derivationPrefix: string;
  derivationSuffix: string;
  keyID: string;
  date: string;
  rotatesAt: string;
} {
  const day = now.toISOString().slice(0, 10);
  const derivationPrefix = Utils.toBase64(Utils.toArray(`brixit-topup-prefix-${day}`, 'utf8'));
  const derivationSuffix = Utils.toBase64(Utils.toArray(`brixit-topup-suffix-${day}`, 'utf8'));
  const tomorrow = new Date(now);
  tomorrow.setUTCHours(24, 0, 0, 0);
  return {
    derivationPrefix,
    derivationSuffix,
    keyID: `${derivationPrefix} ${derivationSuffix}`,
    date: day,
    rotatesAt: tomorrow.toISOString(),
  };
}

// Counterparty for the top-up derivation
const BRC29_COUNTERPARTY = 'self' as const;

router.get('/info', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const derivation = currentTopupDerivation();

    const [{ publicKey: identityKey }, { publicKey: topupPubKey }] = await Promise.all([
      serverWallet.getPublicKey({ identityKey: true }),
      // TODO: when a real top-up scheme exists, replace 'self' with the
      // sender's identity key and pass the same prefix/suffix to
      // internalizeAction({ paymentRemittance }).
      serverWallet.getPublicKey({
        protocolID: BRC29_PROTOCOL,
        keyID: derivation.keyID,
        counterparty: BRC29_COUNTERPARTY,
      }),
    ]);

    const network = SERVER_WALLET_CHAIN === 'main' ? 'mainnet' : 'testnet';
    const address = PublicKey.fromString(topupPubKey).toAddress(network);

    res.json({
      chain: SERVER_WALLET_CHAIN,
      storageUrl: SERVER_WALLET_STORAGE_URL,
      identityKey,
      address,
      addressKeyID:        derivation.keyID,
      addressRotatesAt:    derivation.rotatesAt,
      addressDate:         derivation.date,
      derivationPrefix:    derivation.derivationPrefix,
      derivationSuffix:    derivation.derivationSuffix,
      // Public derivation params
      protocolID:          BRC29_PROTOCOL,
      counterparty:        BRC29_COUNTERPARTY,
    });
  } catch (err: any) {
    console.error('[admin-wallet] /info failed:', err);
    res.status(500).json({ error: err?.message || 'Failed to fetch wallet info' });
  }
});

// ── Top-up flows ─────────────────────────────────────────────────────────────

// WhatsOnChain endpoints by chain. Each pair: UTXO list + per-tx BEEF.
const WOC_BY_CHAIN = {
  main: 'https://api.whatsonchain.com/v1/bsv/main',
  test: 'https://api.whatsonchain.com/v1/bsv/test',
} as const;

// Placeholder for paymentRemittance.senderIdentityKey when funds came from an
// arbitrary external wallet with no known BRC-29 peer
const EXTERNAL_SENDER_PLACEHOLDER = new PrivateKey(1).toPublicKey().toString();

/**
 * Local-wallet top-up. The admin's browser built a wallet-payment tx targeting
 * the treasury and POSTs the resulting BEEF + remittance here so the treasury
 * wallet can claim the outputs.
 */
router.post('/topup/internalize', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      tx,
      outputIndex,
      derivationPrefix,
      derivationSuffix,
      senderIdentityKey,
      description,
    } = req.body as {
      tx?: number[];
      outputIndex?: number;
      derivationPrefix?: string;
      derivationSuffix?: string;
      senderIdentityKey?: string;
      description?: string;
    };

    if (!Array.isArray(tx) || tx.length === 0) {
      res.status(400).json({ error: 'tx (BEEF byte array) is required' });
      return;
    }
    if (typeof outputIndex !== 'number' || outputIndex < 0) {
      res.status(400).json({ error: 'outputIndex must be a non-negative number' });
      return;
    }
    if (!derivationPrefix || !derivationSuffix || !senderIdentityKey) {
      res.status(400).json({ error: 'derivationPrefix, derivationSuffix, and senderIdentityKey are required' });
      return;
    }

    const result = await enqueueWalletTask(() =>
      serverWallet.internalizeAction({
        tx,
        outputs: [
          {
            outputIndex,
            protocol: 'wallet payment',
            paymentRemittance: {
              derivationPrefix,
              derivationSuffix,
              senderIdentityKey,
            },
          },
        ],
        description: description || 'BRIXit treasury top-up from local wallet',
        labels: ['brixit-topup', 'inbound', 'local-wallet'],
      }),
    );

    res.json({ accepted: result?.accepted ?? false });
  } catch (err: any) {
    console.error('[admin-wallet] /topup/internalize failed:', err);
    res.status(500).json({ error: err?.message || 'Failed to internalize top-up payment' });
  }
});

/**
 * External-address top-up. Polls WhatsOnChain for UTXOs at the rotating address
 * (today by default; pass ?date=YYYY-MM-DD to sweep a past day's address) and
 * internalizes each into the treasury wallet. Idempotent — UTXOs already
 * internalized are skipped via the address label.
 */
router.post('/topup/sweep', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const dateParam = (req.query.date as string | undefined)?.trim();
    if (dateParam && !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      res.status(400).json({ error: 'date must be YYYY-MM-DD' });
      return;
    }
    const baseDate = dateParam ? new Date(`${dateParam}T00:00:00.000Z`) : new Date();
    if (isNaN(baseDate.getTime())) {
      res.status(400).json({ error: 'date is not a valid calendar date' });
      return;
    }

    const derivation = currentTopupDerivation(baseDate);

    // Re-derive the address (same call /info uses).
    const { publicKey: topupPubKey } = await enqueueWalletTask(() =>
      serverWallet.getPublicKey({
        protocolID: BRC29_PROTOCOL,
        keyID: derivation.keyID,
        counterparty: BRC29_COUNTERPARTY,
      }),
    );
    const network = SERVER_WALLET_CHAIN === 'main' ? 'mainnet' : 'testnet';
    const address = PublicKey.fromString(topupPubKey).toAddress(network);

    // Pull UTXOs at the address from WhatsOnChain.
    const wocBase = WOC_BY_CHAIN[SERVER_WALLET_CHAIN as 'main' | 'test'];
    const utxoResp = await fetch(`${wocBase}/address/${address}/unspent/all`);
    if (!utxoResp.ok) {
      res.status(502).json({ error: `WhatsOnChain UTXO lookup failed: ${utxoResp.status}` });
      return;
    }
    const utxoJson = await utxoResp.json() as { result?: Array<{ tx_hash: string; tx_pos: number; value: number; isSpentInMempoolTx?: boolean }> };
    const utxos = (utxoJson.result ?? [])
      .filter((u) => !u.isSpentInMempoolTx)
      .map((u) => ({ txid: u.tx_hash, vout: u.tx_pos, satoshis: u.value }));

    if (utxos.length === 0) {
      res.json({ address, swept: 0, satoshis: 0, skipped: 0, message: 'No UTXOs found at this address' });
      return;
    }

    // Skip UTXOs we've already internalized — labelled by the address itself.
    const seen = new Set<string>();
    const prior = await enqueueWalletTask(() =>
      serverWallet.listActions({
        labels: [address],
        labelQueryMode: 'all',
        includeOutputs: true,
        limit: 1000,
      }),
    );
    for (const a of prior.actions ?? []) {
      for (const o of a.outputs ?? []) {
        if (a.txid) seen.add(`${a.txid}.${o.outputIndex}`);
      }
    }
    const fresh = utxos.filter((u) => !seen.has(`${u.txid}.${u.vout}`));
    const skipped = utxos.length - fresh.length;

    if (fresh.length === 0) {
      res.json({ address, swept: 0, satoshis: 0, skipped, message: 'All UTXOs already internalized' });
      return;
    }

    // Fetch BEEF per txid (txids may repeat across outputs).
    const beef = new Beef();
    const uniqueTxids = Array.from(new Set(fresh.map((u) => u.txid)));
    for (const txid of uniqueTxids) {
      if (beef.findTxid(txid)) continue;
      const beefResp = await fetch(`${wocBase}/tx/${txid}/beef`);
      if (!beefResp.ok) {
        res.status(502).json({ error: `WhatsOnChain BEEF fetch failed for ${txid}: ${beefResp.status}` });
        return;
      }
      const beefHex = await beefResp.text();
      beef.mergeBeef(Utils.toArray(beefHex.trim(), 'hex'));
    }

    // Group UTXOs by txid and internalize one tx at a time.
    let totalSats = 0;
    let internalizedCount = 0;
    let failureCount = 0;
    for (const txid of uniqueTxids) {
      const atomic = beef.findAtomicTransaction(txid);
      if (!atomic) {
        failureCount++;
        continue;
      }
      const outputsForTx = fresh.filter((u) => u.txid === txid);
      try {
        const result = await enqueueWalletTask(() =>
          serverWallet.internalizeAction({
            tx: atomic.toAtomicBEEF(),
            outputs: outputsForTx.map((u) => ({
              outputIndex: u.vout,
              protocol: 'wallet payment' as const,
              paymentRemittance: {
                derivationPrefix: derivation.derivationPrefix,
                derivationSuffix: derivation.derivationSuffix,
                senderIdentityKey: EXTERNAL_SENDER_PLACEHOLDER,
              },
            })),
            description: `BRIXit treasury sweep from ${address}`,
            labels: ['brixit-topup', 'inbound', 'address-sweep', address, `ts:${Math.floor(Date.now() / 1000)}`],
          }),
        );
        if (result?.accepted) {
          internalizedCount += outputsForTx.length;
          totalSats += outputsForTx.reduce((s, u) => s + u.satoshis, 0);
        } else {
          failureCount += outputsForTx.length;
        }
      } catch (err: any) {
        console.error(`[admin-wallet] internalize ${txid} failed:`, err?.message);
        failureCount += outputsForTx.length;
      }
    }

    res.json({
      address,
      swept: internalizedCount,
      satoshis: totalSats,
      skipped,
      failed: failureCount,
    });
  } catch (err: any) {
    console.error('[admin-wallet] /topup/sweep failed:', err);
    res.status(500).json({ error: err?.message || 'Failed to sweep top-up address' });
  }
});

// ?label= filters by labels (comma-separated, any-of); defaults to all three.
router.get('/activity', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const labelParam = (req.query.label as string | undefined)?.trim();
    const labels = labelParam
      ? labelParam.split(',').map((l) => l.trim()).filter(Boolean)
      : ['brixit-submission', 'brixit-edit', 'brixit-delete', 'brixit-topup'];

    const limit = Math.max(1, Math.min(Number(req.query.limit) || 25, 100));
    const offset = Math.max(0, Number(req.query.offset) || 0);

    const result = await enqueueWalletTask(() =>
      serverWallet.listActions({
        labels,
        labelQueryMode: 'any',
        includeLabels: true,
        limit,
        offset,
      }),
    );

    // Wallet actions carry no timestamp, so we surface a real datetime by
    // matching each action's txid to the anchoring submission's outpoint
    // ('txid.vout') and reading its assessmentDate. Top-ups and hard-deleted
    // submissions have no matching row, so their timestamp stays null.
    const actions = result.actions ?? [];
    const txids = [...new Set(actions.map((a: any) => a.txid).filter(Boolean))] as string[];
    const tsByTxid = new Map<string, string>();
    if (txids.length) {
      const subs = await prisma.submission.findMany({
        where: { OR: txids.map((t) => ({ outpoint: { startsWith: t } })) },
        select: { outpoint: true, assessmentDate: true },
      });
      for (const s of subs) {
        if (!s.outpoint || !s.assessmentDate) continue;
        const tx = s.outpoint.split('.')[0];
        const iso = s.assessmentDate.toISOString();
        // Siblings in a session share a txid; keep the most recent date.
        const existing = tsByTxid.get(tx);
        if (!existing || iso > existing) tsByTxid.set(tx, iso);
      }
    }

    res.json({
      totalActions: result.totalActions,
      actions: actions.map((a: any) => ({ ...a, timestamp: tsByTxid.get(a.txid) ?? null })),
    });
  } catch (err: any) {
    console.error('[admin-wallet] /activity failed:', err);
    res.status(500).json({ error: err?.message || 'Failed to fetch wallet activity' });
  }
});

// outpoint IS NULL means the anchor never broadcast. No automatic retry
// because user_signature isn't persisted — resubmission requires the signer.
router.get('/pending', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 50, 500));
    const offset = Math.max(0, Number(req.query.offset) || 0);

    const [rows, total] = await Promise.all([
      prisma.submission.findMany({
        where: { outpoint: null },
        orderBy: { assessmentDate: 'desc' },
        select: {
          id: true,
          userId: true,
          assessmentDate: true,
          brixValue: true,
          contributorName: true,
          crop: { select: { name: true } },
          venue: { select: { name: true, city: true } },
        },
        take: limit,
        skip: offset,
      }),
      prisma.submission.count({ where: { outpoint: null } }),
    ]);

    res.json({ total, rows });
  } catch (err: any) {
    console.error('[admin-wallet] /pending failed:', err);
    res.status(500).json({ error: err?.message || 'Failed to fetch pending submissions' });
  }
});

export default router;
