/**
 * In-memory single-use nonce store (@bsv/auth ConsumeNonce contract). Safe only
 * because the backend is single-instance — already required by the in-process
 * walletQueue. If ever scaled to multiple replicas, replace with a shared store
 * (e.g. a DB table with a unique `nonce` index).
 */

const used = new Map<string, number>(); // nonce -> expiresAt (ms epoch)
let lastSweep = 0;
const SWEEP_INTERVAL_MS = 60 * 1000;

function sweep(now: number): void {
    for (const [nonce, expiresAt] of used) {
        if (expiresAt <= now) used.delete(nonce);
    }
    lastSweep = now;
}

/** Records the nonce; returns false if already used (replay). `now` is injectable for tests. */
export function consumeNonce(nonce: string, expiresAt: Date, now: number = Date.now()): boolean {
    if (now - lastSweep > SWEEP_INTERVAL_MS) sweep(now);

    const existing = used.get(nonce);
    if (existing !== undefined && existing > now) {
        return false; // still-valid record → replay
    }
    used.set(nonce, expiresAt.getTime());
    return true;
}

/** Test helper. */
export function _resetNonceStore(): void {
    used.clear();
    lastSweep = 0;
}
