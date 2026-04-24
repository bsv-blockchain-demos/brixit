import React, { useState, useEffect } from 'react';
import { MapPin } from 'lucide-react';
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
  const [selected, setSelected] = useState<string | null>(null); // venueId | 'register' | 'skip'
  const [regName, setRegName] = useState('');

  useEffect(() => {
    if (!latitude || !longitude) return;
    setLoading(true);
    apiGet<NearbyVenue[]>(`/api/venues/nearby?lat=${latitude}&lng=${longitude}`, { skipAuth: true })
      .then(setNearby)
      .catch(() => setNearby([]))
      .finally(() => setLoading(false));
  }, [latitude, longitude]);

  const handleSelect = (id: string) => {
    setSelected(id);
    if (id === 'skip') {
      onSelect({ kind: 'skip' });
      return;
    }
    if (id === 'register') return; // defer until name is filled
    const venue = nearby.find(v => v.id === id);
    if (venue) onSelect({ kind: 'existing', venueId: venue.id, posType: venue.posType });
  };

  // Emit register choice as soon as a name is typed
  useEffect(() => {
    if (selected === 'register' && regName.trim()) {
      onSelect({ kind: 'register', name: regName.trim() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regName, selected]);

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
          <span className="sr-only">{latitude.toFixed(4)}, {longitude.toFixed(4)}</span>
        </div>
        <div>
          <p
            className="text-xs font-semibold uppercase tracking-widest mb-0.5"
            style={{ color: 'var(--text-muted)' }}
          >
            No business at this pin
          </p>
          <p className="text-sm font-bold" style={{ color: 'var(--text-dark)' }}>
            Give this place a name
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-mid)' }}>
            Pick a nearby place or register a new one so this entry can group later.
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

        {/* Nearby venues */}
        {nearby.map(venue => (
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
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-dark)' }}>
                {venue.name}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
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
