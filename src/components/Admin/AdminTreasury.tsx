import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Wallet,
  AlertTriangle,
  RefreshCw,
  Copy,
  ExternalLink,
  ArrowUpCircle,
  Clock,
  ChevronDown,
  Download,
  Loader2,
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { useWallet } from '@/contexts/WalletContext';
import { Random, Utils } from '@bsv/sdk';
import { buildTopupOutput } from '@/lib/buildTopupOutput';
import {
  fetchWalletBalance,
  fetchWalletInfo,
  fetchWalletActivity,
  fetchPendingSubmissions,
  topupInternalize,
  topupSweep,
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
  const { userWallet } = useWallet();
  const [labelFilter, setLabelFilter] = useState<string>('');
  const [topupModalOpen, setTopupModalOpen] = useState(false);
  const [topupAmount, setTopupAmount] = useState('');
  const [topupBusy, setTopupBusy] = useState(false);
  const [sweepBusy, setSweepBusy] = useState(false);
  const [sweepPopoverOpen, setSweepPopoverOpen] = useState(false);
  const [sweepDate, setSweepDate] = useState('');

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

  const handleLocalWalletTopup = async () => {
    if (!userWallet) {
      toast({ title: 'No local wallet detected', description: 'Connect a wallet first.', variant: 'destructive' });
      return;
    }
    if (!infoQ.data?.identityKey) {
      toast({ title: 'Treasury info not loaded', variant: 'destructive' });
      return;
    }
    const sats = Math.round(Number(topupAmount));
    if (!Number.isFinite(sats) || sats <= 0) {
      toast({ title: 'Enter a positive amount in satoshis', variant: 'destructive' });
      return;
    }

    setTopupBusy(true);
    try {
      const payee = infoQ.data.identityKey;
      // Fresh per-tx remittance — unrelated to the daily rotating address keyID.
      const derivationPrefix = Utils.toBase64(Random(10));
      const derivationSuffix = Utils.toBase64(Random(10));
      const network = infoQ.data.chain === 'main' ? 'mainnet' : 'testnet';

      const { publicKey: payer } = await userWallet.getPublicKey({ identityKey: true });
      const { lockingScript, customInstructions } = await buildTopupOutput({
        wallet: userWallet,
        payee,
        network,
        derivationPrefix,
        derivationSuffix,
      });

      const created = await userWallet.createAction({
        description: 'Fund BRIXit treasury',
        outputs: [
          {
            lockingScript,
            customInstructions,
            satoshis: sats,
            outputDescription: 'BRIXit treasury top-up',
          },
        ],
        options: { 
          randomizeOutputs: false,
          acceptDelayedBroadcast: false,
        },
      });

      if (!created.tx) {
        throw new Error('Local wallet did not return a transaction (signing may have been cancelled).');
      }

      const result = await topupInternalize({
        tx: Array.from(created.tx),
        outputIndex: 0,
        derivationPrefix,
        derivationSuffix,
        senderIdentityKey: payer,
        description: `Local-wallet top-up of ${formatSatoshis(sats)} sats`,
      });

      if (!result.accepted) {
        throw new Error('Treasury wallet rejected the payment.');
      }

      toast({
        title: 'Top-up sent',
        description: `Sent ${formatSatoshis(sats)} sats. ${created.txid ? `Txid: ${created.txid.slice(0, 12)}…` : ''}`,
      });
      setTopupModalOpen(false);
      setTopupAmount('');
      queryClient.invalidateQueries({ queryKey: ['admin-wallet'] });
    } catch (err: any) {
      console.error('[topup] local wallet failed:', err);
      toast({ title: 'Top-up failed', description: err?.message || 'Unknown error', variant: 'destructive' });
    } finally {
      setTopupBusy(false);
    }
  };

  const handleSweepAddress = async (date?: string) => {
    setSweepBusy(true);
    try {
      const result = await topupSweep(date);
      const dateSuffix = date ? ` (${date})` : '';
      if (result.swept > 0) {
        toast({
          title: `Sweep complete${dateSuffix}`,
          description: `Pulled ${formatSatoshis(result.satoshis)} sats from ${result.swept} output${result.swept === 1 ? '' : 's'}.`,
        });
      } else {
        toast({
          title: `No new funds${dateSuffix}`,
          description: result.message || `Address checked — ${result.skipped} already internalized.`,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['admin-wallet'] });
      return true;
    } catch (err: any) {
      console.error('[topup] sweep failed:', err);
      toast({ title: 'Sweep failed', description: err?.message || 'Unknown error', variant: 'destructive' });
      return false;
    } finally {
      setSweepBusy(false);
    }
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTopupModalOpen(true)}
                    disabled={!userWallet || !infoQ.data}
                    className="flex items-center gap-2"
                    title={!userWallet ? 'Connect a local wallet first' : 'Send funds from your connected wallet'}
                  >
                    <ArrowUpCircle className="w-4 h-4" />
                    From local wallet
                  </Button>
                  <div className="flex items-stretch gap-px">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSweepAddress()}
                      disabled={sweepBusy || !infoQ.data}
                      className="flex-1 flex items-center gap-2 rounded-r-none"
                      title="Pull any external payments sent to today's address into the treasury"
                    >
                      {sweepBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      Sweep address
                    </Button>
                    <Popover open={sweepPopoverOpen} onOpenChange={setSweepPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={sweepBusy || !infoQ.data}
                          className="px-2 rounded-l-none border-l-0"
                          aria-label="Sweep a past date's address"
                          title="Sweep a past day's address (for recovery)"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-64 space-y-3">
                        <div>
                          <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-mid)' }}>
                            Sweep past date
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Funds sent to an older day's rotating address. UTC dates.
                          </p>
                        </div>
                        <Input
                          type="date"
                          value={sweepDate}
                          onChange={(e) => setSweepDate(e.target.value)}
                          max={new Date().toISOString().slice(0, 10)}
                          className="text-sm"
                        />
                        <Button
                          size="sm"
                          className="w-full"
                          disabled={sweepBusy || !sweepDate}
                          onClick={async () => {
                            const ok = await handleSweepAddress(sweepDate);
                            if (ok) {
                              setSweepPopoverOpen(false);
                              setSweepDate('');
                            }
                          }}
                        >
                          {sweepBusy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                          Sweep this date
                        </Button>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
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
                    <p className="text-[10px] text-muted-foreground">
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

                <Collapsible
                  className="rounded-xl border overflow-hidden"
                  style={{ borderColor: 'var(--blue-pale)' }}
                >
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="group flex w-full items-center justify-between px-3 py-2 text-xs font-semibold hover:bg-blue-mist transition-colors"
                      style={{ color: 'var(--text-mid)' }}
                    >
                      <span>Derivation info</span>
                      <ChevronDown
                        className="w-4 h-4 transition-transform duration-200 group-data-[state=open]:rotate-180"
                        style={{ color: 'var(--text-muted)' }}
                      />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent
                    className="border-t px-3 py-3 space-y-2.5"
                    style={{ borderColor: 'var(--blue-pale)' }}
                  >
                    <p className="text-[10px] text-muted-foreground italic">
                      Public parameters. Not secrets — anyone with these can derive the address, but spending still requires the server wallet's master key. Use only if the automated top-up sweep fails and funds need manual recovery.
                    </p>
                    {([
                      ['Date (UTC)', infoQ.data.addressDate],
                      ['Protocol ID', JSON.stringify(infoQ.data.protocolID)],
                      ['Counterparty', infoQ.data.counterparty],
                      ['Key ID', infoQ.data.addressKeyID],
                      ['Derivation prefix', infoQ.data.derivationPrefix],
                      ['Derivation suffix', infoQ.data.derivationSuffix],
                    ] as const).map(([label, value]) => (
                      <div key={label}>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">
                          {label}
                        </p>
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono break-all flex-1" style={{ color: 'var(--text-dark)' }}>
                            {value}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            onClick={() => copy(value, label)}
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
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
              {(['', 'brixit-submission', 'brixit-edit', 'brixit-delete', 'brixit-topup'] as const).map((l) => (
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
                      <td className={`py-2 pr-3 tabular-nums text-xs ${a.satoshis < 0 ? 'text-destructive' : a.satoshis > 0 ? 'text-green-mid' : ''}`}>
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

      {/* ── Local-wallet top-up modal ────────────────────────────────────────── */}
      <Dialog open={topupModalOpen} onOpenChange={(open) => { if (!topupBusy) setTopupModalOpen(open); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Top up from local wallet</DialogTitle>
            <DialogDescription>
              Sends funds from your connected wallet directly into the treasury wallet using a BRC-29 wallet payment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="topup-amount" className="text-xs uppercase tracking-wide text-muted-foreground">
                Amount (satoshis)
              </Label>
              <Input
                id="topup-amount"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                value={topupAmount}
                onChange={(e) => setTopupAmount(e.target.value)}
                placeholder="e.g. 10000"
                disabled={topupBusy}
                className="mt-1"
              />
              {topupAmount && Number(topupAmount) > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  ≈ {satoshisToBsv(Number(topupAmount))} BSV
                </p>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Your wallet will prompt you to approve the transaction. The treasury internalizes it server-side once you confirm.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTopupModalOpen(false)} disabled={topupBusy}>
              Cancel
            </Button>
            <Button onClick={handleLocalWalletTopup} disabled={topupBusy || !topupAmount || Number(topupAmount) <= 0}>
              {topupBusy ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending…</>
              ) : (
                <>Send</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
