import { apiGet } from '@/lib/api';

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
  /** Base64 prefix — pass through to `internalizeAction({ paymentRemittance })` on top-up. */
  derivationPrefix: string;
  /** Base64 suffix — pass through to `internalizeAction({ paymentRemittance })` on top-up. */
  derivationSuffix: string;
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
