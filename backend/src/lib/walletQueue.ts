/**
 * FIFO queue for wallet-touching tasks.
 *
 * Concurrent createAction calls can race over the same UTXOs / action
 * references and corrupt wallet internals — serializing all wallet work
 * eliminates that. A failing task doesn't break the chain; the caller of
 * the failing task still receives its rejection.
 */

let chain: Promise<unknown> = Promise.resolve();

export function enqueueWalletTask<T>(task: () => Promise<T>): Promise<T> {
  const result = chain.then(task, task);
  chain = result.catch(() => undefined);
  return result;
}

export function whenQueueDrained(): Promise<void> {
  return chain.then(() => undefined, () => undefined);
}
