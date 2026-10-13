import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Beef, KeyDeriver, P2PKH, PrivateKey, PublicKey, Transaction, Utils } from '@bsv/sdk';

/**
 * The address the sweep reads from WhatsOnChain must be the same key that
 * internalizeAction re-derives from paymentRemittance. The fake wallet below
 * runs the real KeyDeriver and the same lock-script check wallet-toolbox's
 * signer does (signer/methods/internalizeAction.js setupWalletPaymentForOutput).
 */

const BRC29_PROTOCOL: [2, string] = [2, '3241645161d8'];
const keyDeriver = new KeyDeriver(new PrivateKey(42));
const internalizeCalls: any[] = [];

const fakeWallet = {
  getPublicKey: async (args: any) => ({
    publicKey: args.identityKey
      ? keyDeriver.identityKey
      : keyDeriver.derivePublicKey(args.protocolID, args.keyID, args.counterparty).toString(),
  }),
  listActions: async () => ({ totalActions: 0, actions: [] }),
  internalizeAction: async (args: any) => {
    internalizeCalls.push(args);
    const tx = Transaction.fromAtomicBEEF(args.tx);
    for (const o of args.outputs) {
      const p = o.paymentRemittance;
      const priv = keyDeriver.derivePrivateKey(
        BRC29_PROTOCOL,
        `${p.derivationPrefix} ${p.derivationSuffix}`,
        p.senderIdentityKey,
      );
      if (tx.outputs[o.outputIndex].lockingScript.toHex() !== new P2PKH().lock(priv.toAddress()).toHex()) {
        throw new Error('paymentRemittance must be locked by script conforming to BRC-29');
      }
    }
    return { accepted: true };
  },
};

vi.mock('../../serverWallet.js', () => ({
  default: fakeWallet,
  SERVER_WALLET_CHAIN: 'main',
  SERVER_WALLET_STORAGE_URL: 'https://storage.invalid',
}));
vi.mock('../../db/client.js', () => ({ default: {} }));
vi.mock('../../middleware/auth.js', () => ({
  requireAuth: (_req: any, _res: any, next: any) => next(),
  requireAdmin: (_req: any, _res: any, next: any) => next(),
}));

const { default: router } = await import('../adminWallet.js');

function routeHandler(method: string, path: string) {
  const layer = (router as any).stack.find((l: any) => l.route?.path === path && l.route.methods[method]);
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

async function call(method: string, path: string, query: Record<string, string> = {}) {
  let body: any;
  let status = 200;
  const res: any = {
    status(code: number) { status = code; return res; },
    json(b: any) { body = b; return res; },
  };
  await routeHandler(method, path)({ query, body: {} }, res);
  return { status, body };
}

describe('POST /topup/sweep', () => {
  beforeEach(() => { internalizeCalls.length = 0; });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('internalizes a payment sent to the address /info advertises', async () => {
    const { body: info } = await call('get', '/info');

    // Pay 1000 sats to the advertised address from an unrelated wallet.
    const funding = new Transaction();
    funding.addOutput({ lockingScript: new P2PKH().lock(new PrivateKey(7).toAddress()), satoshis: 5000 });
    const payment = new Transaction();
    payment.addInput({ sourceTransaction: funding, sourceOutputIndex: 0, unlockingScript: new P2PKH().lock(PublicKey.fromString(keyDeriver.identityKey).toAddress()) });
    payment.addOutput({ lockingScript: new P2PKH().lock(info.address), satoshis: 1000 });
    const beef = new Beef();
    beef.mergeTransaction(payment);
    const txid = payment.id('hex');

    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith(`/address/${info.address}/unspent/all`)) {
        return { ok: true, json: async () => ({ result: [{ tx_hash: txid, tx_pos: 0, value: 1000 }] }) };
      }
      if (url.endsWith(`/tx/${txid}/beef`)) {
        return { ok: true, text: async () => Utils.toHex(beef.toBinary()) };
      }
      return { ok: false, status: 404 };
    }));

    const { status, body } = await call('post', '/topup/sweep');

    expect(status).toBe(200);
    expect(body.address).toBe(info.address);
    expect(body.failed).toBe(0);
    expect(body.swept).toBe(1);
    expect(body.satoshis).toBe(1000);
    expect(internalizeCalls).toHaveLength(1);
  });
});
