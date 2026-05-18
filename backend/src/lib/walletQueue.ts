/**
 * Single FIFO queue for tasks that touch the treasury wallet.
 *
 * Why: the wallet keeps internal state per request (UTXO selection, action
 * references, signable-transaction tables). Two concurrent `createAction`s
 * can race over the same UTXO and corrupt that state. Serializing all
 * wallet-touching work eliminates the entire class of races at the cost of
 * throughput — fine for our anchor-per-submission load.
 *
 * Tasks are awaited in submission order. A failing task does NOT break the
 * chain — subsequent tasks still run; the original promise still rejects to
 * its caller.
 */

let chain: Promise<unknown> = Promise.resolve();

export function enqueueWalletTask<T>(task: () => Promise<T>): Promise<T> {
  // `.then(task, task)` runs the task whether the previous link resolved or
  // rejected — we only care that it *finished*.
  const result = chain.then(task, task);
  // Swallow the result/error on the internal chain so the next task can run.
  // The returned `result` still surfaces success/failure to the caller.
  chain = result.catch(() => undefined);
  return result;
}

/** Resolves once every currently-enqueued task has settled. Useful for tests. */
export function whenQueueDrained(): Promise<void> {
  return chain.then(() => undefined, () => undefined);
}
