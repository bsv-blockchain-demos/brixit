import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  Eye,
  Calendar,
  MapPin,
  User,
  Stamp,
  Fingerprint,
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { useWallet } from '@/contexts/WalletContext';
import { Random, Utils } from '@bsv/sdk';
import { buildTopupOutput } from '@/lib/buildTopupOutput';
import { titleCase } from '@/lib/titleCase';
import { scoreBrix } from '@/lib/getBrixColor';
import { ScoreGauge } from '@/components/common/ScoreGauge';
import { formatVenueLocation } from '@/lib/formatAddress';
import { fetchSubmissionById } from '@/lib/fetchSubmissions';
import { BlockchainBadge } from '@/components/common/StatusBadges';
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

const fmtDate = (v: string | number | Date | null | undefined) =>
  v ? new Date(v).toLocaleDateString() : '-';

// Small uppercase section label, optionally with a leading icon.
function Eyebrow({ icon: Icon, children, className = '' }: {
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-text-muted-brown ${className}`}>
      {Icon ? <Icon className="w-3.5 h-3.5" /> : null}
      {children}
    </span>
  );
}

// Mono value in a soft field with a copy affordance.
function CopyField({ value, display, onCopy }: { value: string; display?: string; onCopy: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-hairline bg-surface-canvas px-3 py-2">
      <code className="flex-1 min-w-0 break-all font-mono text-xs text-text-dark">{display ?? value}</code>
      <button
        onClick={onCopy}
        aria-label="Copy"
        className="shrink-0 inline-flex items-center justify-center h-6 w-6 rounded text-text-mid hover:text-text-dark hover:bg-card"
      >
        <Copy className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// Read-only submission viewer for a pending-anchor row.
function PendingViewModal({ id, onClose, onCopy }: { id: string; onClose: () => void; onCopy: (v: string, l: string) => void }) {
  const { data: dp, isLoading } = useQuery({
    queryKey: ['submission-detail', id],
    queryFn: () => fetchSubmissionById(id),
    staleTime: 30_000,
  });

  const thresholds = dp && dp.poorBrix != null && dp.excellentBrix != null
    ? { poor: dp.poorBrix, average: 0, good: 0, excellent: dp.excellentBrix }
    : undefined;
  const score = dp ? scoreBrix(dp.brixLevel, thresholds) : null;
  const brand = dp ? (dp.brandLabel ?? dp.brandName) : null;
  const loc = dp ? formatVenueLocation(dp.streetAddress, dp.city, dp.state) : '';
  const place = dp ? [dp.placeName, loc].filter(Boolean).join(' · ') || '-' : '-';

  const Row = ({ icon: Icon, label, children }: { icon?: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode }) => (
    <div className="flex gap-3">
      <span className="w-20 shrink-0 text-text-muted-brown inline-flex items-center gap-1.5">
        {Icon ? <Icon className="w-3.5 h-3.5" /> : null}{label}
      </span>
      <span className="text-text-dark min-w-0">{children}</span>
    </div>
  );

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-text-dark">
            {dp ? (titleCase(dp.cropLabel ?? dp.cropType) || 'Submission') : 'Submission'}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-text-mid">Loading…</p>
        ) : !dp || !score ? (
          <p className="text-sm text-destructive">Couldn't load this submission.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <ScoreGauge normalizedScore={score.normalized} />
              <div>
                <div className="font-semibold text-base text-text-dark">{score.quality}</div>
                <div className="text-sm text-text-mid">{dp.brixLevel} BRIX</div>
              </div>
            </div>

            <div className="space-y-2 text-sm border-t border-hairline pt-3">
              {brand && <Row label="Brand">{brand}</Row>}
              <Row icon={MapPin} label="Place">{place}</Row>
              <Row icon={Calendar} label="Date">{dp.submittedAt ? new Date(dp.submittedAt).toLocaleDateString() : '-'}</Row>
              <Row icon={User} label="By">{dp.submittedBy || '-'}</Row>
              <Row icon={Stamp} label="Blockchain">
                <BlockchainBadge secured={!!dp.outpoint} />
              </Row>
              <Row label="ID">
                <button
                  onClick={() => onCopy(dp.id, 'Submission ID')}
                  className="inline-flex items-center gap-1 font-mono text-xs text-text-muted-brown hover:text-text-mid break-all text-left"
                >
                  {dp.id}
                  <Copy className="w-3 h-3 shrink-0" />
                </button>
              </Row>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

const ACTIVITY_FILTERS = ['', 'brixit-submission', 'brixit-edit', 'brixit-delete', 'brixit-topup'] as const;

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
  const [viewId, setViewId] = useState<string | null>(null);

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
          description: result.message || `Address checked. ${result.skipped} already internalized.`,
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
  const networkPill = (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full bg-green-pale text-green-mid">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full rounded-full bg-green-mid opacity-75 animate-ping motion-reduce:hidden" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-green-mid" />
      </span>
      {chain === 'main' ? 'mainnet' : 'testnet'}
    </span>
  );

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-display font-bold text-text-dark">Treasury Wallet</h2>
          <p className="text-sm text-text-mid">
            Balance, identity and on-chain activity for the wallet that anchors submissions.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={balanceQ.isFetching || activityQ.isFetching}
          aria-label="Refresh treasury"
          className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-text-mid hover:text-text-dark hover:bg-surface-canvas disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${balanceQ.isFetching || activityQ.isFetching ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* ── Balance + Identity ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Balance */}
        <div className="bg-card border border-hairline rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between">
            <Eyebrow icon={Wallet}>Balance</Eyebrow>
            <span className="lg:hidden">{networkPill}</span>
          </div>

          {balanceQ.isLoading ? (
            <div className="mt-2 text-4xl font-display font-bold text-text-muted-brown">-</div>
          ) : balanceQ.error ? (
            <p className="mt-2 text-sm text-destructive">
              {(balanceQ.error as any)?.message ?? 'Failed to load balance'}
            </p>
          ) : balanceQ.data ? (
            <>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-display font-bold text-4xl text-text-dark tabular-nums leading-none">
                  {formatSatoshis(balanceQ.data.satoshis)}
                </span>
                <span className="text-base font-medium text-text-mid">sats</span>
              </div>
              <p className="text-xs text-text-muted-brown mt-1.5">≈ {satoshisToBsv(balanceQ.data.satoshis)} BSV</p>

              {balanceQ.data.lowBalanceWarning && (
                <div className="flex items-start gap-2 mt-4 rounded-lg bg-score-average-bg px-3 py-2.5 text-xs text-text-dark">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-score-average mt-0.5" />
                  <span>
                    Below {formatSatoshis(balanceQ.data.threshold)} sats. Top up to keep timestamping submissions on the blockchain.
                  </span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2 mt-4">
                <Button
                  onClick={() => setTopupModalOpen(true)}
                  disabled={!userWallet || !infoQ.data}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-action-primary hover:bg-action-primary-hover text-primary-foreground font-semibold"
                  title={!userWallet ? 'Connect a local wallet first' : 'Send funds from your connected wallet'}
                >
                  <ArrowUpCircle className="w-4 h-4" />
                  Top up from local wallet
                </Button>
                <div className="flex items-stretch">
                  <Button
                    variant="outline"
                    onClick={() => handleSweepAddress()}
                    disabled={sweepBusy || !infoQ.data}
                    className="flex items-center gap-2 rounded-lg rounded-r-none border-hairline text-text-dark"
                    title="Pull any external payments sent to today's address into the treasury"
                  >
                    {sweepBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    Sweep
                  </Button>
                  <Popover open={sweepPopoverOpen} onOpenChange={setSweepPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        disabled={sweepBusy || !infoQ.data}
                        className="px-2 rounded-lg rounded-l-none border-l-0 border-hairline text-text-dark"
                        aria-label="Sweep a past date's address"
                        title="Sweep a past day's address (for recovery)"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-64 space-y-3">
                      <div>
                        <p className="text-xs font-semibold mb-1 text-text-mid">Sweep past date</p>
                        <p className="text-2xs text-text-muted-brown">
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
        </div>

        {/* Identity */}
        <div className="bg-card border border-hairline rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between">
            <Eyebrow icon={Fingerprint}>Wallet Identity</Eyebrow>
            <span className="hidden lg:inline-flex">{networkPill}</span>
          </div>

          {infoQ.isLoading ? (
            <p className="mt-3 text-sm text-text-mid">Loading…</p>
          ) : infoQ.error ? (
            <p className="mt-3 text-sm text-destructive">
              {(infoQ.error as any)?.message ?? 'Failed to load wallet info'}
            </p>
          ) : infoQ.data ? (
            <div className="mt-4 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Eyebrow>Top-up Address</Eyebrow>
                  <span className="text-2xs text-text-muted-brown">rotates {fmtDate(infoQ.data.addressRotatesAt)}</span>
                </div>
                <CopyField value={infoQ.data.address} onCopy={() => copy(infoQ.data!.address, 'Address')} />
                <p className="text-2xs text-text-muted-brown mt-1.5">
                  Derived fresh each UTC day. Funds sent to older addresses remain spendable.
                </p>
              </div>

              <div>
                <Eyebrow className="mb-1.5">Identity Public Key</Eyebrow>
                <CopyField
                  value={infoQ.data.identityKey}
                  display={shortHex(infoQ.data.identityKey, 12, 12)}
                  onCopy={() => copy(infoQ.data!.identityKey, 'Identity key')}
                />
              </div>

              <Collapsible>
                <div className="flex items-center justify-between gap-2 border-t border-hairline pt-3">
                  <p className="text-xs text-text-muted-brown min-w-0 truncate">
                    Storage: <code className="font-mono">{infoQ.data.storageUrl}</code>
                  </p>
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="group inline-flex items-center gap-1 text-xs font-medium text-green-fresh hover:text-green-mid shrink-0"
                    >
                      Derivation info
                      <ChevronDown className="w-3.5 h-3.5 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                    </button>
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent className="pt-3 space-y-2.5">
                  <p className="text-2xs text-text-muted-brown italic">
                    Public parameters, not secrets. Anyone with these can derive the address, but spending still requires the
                    server wallet's master key. Use only if the automated top-up sweep fails and funds need manual recovery.
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
                      <Eyebrow className="mb-1">{label}</Eyebrow>
                      <CopyField value={String(value)} onCopy={() => copy(String(value), label)} />
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            </div>
          ) : null}
        </div>
      </div>

      {/* Pending blockchain records */}
      <div className="bg-card border border-hairline rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-start justify-between gap-3 p-5 pb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-display font-bold text-base text-text-dark">Pending Blockchain Records</h3>
              {pendingQ.data && pendingQ.data.total > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-badge-neutral-bg text-badge-neutral-text">
                  <Stamp className="w-3 h-3" /> {pendingQ.data.total} pending
                </span>
              )}
            </div>
            <p className="text-sm text-text-mid mt-0.5">Submissions not yet timestamped on the blockchain</p>
          </div>
          {pendingQ.data && pendingQ.data.total > 0 && (
            <p className="text-xs text-text-muted-brown shrink-0 whitespace-nowrap">
              Showing {pendingQ.data.rows.length} of {pendingQ.data.total}
            </p>
          )}
        </div>

        {pendingQ.isLoading ? (
          <p className="px-5 pb-5 text-sm text-text-mid">Loading…</p>
        ) : pendingQ.error ? (
          <p className="px-5 pb-5 text-sm text-destructive">
            {(pendingQ.error as any)?.message ?? 'Failed to load pending submissions'}
          </p>
        ) : pendingQ.data?.total === 0 ? (
          <p className="px-5 pb-5 text-sm text-text-mid">No pending records. Every submission is timestamped on the blockchain.</p>
        ) : pendingQ.data ? (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-medium uppercase tracking-wider text-text-muted-brown border-y border-hairline bg-table-header">
                    <th className="py-3 px-5">Submitted</th>
                    <th className="py-3 pr-3">Crop</th>
                    <th className="py-3 pr-3">BRIX</th>
                    <th className="py-3 pr-3">Contributor</th>
                    <th className="py-3 pr-3">Venue</th>
                    <th className="py-3 pr-5 text-right">View</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingQ.data.rows.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => setViewId(r.id)}
                      className="border-b border-hairline last:border-0 cursor-pointer hover:bg-surface-canvas transition-colors"
                    >
                      <td className="py-3 px-5 text-text-mid tabular-nums whitespace-nowrap">{fmtDate(r.assessmentDate)}</td>
                      <td className="py-3 pr-3 font-semibold text-text-dark">{titleCase(r.crop.name.replace(/_/g, ' '))}</td>
                      <td className="py-3 pr-3 tabular-nums text-text-dark">{r.brixValue}</td>
                      <td className="py-3 pr-3 text-text-mid">{r.contributorName ?? '-'}</td>
                      <td className="py-3 pr-3 text-text-mid">
                        {r.venue ? `${r.venue.name}${r.venue.city ? ` · ${r.venue.city}` : ''}` : '-'}
                      </td>
                      <td className="py-3 pr-5 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); setViewId(r.id); }}
                          aria-label="View submission"
                          className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-text-mid hover:text-text-dark hover:bg-card"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-hairline border-t border-hairline">
              {pendingQ.data.rows.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setViewId(r.id)}
                  className="w-full flex items-center justify-between gap-3 px-5 py-3 text-left hover:bg-surface-canvas transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="font-semibold text-text-dark">{titleCase(r.crop.name.replace(/_/g, ' '))}</span>
                      <span className="text-xs text-text-mid tabular-nums">{r.brixValue} BRIX</span>
                    </div>
                    <p className="text-xs text-text-muted-brown mt-0.5 truncate">
                      {r.venue ? `${r.venue.name}${r.venue.city ? ` · ${r.venue.city}` : ''}` : '-'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <p className="text-sm text-text-mid truncate max-w-[7rem]">{r.contributorName ?? '-'}</p>
                      <p className="text-2xs text-text-muted-brown tabular-nums mt-0.5">{fmtDate(r.assessmentDate)}</p>
                    </div>
                    <Eye className="w-4 h-4 text-text-muted-brown shrink-0" />
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : null}
      </div>

      {/* ── Recent Activity ─────────────────────────────────────────────────── */}
      <div className="bg-card border border-hairline rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 pb-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display font-bold text-base text-text-dark">Recent Activity</h3>
            <div className="flex flex-wrap gap-1">
              {ACTIVITY_FILTERS.map((l) => (
                <button
                  key={l || 'all'}
                  onClick={() => setLabelFilter(l)}
                  className={`text-xs px-2.5 h-7 rounded-lg border capitalize ${
                    labelFilter === l
                      ? 'bg-select-bg text-select-fg border-select-border'
                      : 'border-hairline text-text-mid hover:bg-surface-canvas'
                  }`}
                >
                  {l ? l.replace('brixit-', '') : 'all'}
                </button>
              ))}
            </div>
          </div>
          <p className="text-sm text-text-mid">Last 25 wallet actions, newest first, filtered by label.</p>
        </div>

        {activityQ.isLoading ? (
          <p className="px-5 pb-5 text-sm text-text-mid">Loading…</p>
        ) : activityQ.error ? (
          <p className="px-5 pb-5 text-sm text-destructive">
            {(activityQ.error as any)?.message ?? 'Failed to load activity'}
          </p>
        ) : activityQ.data?.actions.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-text-mid">No actions found for this filter.</p>
        ) : activityQ.data ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium uppercase tracking-wider text-text-muted-brown border-y border-hairline bg-table-header">
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 pr-3">Labels</th>
                  <th className="py-3 pr-3">Description</th>
                  <th className="py-3 pr-3">Sats</th>
                  <th className="py-3 pr-5">TXID</th>
                </tr>
              </thead>
              <tbody>
                {/* Render in backend order (wallet chronology, newest-first); don't re-sort. */}
                {activityQ.data.actions
                  .map((a) => (
                  <tr key={a.txid} className="border-b border-hairline last:border-0">
                    <td className="py-3 px-5">
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-surface-canvas text-text-mid border border-hairline capitalize">
                        {a.status}
                      </span>
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex flex-wrap gap-1">
                        {(a.labels ?? []).map((l) => (
                          <span key={l} className="inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-mono text-text-muted-brown border border-hairline">
                            {l}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 pr-3 text-text-mid">{a.description}</td>
                    <td className={`py-3 pr-3 tabular-nums ${a.satoshis < 0 ? 'text-destructive' : a.satoshis > 0 ? 'text-score-good' : 'text-text-mid'}`}>
                      {a.satoshis > 0 ? '+' : ''}
                      {formatSatoshis(a.satoshis)}
                    </td>
                    <td className="py-3 pr-5">
                      <a
                        href={whatsOnChainTxUrl(chain, a.txid)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-mono text-green-fresh hover:text-green-mid underline-offset-2 hover:underline"
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
      </div>

      {/* ── Local-wallet top-up modal ────────────────────────────────────────── */}
      <Dialog open={topupModalOpen} onOpenChange={(open) => { if (!topupBusy) setTopupModalOpen(open); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-text-dark">Top up from local wallet</DialogTitle>
            <DialogDescription>
              Sends funds from your connected wallet directly into the treasury wallet using a BRC-29 wallet payment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="topup-amount" className="text-xs uppercase tracking-wide text-text-muted-brown">
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
                <p className="text-xs text-text-muted-brown mt-1">≈ {satoshisToBsv(Number(topupAmount))} BSV</p>
              )}
            </div>
            <p className="text-xs text-text-mid">
              Your wallet will prompt you to approve the transaction. The treasury internalizes it server-side once you confirm.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTopupModalOpen(false)} disabled={topupBusy}>
              Cancel
            </Button>
            <Button
              onClick={handleLocalWalletTopup}
              disabled={topupBusy || !topupAmount || Number(topupAmount) <= 0}
              className="bg-action-primary hover:bg-action-primary-hover text-primary-foreground"
            >
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
