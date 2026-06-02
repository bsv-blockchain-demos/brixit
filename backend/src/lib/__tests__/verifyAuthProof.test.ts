import { describe, it, expect, vi } from 'vitest';
import { verifyAuthProof } from '../verifyAuthProof.js';
import { consumeNonce, _resetNonceStore } from '../nonceStore.js';
import { DEFAULT_WINDOW_MS } from '@bsv/auth';
import type { AuthProof } from '../authProof.js';

const NOW = 1_700_000_000_000;
const IDENTITY = '02abc';

const proof = (over: Partial<AuthProof['data']> = {}): AuthProof => ({
    data: {
        action: 'login',
        identityKey: IDENTITY,
        expiresAt: NOW + DEFAULT_WINDOW_MS,
        nonce: 'cmFuZG9tbm9uY2U=',
        ...over,
    },
    signature: [1, 2, 3],
});

const okWallet = () => ({ verifySignature: vi.fn(async () => ({ valid: true })) });
const consumeOk = () => true;

describe('verifyAuthProof (wrapper over @bsv/auth)', () => {
    it('accepts a valid, fresh, unused proof and returns the identity key', async () => {
        const wallet = okWallet();
        const result = await verifyAuthProof(wallet, proof(), 'login', { now: NOW, consumeNonce: consumeOk });
        expect(result).toEqual({ valid: true, identityKey: IDENTITY });
        expect(wallet.verifySignature).toHaveBeenCalledOnce();
    });

    it('rejects a malformed proof before doing any work', async () => {
        const wallet = okWallet();
        const result = await verifyAuthProof(wallet, { data: undefined, signature: [] } as unknown as AuthProof, 'login', { now: NOW, consumeNonce: consumeOk });
        expect(result.error).toBe('Malformed proof');
        expect(wallet.verifySignature).not.toHaveBeenCalled();
    });

    it('rejects an action mismatch without checking the signature', async () => {
        const wallet = okWallet();
        const result = await verifyAuthProof(wallet, proof(), 'delete', { now: NOW, consumeNonce: consumeOk });
        expect(result.error).toBe('Action mismatch');
        expect(wallet.verifySignature).not.toHaveBeenCalled();
    });

    it('rejects an expired proof without checking the signature', async () => {
        const wallet = okWallet();
        const result = await verifyAuthProof(wallet, proof({ expiresAt: NOW - 1 }), 'login', { now: NOW, consumeNonce: consumeOk });
        expect(result.error).toBe('Proof expired');
        expect(wallet.verifySignature).not.toHaveBeenCalled();
    });

    it('rejects an invalid signature and does not consume the nonce', async () => {
        const wallet = { verifySignature: vi.fn(async () => ({ valid: false })) };
        const consume = vi.fn(() => true);
        const result = await verifyAuthProof(wallet, proof(), 'login', { now: NOW, consumeNonce: consume });
        expect(result.error).toBe('Invalid signature');
        expect(consume).not.toHaveBeenCalled();
    });

    it('rejects a replayed proof (nonce already consumed)', async () => {
        const wallet = okWallet();
        const result = await verifyAuthProof(wallet, proof(), 'login', { now: NOW, consumeNonce: () => false });
        expect(result.error).toBe('Proof already used');
    });

    it('verifies the signature against the proof identity key and nonce', async () => {
        const wallet = okWallet();
        await verifyAuthProof(wallet, proof(), 'login', { now: NOW, consumeNonce: consumeOk });
        expect(wallet.verifySignature).toHaveBeenCalledWith(
            expect.objectContaining({ counterparty: IDENTITY, keyID: 'cmFuZG9tbm9uY2U=' }),
        );
    });
});

describe('nonceStore.consumeNonce (in-memory single-use store)', () => {
    it('accepts a nonce once and rejects the replay', () => {
        _resetNonceStore();
        const expiresAt = new Date(NOW + DEFAULT_WINDOW_MS);
        expect(consumeNonce('n1', expiresAt, NOW)).toBe(true);
        expect(consumeNonce('n1', expiresAt, NOW)).toBe(false);
    });

    it('accepts distinct nonces', () => {
        _resetNonceStore();
        const expiresAt = new Date(NOW + DEFAULT_WINDOW_MS);
        expect(consumeNonce('a', expiresAt, NOW)).toBe(true);
        expect(consumeNonce('b', expiresAt, NOW)).toBe(true);
    });

    it('frees a nonce once its record has expired (swept)', () => {
        _resetNonceStore();
        expect(consumeNonce('n', new Date(NOW + 1000), NOW)).toBe(true);
        // Well past expiry + sweep interval → record evicted, nonce usable again.
        expect(consumeNonce('n', new Date(NOW + 200_000 + 1000), NOW + 200_000)).toBe(true);
    });
});
