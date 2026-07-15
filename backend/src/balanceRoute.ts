import { createHash, timingSafeEqual } from 'node:crypto'
import { Router, type Request, type Response } from 'express'

/**
 * Minimal structural view of the wallet a monitored app already runs.
 * Only the read-only surface Float needs is declared here: this module never
 * constructs a wallet, never receives a key, and has no dependency on any
 * @bsv/* package (Security Gate checks 1 and 2). The app passes its existing
 * wallet instance in; anything satisfying this shape works.
 */
export interface BalanceRouteWallet {
  listOutputs(args: { basket: string; limit?: number; offset?: number }): Promise<{
    totalOutputs: number
    outputs: Array<{ satoshis: number; spendable?: boolean }>
  }>
  getPublicKey?(args: { identityKey: true }): Promise<{ publicKey: string }>
}

export interface CreateBalanceRouteOptions {
  /** The app's existing wallet instance. Never a key, never a config to build one. */
  wallet: BalanceRouteWallet
  /** Registry name of this app, echoed in the response body. */
  appName: string
  chain: 'main' | 'test'
  /**
   * Bearer token the Float poller presents (FLOAT_BALANCE_TOKEN in the app's
   * environment). Compared in constant time; never logged.
   */
  token: string
  /** Baskets to sum. Defaults to ['default']. */
  baskets?: string[]
  /**
   * Opt in to reading the 'default' basket total via the wallet-toolbox
   * balance spec-op (see TOOLBOX_BALANCE_SPEC_OP). Enable only when the app's
   * wallet is @bsv/wallet-toolbox or wallet-toolbox-client. The first request
   * cross-checks the spec-op against the paginated sum; on a mismatch the
   * route reports through onError, answers with the paginated sum, and keeps
   * paginating for the life of the process. Baskets other than 'default' are
   * always summed by pagination.
   */
  toolboxFastBalance?: boolean
  /**
   * Identity public key to report. Optional; when omitted the route asks the
   * wallet once via getPublicKey({ identityKey: true }) and caches the result.
   * The identity key is public, stable, and safe to display.
   */
  identityKey?: string
  /** Invoked when a wallet read fails. The HTTP response stays generic. */
  onError?: (err: unknown) => void
}

/** Page size used when walking listOutputs results. */
const PAGE_SIZE = 200
/** Hard cap on pages per basket so a misbehaving wallet cannot spin forever. */
const MAX_PAGES = 50

/**
 * wallet-toolbox "balance" spec-op: passing this string as the basket name to
 * listOutputs makes toolbox storage sum the spendable outputs in the wallet's
 * 'default' basket inside the storage engine and return the satoshi total in
 * totalOutputs (outputs comes back empty). One call, no pagination, immune to
 * the MAX_PAGES cap. It is a wallet-toolbox implementation detail, not part
 * of BRC-100: any other wallet sees an unknown, empty basket and reports
 * zero, which is why the fast path is opt-in and verified before it is
 * trusted. The value is a basket-name constant, not a key or secret.
 */
export const TOOLBOX_BALANCE_SPEC_OP =
  '893b7646de0e1c9f741bd6e9169b76a8847ae34adef7bef1e6a285371206d2e8'

/**
 * Constant-time string comparison. Both sides are hashed first so lengths are
 * equalised without leaking length information through timingSafeEqual's
 * length precondition.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a, 'utf8').digest()
  const hb = createHash('sha256').update(b, 'utf8').digest()
  return timingSafeEqual(ha, hb)
}

async function sumBasket(
  wallet: BalanceRouteWallet,
  basket: string
): Promise<number> {
  let total = 0
  let offset = 0
  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await wallet.listOutputs({ basket, limit: PAGE_SIZE, offset })
    for (const output of result.outputs) {
      // Outputs default to spendable unless the wallet marks them otherwise.
      if (output.spendable !== false) total += output.satoshis
    }
    offset += result.outputs.length
    if (result.outputs.length === 0 || offset >= result.totalOutputs) break
  }
  return total
}

/**
 * Express router factory for the Float balance endpoint.
 *
 * Mounts GET /treasury/balance behind bearer auth. Read-only by construction:
 * the only wallet calls are listOutputs and (optionally) getPublicKey. There
 * is no code path here that signs, builds, or broadcasts a transaction.
 *
 * Usage inside a monitored app:
 *   app.use(createBalanceRoute({ wallet, appName: 'my-app', chain: 'main',
 *     token: process.env.FLOAT_BALANCE_TOKEN! }))
 */
export function createBalanceRoute(options: CreateBalanceRouteOptions): Router {
  const { wallet, appName, chain, token, onError } = options
  const baskets = options.baskets ?? ['default']

  if (!token || token.length < 16) {
    throw new Error(
      'createBalanceRoute: token must be a random string of at least 16 characters'
    )
  }

  let cachedIdentityKey: string | undefined = options.identityKey

  // 'unverified' until the first spec-op result matches a paginated sum; any
  // mismatch (for example, the wallet is not actually wallet-toolbox, so the
  // spec-op looks like an empty basket) disables the fast path for the life
  // of the process in favour of the portable sum.
  let fastPath: 'disabled' | 'unverified' | 'trusted' = options.toolboxFastBalance
    ? 'unverified'
    : 'disabled'

  async function defaultBasketTotal(): Promise<number> {
    const { totalOutputs } = await wallet.listOutputs({ basket: TOOLBOX_BALANCE_SPEC_OP })
    if (fastPath === 'unverified') {
      const paginated = await sumBasket(wallet, 'default')
      if (paginated !== totalOutputs) {
        fastPath = 'disabled'
        onError?.(
          new Error(
            `toolboxFastBalance disabled: spec-op total ${totalOutputs} does not match paginated sum ${paginated}`
          )
        )
        return paginated
      }
      fastPath = 'trusted'
    }
    return totalOutputs
  }

  const router = Router()

  router.get('/treasury/balance', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store')

    const header = req.headers.authorization ?? ''
    const presented = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : ''
    if (!constantTimeEqual(presented, token)) {
      // Deliberately uniform: no hint about whether the header was missing,
      // malformed, or wrong (Security Gate check 4).
      res.status(401).json({ error: 'unauthorized' })
      return
    }

    try {
      if (!cachedIdentityKey) {
        if (!wallet.getPublicKey) {
          throw new Error('identityKey not configured and wallet has no getPublicKey')
        }
        const { publicKey } = await wallet.getPublicKey({ identityKey: true })
        cachedIdentityKey = publicKey
      }

      const perBasket: Record<string, number> = {}
      for (const basket of baskets) {
        perBasket[basket] =
          basket === 'default' && fastPath !== 'disabled'
            ? await defaultBasketTotal()
            : await sumBasket(wallet, basket)
      }
      const spendableSatoshis = Object.values(perBasket).reduce((a, b) => a + b, 0)

      res.json({
        app: appName,
        chain,
        identityKey: cachedIdentityKey,
        spendableSatoshis,
        baskets: perBasket,
        timestamp: new Date().toISOString(),
      })
    } catch (err) {
      // The response carries no detail; the app owner sees the real error via
      // onError. Nothing from the wallet or environment is echoed to the
      // caller (Security Gate check 5).
      onError?.(err)
      res.status(500).json({ error: 'balance_unavailable' })
    }
  })

  return router
}
