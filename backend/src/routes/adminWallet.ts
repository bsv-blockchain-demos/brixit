/**
 * Admin treasury wallet endpoints (admin role required).
 *
 *   GET /balance   — spendable change in satoshis
 *   GET /info      — chain, identity key, daily-rotating BRC-29 top-up address
 *   GET /activity  — recent on-chain actions, filterable by label
 *   GET /pending   — submission rows whose anchor never broadcast
 */
import { Router } from 'express';
import type { Response } from 'express';
import { PublicKey, Utils, type WalletProtocol } from '@bsv/sdk';
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
    rotatesAt: tomorrow.toISOString(),
  };
}

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
        counterparty: 'self',
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
      derivationPrefix:    derivation.derivationPrefix,
      derivationSuffix:    derivation.derivationSuffix,
    });
  } catch (err: any) {
    console.error('[admin-wallet] /info failed:', err);
    res.status(500).json({ error: err?.message || 'Failed to fetch wallet info' });
  }
});

// ?label= filters by labels (comma-separated, any-of); defaults to all three.
router.get('/activity', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const labelParam = (req.query.label as string | undefined)?.trim();
    const labels = labelParam
      ? labelParam.split(',').map((l) => l.trim()).filter(Boolean)
      : ['brixit-submission', 'brixit-edit', 'brixit-delete'];

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

    res.json({
      totalActions: result.totalActions,
      actions: result.actions,
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
