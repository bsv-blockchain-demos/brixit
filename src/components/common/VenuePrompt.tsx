import React, { useState, useEffect } from 'react';
import { MapPin, ShieldCheck, Users } from 'lucide-react';
import { Input } from '../ui/input';
import { apiGet } from '@/lib/api';

interface NearbyVenue {
  id: string;
  name: string;
  posType: string | null;
  verified: boolean;
  submissionCount: number;
}

export type VenueChoice =
  | { kind: 'existing'; venueId: string; posType: string | null }
  | { kind: 'register'; name: string }
  | { kind: 'skip' };

interface VenuePromptProps {
  latitude: number;
  longitude: number;
  onSelect: (choice: VenueChoice) => void;
  error?: string;
}

const VenuePrompt: React.FC<VenuePromptProps> = ({ latitude, longitude, onSelect, error }) => {
  const [nearby, setNearby] = useState<NearbyVenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [regName, setRegName] = useState('');
  const [autoConfirmed, setAutoConfirmed] = useState(false);
  const [showOverride, setShowOverride] = useState(false);

  useEffect(() => {
    if (!latitude || !longitude) return;
    setLoading(true);
    setAutoConfirmed(false);
    setShowOverride(false);
    setSelected(null);
    setRegName('');
    apiGet<NearbyVenue[]>(`/api/venues/nearby?lat=${latitude}&lng=${longitude}`, { skipAuth: true })
      .then(data => {
        setNearby(data);
        const verified = data.filter(v => v.verified);
        // Auto-confirm only when there is exactly one venue at this location and it's verified
        if (data.length === 1 && verified.length === 1) {
          setSelected(verified[0].id);
          setAutoConfirmed(true);
          onSelect({ kind: 'existing', venueId: verified[0].id, posType: verified[0].posType });
        }
      })
      .catch(() => setNearby([]))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latitude, longitude]);

  const handleSelect = (id: string) => {
    setSelected(id);
    if (id === 'skip') { onSelect({ kind: 'skip' }); return; }
    if (id === 'register') return;
    const venue = nearby.find(v => v.id === id);
    if (venue) onSelect({ kind: 'existing', venueId: venue.id, posType: venue.posType });
  };

  useEffect(() => {
    if (selected === 'register' && regName.trim()) {
      onSelect({ kind: 'register', name: regName.trim() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regName, selected]);

  // ── Auto-confirmed compact card ───────────────────────────────────────────
  if (!loading && autoConfirmed && !showOverride) {
    const venue = nearby.find(v => v.id === selected)!;
    return (
      <div
        className="mt-3 rounded-xl border overflow-hidden"
        style={{ borderColor: 'var(--green-pale)', backgroundColor: 'var(--green-mist)' }}
      >
        <div className="flex items-center gap-3 p-4">
          <div
            className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: 'var(--green-pale)' }}
          >
            <ShieldCheck className="w-5 h-5" style={{ color: 'var(--green-mid)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold truncate" style={{ color: 'var(--text-dark)' }}>
                {venue.name}
              </p>
              <span
                className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full shrink-0"
                style={{ backgroundColor: 'var(--green-pale)', color: 'var(--green-mid)' }}
              >
                <ShieldCheck className="w-3 h-3" /> Verified
              </span>
            </div>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {venue.submissionCount} past {venue.submissionCount === 1 ? 'entry' : 'entries'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowOverride(true)}
            className="shrink-0 text-xs underline"
            style={{ color: 'var(--text-muted)' }}
          >
            Not this?
          </button>
        </div>
        {error && (
          <p className="px-4 pb-3 text-xs" style={{ color: 'var(--score-poor)' }}>{error}</p>
        )}
      </div>
    );
  }

  // ── Full picker ───────────────────────────────────────────────────────────
  const hasVerified = nearby.some(v => v.verified);
  const sortedNearby = [...nearby].sort((a, b) => Number(b.verified) - Number(a.verified));

  return (
    <div
      className="mt-3 rounded-xl border overflow-hidden"
      style={{ borderColor: 'var(--green-pale)', backgroundColor: 'var(--green-mist)' }}
    >
      {/* Header */}
      <div className="flex gap-3 p-4 border-b" style={{ borderColor: 'var(--green-pale)' }}>
        <div
          className="shrink-0 w-16 h-16 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: 'var(--green-pale)' }}
        >
          <MapPin className="w-6 h-6" style={{ color: 'var(--green-mid)' }} />
        </div>
        <div>
          <p
            className="text-xs font-semibold uppercase tracking-widest mb-0.5"
            style={{ color: 'var(--text-muted)' }}
          >
            {hasVerified ? 'Venues at this pin' : 'No business at this pin'}
          </p>
          <p className="text-sm font-bold" style={{ color: 'var(--text-dark)' }}>
            {showOverride ? 'Choose a different venue' : hasVerified ? 'Select a venue' : 'Give this place a name'}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-mid)' }}>
            {hasVerified
              ? 'Pick the venue for this submission.'
              : 'Pick a nearby place or register a new one so this entry can group later.'}
          </p>
        </div>
      </div>

      {/* Options */}
      <div className="divide-y" style={{ borderColor: 'var(--green-pale)' }}>
        {loading && (
          <div className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
            Searching nearby places&hellip;
          </div>
        )}

        {sortedNearby.map(venue => (
          <label
            key={venue.id}
            className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors"
            style={{ backgroundColor: selected === venue.id ? 'var(--green-pale)' : undefined }}
          >
            <input
              type="radio"
              name="venue-choice"
              value={venue.id}
              checked={selected === venue.id}
              onChange={() => handleSelect(venue.id)}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-dark)' }}>
                  {venue.name}
                </p>
                {venue.verified ? (
                  <span
                    className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full shrink-0"
                    style={{ backgroundColor: 'var(--green-pale)', color: 'var(--green-mid)' }}
                  >
                    <ShieldCheck className="w-3 h-3" /> Verified
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full shrink-0"
                    style={{ backgroundColor: 'hsl(var(--muted))', color: 'var(--text-muted)' }}
                  >
                    <Users className="w-3 h-3" /> Community
                  </span>
                )}
              </div>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {venue.submissionCount} past {venue.submissionCount === 1 ? 'entry' : 'entries'}
              </p>
            </div>
          </label>
        ))}

        {/* Register new */}
        <div style={{ backgroundColor: selected === 'register' ? 'var(--green-pale)' : undefined }}>
          <label className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors">
            <input
              type="radio"
              name="venue-choice"
              value="register"
              checked={selected === 'register'}
              onChange={() => handleSelect('register')}
            />
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-dark)' }}>
                Register a new place
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                When the options above don&apos;t match.
              </p>
            </div>
          </label>
          {selected === 'register' && (
            <div className="px-4 pb-4">
              <Input
                placeholder="Place name"
                value={regName}
                onChange={e => setRegName(e.target.value)}
                className="border-2 rounded-xl"
                style={{ borderColor: 'var(--green-pale)' }}
              />
            </div>
          )}
        </div>

        {/* Skip */}
        <label
          className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors"
          style={{ backgroundColor: selected === 'skip' ? 'var(--green-pale)' : undefined }}
        >
          <input
            type="radio"
            name="venue-choice"
            value="skip"
            checked={selected === 'skip'}
            onChange={() => handleSelect('skip')}
          />
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-dark)' }}>
              Skip — coordinates only
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Won&apos;t group on the map.
            </p>
          </div>
        </label>
      </div>

      {error && (
        <p className="px-4 pb-3 text-xs" style={{ color: 'var(--score-poor)' }}>{error}</p>
      )}
    </div>
  );
};

export default VenuePrompt;
