import { describe, it, expect, beforeEach } from 'vitest';
import { enqueueWalletTask, whenQueueDrained } from '../walletQueue.js';

// The queue is a module-level singleton — drain it between tests so we
// start from a known state regardless of test order.
beforeEach(async () => {
  await whenQueueDrained();
});

describe('enqueueWalletTask', () => {
  it('runs tasks in FIFO order', async () => {
    const order: number[] = [];

    const p1 = enqueueWalletTask(async () => {
      await new Promise((r) => setTimeout(r, 20));
      order.push(1);
    });
    const p2 = enqueueWalletTask(async () => {
      order.push(2);
    });
    const p3 = enqueueWalletTask(async () => {
      order.push(3);
    });

    await Promise.all([p1, p2, p3]);
    expect(order).toEqual([1, 2, 3]);
  });

  it('returns the task result to its own caller', async () => {
    const p = enqueueWalletTask(async () => 'hello');
    await expect(p).resolves.toBe('hello');
  });

  it('rejects the caller when its task throws', async () => {
    const err = new Error('boom');
    const p = enqueueWalletTask(async () => {
      throw err;
    });
    await expect(p).rejects.toBe(err);
  });

  it('keeps running subsequent tasks after a failing one', async () => {
    const failure = enqueueWalletTask(async () => {
      throw new Error('first fails');
    });
    const later = enqueueWalletTask(async () => 'still ran');

    await expect(failure).rejects.toThrow('first fails');
    await expect(later).resolves.toBe('still ran');
  });

  it('serializes work — a slow task delays the next', async () => {
    const t0 = Date.now();
    const slow = enqueueWalletTask(async () => {
      await new Promise((r) => setTimeout(r, 40));
    });
    const fast = enqueueWalletTask(async () => Date.now());

    await slow;
    const fastFinishedAt = await fast;
    expect(fastFinishedAt - t0).toBeGreaterThanOrEqual(40);
  });
});

describe('whenQueueDrained', () => {
  it('resolves once all enqueued work has settled', async () => {
    let ran = 0;
    enqueueWalletTask(async () => {
      await new Promise((r) => setTimeout(r, 10));
      ran++;
    });
    enqueueWalletTask(async () => {
      ran++;
    });
    enqueueWalletTask(async () => {
      throw new Error('but the chain still drains');
    }).catch(() => undefined);

    await whenQueueDrained();
    expect(ran).toBe(2);
  });
});
