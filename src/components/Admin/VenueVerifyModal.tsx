import { useEffect, useState } from 'react';
import { Loader2, ShieldCheck, GitMerge } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  fetchNearbyUnverifiedVenues,
  verifyVenueWithMerge,
  type NearbyUnverifiedVenue,
} from '@/lib/adminApi';
import { formatFullLocation } from '@/lib/formatAddress';

interface Props {
  venueId: string;
  venueName: string;
  /** True when the venue is already verified — skip the verify step, only offer merge */
  mergeOnly?: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export default function VenueVerifyModal({ venueId, venueName, mergeOnly = false, onClose, onComplete }: Props) {
  const { toast } = useToast();
  const [nearby, setNearby] = useState<NearbyUnverifiedVenue[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchNearbyUnverifiedVenues(venueId)
      .then((data) => {
        setNearby(data);
        // Pre-select all by default
        setSelected(new Set(data.map(v => v.id)));
      })
      .catch(() => setNearby([]));
  }, [venueId]);

  const toggle = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const totalSelectedSubs = nearby
    ?.filter(v => selected.has(v.id))
    .reduce((sum, v) => sum + v.submission_count, 0) ?? 0;

  const handleVerify = async (merge: boolean) => {
    setSaving(true);
    try {
      const mergeIds = merge ? [...selected] : [];
      const res = await verifyVenueWithMerge(venueId, mergeIds);
      if (res.success) {
        toast({
          title: mergeOnly ? 'Venues merged' : 'Venue verified',
          description: mergeIds.length
            ? `${mergeIds.length} venue${mergeIds.length !== 1 ? 's' : ''} merged, ${totalSelectedSubs} submission${totalSelectedSubs !== 1 ? 's' : ''} reassigned.`
            : undefined,
        });
        onComplete();
      } else {
        toast({ title: 'Action failed', description: (res as any).error ?? 'Unknown error', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message ?? 'Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const isLoading = nearby === null;
  const hasNearby = nearby && nearby.length > 0;

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mergeOnly
              ? <><GitMerge className="w-4 h-4" /> Merge into "{venueName}"</>
              : <><ShieldCheck className="w-4 h-4" /> Verify "{venueName}"</>}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : !hasNearby ? (
            <p className="text-sm text-muted-foreground">
              No unverified venues found at this location.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {nearby.length} unverified venue{nearby.length !== 1 ? 's' : ''} found at this location.
                Select which to merge — their submissions will be reassigned here and the venues deleted.
              </p>
              <div className="space-y-2">
                {nearby.map(v => {
                  const loc = formatFullLocation(v.streetAddress, v.city, v.state, v.country);
                  return (
                    <label
                      key={v.id}
                      className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/40 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(v.id)}
                        onChange={() => toggle(v.id)}
                        className="mt-0.5 h-4 w-4 rounded border-input accent-green-fresh"
                      />
                      <div className="flex-1 min-w-0 text-sm">
                        <div className="font-medium">{v.name}</div>
                        {loc && <div className="text-xs text-muted-foreground">{loc}</div>}
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {v.submission_count} submission{v.submission_count !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          {mergeOnly ? (
            <>
              <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
              <Button
                onClick={() => handleVerify(true)}
                disabled={saving || isLoading || selected.size === 0}
                className="bg-action-primary hover:bg-action-primary-hover text-white"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <GitMerge className="w-4 h-4 mr-1" />}
                Merge{selected.size > 0 ? ` (${totalSelectedSubs} sub${totalSelectedSubs !== 1 ? 's' : ''})` : ''}
              </Button>
            </>
          ) : (
            <>
              {hasNearby && (
                <Button variant="outline" onClick={() => handleVerify(false)} disabled={saving || isLoading}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  Verify (skip)
                </Button>
              )}
              <Button
                onClick={() => handleVerify(hasNearby ? true : false)}
                disabled={saving || isLoading || (!!hasNearby && selected.size === 0)}
                className="bg-action-primary hover:bg-action-primary-hover text-white"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <ShieldCheck className="w-4 h-4 mr-1" />}
                {hasNearby
                  ? `Verify + Merge (${totalSelectedSubs} sub${totalSelectedSubs !== 1 ? 's' : ''})`
                  : 'Verify'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
