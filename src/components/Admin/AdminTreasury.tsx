import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Wallet,
  AlertTriangle,
  RefreshCw,
  Copy,
  ExternalLink,
  ArrowUpCircle,
  Clock,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  fetchWalletBalance,
  fetchWalletInfo,
  fetchWalletActivity,
  fetchPendingSubmissions,
  whatsOnChainTxUrl,
  formatSatoshis,
  satoshisToBsv,
} from '@/lib/adminWalletApi';

function shortHex(hex: string, head = 8, tail = 8): string {
  if (hex.length <= head + tail + 1) return hex;
  return `${hex.slice(0, head)}…${hex.slice(-tail)}`;
}

export default function AdminTreasury() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [labelFilter, setLabelFilter] = useState<string>('');

  const balanceQ = useQuery({
    queryKey: ['admin-wallet', 'balance'],
    queryFn: fetchWalletBalance,
    staleTime: 30_000,
  });
  const infoQ = useQuery({
    queryKey: ['admin-wallet', 'info'],
    queryFn: fetchWalletInfo,
    staleTime: 60 * 60 * 1000,
  });
  const activityQ = useQuery({
    queryKey: ['admin-wallet', 'activity', labelFilter || 'all'],
    queryFn: () =>
      fetchWalletActivity({
        label: labelFilter || undefined,
        limit: 25,
      }),
    staleTime: 30_000,
  });
  const pendingQ = useQuery({
    queryKey: ['admin-wallet', 'pending'],
    queryFn: () => fetchPendingSubmissions({ limit: 25 }),
    staleTime: 30_000,
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-wallet'] });
  };

  const copy = (value: string, label: string) => {
    navigator.clipboard.writeText(value).then(
      () => toast({ title: `${label} copied` }),
      () => toast({ title: `Failed to copy ${label}`, variant: 'destructive' }),
    );
  };

  const chain = infoQ.data?.chain ?? 'main';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Treasury Wallet</h2>
          <p className="text-sm text-muted-foreground">
            Balance, identity and recent on-chain activity for the wallet that anchors submissions.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={balanceQ.isFetching || activityQ.isFetching}
          className="flex items-center gap-2"
        >
          <RefreshCw
            className={`w-4 h-4 ${
              balanceQ.isFetching || activityQ.isFetching ? 'animate-spin' : ''
            }`}
          />
          Refresh
        </Button>
      </div>

      {/* ── Balance + Info row ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Balance</CardTitle>
            <Wallet className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {balanceQ.isLoading ? (
              <div className="text-3xl font-bold">—</div>
            ) : balanceQ.error ? (
              <p className="text-sm text-destructive">
                {(balanceQ.error as any)?.message ?? 'Failed to load balance'}
              </p>
            ) : balanceQ.data ? (
              <>
                <div className="text-3xl font-bold tabular-nums">
                  {formatSatoshis(balanceQ.data.satoshis)}{' '}
                  <span className="text-base font-medium text-muted-foreground">sats</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  ≈ {satoshisToBsv(balanceQ.data.satoshis)} BSV
                </p>
                {balanceQ.data.lowBalanceWarning && (
                  <div className="flex items-center gap-2 mt-3 p-2 rounded-md bg-destructive/10 text-destructive text-xs">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>
                      Below {formatSatoshis(balanceQ.data.threshold)} sats — top up to keep
                      anchoring submissions.
                    </span>
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  disabled
                  className="mt-4 w-full flex items-center gap-2"
                  title="Treasury top-up flow not implemented yet"
                >
                  <ArrowUpCircle className="w-4 h-4" />
                  Top up balance (coming soon)
                </Button>
              </>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Wallet Identity</CardTitle>
            <Badge variant={chain === 'main' ? 'default' : 'secondary'} className="text-xs">
              {chain === 'main' ? 'mainnet' : 'testnet'}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {infoQ.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : infoQ.error ? (
              <p className="text-sm text-destructive">
                {(infoQ.error as any)?.message ?? 'Failed to load wallet info'}
              </p>
            ) : infoQ.data ? (
              <>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Top-up Address
                    </p>
                    <p className="text-[10px] text-muted-foreground" title={`KeyID: ${infoQ.data.addressKeyID}`}>
                      rotates {new Date(infoQ.data.addressRotatesAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono break-all flex-1">{infoQ.data.address}</code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => copy(infoQ.data!.address, 'Address')}
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Derived fresh each UTC day. Funds sent to older addresses remain spendable.
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                    Identity Public Key
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono flex-1">
                      {shortHex(infoQ.data.identityKey, 12, 12)}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => copy(infoQ.data!.identityKey, 'Identity key')}
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground pt-1 border-t">
                  Storage: <code className="font-mono">{infoQ.data.storageUrl}</code>
                </p>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* ── Pending submissions ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-base">Pending Anchors</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Submission rows whose on-chain anchor never completed (outpoint is NULL).
            </p>
          </div>
          <Clock className="w-4 h-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {pendingQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : pendingQ.error ? (
            <p className="text-sm text-destructive">
              {(pendingQ.error as any)?.message ?? 'Failed to load pending submissions'}
            </p>
          ) : pendingQ.data?.total === 0 ? (
            <p className="text-sm text-muted-foreground">No pending anchors — all submissions are on chain.</p>
          ) : pendingQ.data ? (
            <>
              <p className="text-xs text-muted-foreground mb-3">
                Showing {pendingQ.data.rows.length} of {pendingQ.data.total}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b">
                      <th className="py-2 pr-3">Submitted</th>
                      <th className="py-2 pr-3">Crop</th>
                      <th className="py-2 pr-3">BRIX</th>
                      <th className="py-2 pr-3">Contributor</th>
                      <th className="py-2 pr-3">Venue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingQ.data.rows.map((r) => (
                      <tr key={r.id} className="border-b last:border-0">
                        <td className="py-2 pr-3 text-xs text-muted-foreground tabular-nums">
                          {r.assessmentDate ? new Date(r.assessmentDate).toLocaleString() : '—'}
                        </td>
                        <td className="py-2 pr-3">{r.crop.name}</td>
                        <td className="py-2 pr-3 tabular-nums">{r.brixValue}</td>
                        <td className="py-2 pr-3">{r.contributorName ?? '—'}</td>
                        <td className="py-2 pr-3">
                          {r.venue ? `${r.venue.name}${r.venue.city ? ` · ${r.venue.city}` : ''}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      {/* ── Activity ────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Activity</CardTitle>
            <div className="flex gap-1">
              {(['', 'brixit-submission', 'brixit-edit', 'brixit-delete'] as const).map((l) => (
                <Button
                  key={l || 'all'}
                  size="sm"
                  variant={labelFilter === l ? 'default' : 'outline'}
                  onClick={() => setLabelFilter(l)}
                  className="text-xs h-7"
                >
                  {l || 'all'}
                </Button>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Last 25 wallet actions, filtered by label. Source: <code>wallet.listActions</code>.
          </p>
        </CardHeader>
        <CardContent>
          {activityQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : activityQ.error ? (
            <p className="text-sm text-destructive">
              {(activityQ.error as any)?.message ?? 'Failed to load activity'}
            </p>
          ) : activityQ.data?.actions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No actions found for this filter.</p>
          ) : activityQ.data ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b">
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Labels</th>
                    <th className="py-2 pr-3">Description</th>
                    <th className="py-2 pr-3">Sats</th>
                    <th className="py-2 pr-3">TXID</th>
                  </tr>
                </thead>
                <tbody>
                  {activityQ.data.actions.map((a) => (
                    <tr key={a.txid} className="border-b last:border-0">
                      <td className="py-2 pr-3">
                        <Badge variant="secondary" className="text-xs">{a.status}</Badge>
                      </td>
                      <td className="py-2 pr-3">
                        <div className="flex flex-wrap gap-1">
                          {(a.labels ?? []).map((l) => (
                            <Badge key={l} variant="outline" className="text-xs font-mono">
                              {l}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="py-2 pr-3 text-xs">{a.description}</td>
                      <td className={`py-2 pr-3 tabular-nums text-xs ${a.satoshis < 0 ? 'text-destructive' : ''}`}>
                        {a.satoshis > 0 ? '+' : ''}
                        {formatSatoshis(a.satoshis)}
                      </td>
                      <td className="py-2 pr-3">
                        <a
                          href={whatsOnChainTxUrl(chain, a.txid)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-mono underline-offset-2 hover:underline"
                        >
                          {shortHex(a.txid, 6, 6)}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
