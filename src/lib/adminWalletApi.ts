import { apiGet, apiPost } from '@/lib/api';

export interface WalletBalance {
  satoshis: number;
  lowBalanceWarning: boolean;
  threshold: number;
}

export interface WalletInfo {
  chain: 'main' | 'test';
  storageUrl: string;
  identityKey: string;
  /** Top-up address derived from a daily-rotating BRC-29 derivation. Past addresses remain spendable. */
  address: string;
  /** Composite BRC-29 keyID: "<derivationPrefix> <derivationSuffix>". */
  addressKeyID: string;
  /** ISO timestamp of the next UTC midnight (when a fresh derivation will be used). */
  addressRotatesAt: string;
  /** UTC date the current derivation maps to (YYYY-MM-DD). */
  addressDate: string;
  /** Base64 prefix — pass through to `internalizeAction({ paymentRemittance })` on top-up. */
  derivationPrefix: string;
  /** Base64 suffix — pass through to `internalizeAction({ paymentRemittance })` on top-up. */
  derivationSuffix: string;
  /** BRC-29 protocol tuple — `[securityLevel, protocolName]`. Public, not a secret. */
  protocolID: [number, string];
  /** Counterparty used when deriving the top-up key. Public, not a secret. */
  counterparty: 'self' | 'anyone' | string;
}

export interface WalletActionOutput {
  satoshis: number;
  spendable: boolean;
  outputIndex: number;
  outputDescription: string;
  basket: string;
  tags: string[];
  customInstructions?: string;
}

export interface WalletAction {
  txid: string;
  satoshis: number;
  status: string;
  isOutgoing: boolean;
  description: string;
  labels?: string[];
  version: number;
  lockTime: number;
  outputs?: WalletActionOutput[];
  /**
   * ISO timestamp from the matching submission's assessmentDate, joined by
   * outpoint on the backend. Null for actions with no matching submission
   * (e.g. top-ups, hard-deleted submissions).
   */
  timestamp?: string | null;
}

export interface WalletActivity {
  totalActions: number;
  actions: WalletAction[];
}

export interface PendingSubmission {
  id: string;
  userId: string | null;
  assessmentDate: string | null;
  brixValue: string;
  contributorName: string | null;
  crop: { name: string };
  venue: { name: string; city: string | null } | null;
}

export interface PendingSubmissions {
  total: number;
  rows: PendingSubmission[];
}

export const fetchWalletBalance = () =>
  apiGet<WalletBalance>('/api/admin/wallet/balance');

export const fetchWalletInfo = () =>
  apiGet<WalletInfo>('/api/admin/wallet/info');

export const fetchWalletActivity = (params: { label?: string; limit?: number; offset?: number } = {}) => {
  const qs = new URLSearchParams();
  if (params.label) qs.set('label', params.label);
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.offset) qs.set('offset', String(params.offset));
  const suffix = qs.toString() ? `?${qs}` : '';
  return apiGet<WalletActivity>(`/api/admin/wallet/activity${suffix}`);
};

export const fetchPendingSubmissions = (params: { limit?: number; offset?: number } = {}) => {
  const qs = new URLSearchParams();
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.offset) qs.set('offset', String(params.offset));
  const suffix = qs.toString() ? `?${qs}` : '';
  return apiGet<PendingSubmissions>(`/api/admin/wallet/pending${suffix}`);
};

export interface TopupInternalizeArgs {
  tx: number[];
  outputIndex: number;
  derivationPrefix: string;
  derivationSuffix: string;
  senderIdentityKey: string;
  description?: string;
}

export interface TopupInternalizeResult {
  accepted: boolean;
}

export const topupInternalize = (args: TopupInternalizeArgs) =>
  apiPost<TopupInternalizeResult>('/api/admin/wallet/topup/internalize', args);

export interface TopupSweepResult {
  address: string;
  swept: number;
  satoshis: number;
  skipped: number;
  failed?: number;
  message?: string;
}

export const topupSweep = (date?: string) => {
  const qs = date ? `?date=${encodeURIComponent(date)}` : '';
  return apiPost<TopupSweepResult>(`/api/admin/wallet/topup/sweep${qs}`, {});
};

export function whatsOnChainTxUrl(chain: 'main' | 'test', txid: string): string {
  const sub = chain === 'main' ? '' : 'test.';
  return `https://${sub}whatsonchain.com/tx/${txid}`;
}

export function formatSatoshis(sats: number): string {
  return new Intl.NumberFormat('en-US').format(sats);
}

export function satoshisToBsv(sats: number): string {
  return (sats / 100_000_000).toFixed(8);
}
