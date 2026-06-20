import { useState } from 'react';
import { ShieldCheck, GitMerge, MapPin, Check } from 'lucide-react';
import AdminTableEditor from './AdminTableEditor';
import type { ColumnDef, FieldDef } from './AdminTableEditor';
import { fetchAdminVenues, createAdminVenue, updateAdminVenue, deleteAdminVenue } from '@/lib/adminApi';
import { formatFullLocation } from '@/lib/formatAddress';
import VenueVerifyModal from './VenueVerifyModal';

const POS_TYPE_OPTIONS = [
  { value: 'Supermarket',    label: 'Supermarket' },
  { value: 'Farmers Market', label: 'Farmers Market' },
  { value: 'Farm Direct',    label: 'Farm Direct' },
  { value: 'Online',         label: 'Online' },
  { value: 'Other',          label: 'Other' },
];

const COLUMNS: ColumnDef[] = [
  {
    key: 'name',
    label: 'Venue',
    render: (_val, row) => {
      const loc = formatFullLocation(row.streetAddress, row.city, row.state, row.country);
      return (
        <div>
          <div className="font-medium text-text-dark">{row.name}</div>
          {loc && (
            <div className="flex items-center gap-1 text-xs text-text-muted mt-0.5">
              <MapPin className="w-3 h-3 shrink-0" />
              <span>{loc}</span>
            </div>
          )}
        </div>
      );
    },
  },
  {
    key: 'posType',
    label: 'Type',
    render: (v) => (
      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-surface-canvas text-text-mid border border-hairline">
        {v || 'Unspecified'}
      </span>
    ),
  },
  {
    key: 'verified',
    label: 'Verified',
    render: (val) =>
      val ? (
        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-pale text-green-mid">
          <Check className="w-3 h-3" /> Verified
        </span>
      ) : (
        <span className="text-xs text-text-muted">No</span>
      ),
  },
];

const FORM_FIELDS: FieldDef[] = [
  { key: 'name',          label: 'Name',           type: 'text',   required: true, placeholder: 'e.g. Green Valley Farm Stand' },
  { key: 'posType',       label: 'Type',           type: 'select', options: POS_TYPE_OPTIONS },
  { key: 'streetAddress', label: 'Street Address', type: 'text',   placeholder: 'e.g. Albisstrasse 81' },
  { key: 'city',          label: 'City',           type: 'text',   placeholder: 'e.g. Auckland' },
  { key: 'state',         label: 'State',          type: 'text',   placeholder: 'e.g. Auckland' },
  { key: 'country',       label: 'Country',        type: 'text',   placeholder: 'e.g. New Zealand' },
  { key: 'latitude',      label: 'Latitude',       type: 'text',   placeholder: 'e.g. -36.8485' },
  { key: 'longitude',     label: 'Longitude',      type: 'text',   placeholder: 'e.g. 174.7633' },
  { key: 'verified',      label: 'Verified',       type: 'checkbox' },
];

interface ModalState {
  venueId: string;
  venueName: string;
  mergeOnly: boolean;
  invalidate: () => void;
}

export default function AdminVenues() {
  const [modal, setModal] = useState<ModalState | null>(null);

  // Merge (verified, for de-duplication) and Verify (unverified) — both steel structural actions.
  const extraRowActions = (row: any, invalidate: () => void) => {
    if (row.verified) {
      return (
        <button
          className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-select-fg hover:bg-surface-canvas"
          title="Merge nearby unverified venues"
          aria-label="Merge nearby unverified venues"
          onClick={() => setModal({ venueId: row.id, venueName: row.name, mergeOnly: true, invalidate })}
        >
          <GitMerge className="h-3.5 w-3.5" />
        </button>
      );
    }
    return (
      <button
        className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-select-fg hover:bg-surface-canvas"
        title="Verify venue"
        aria-label="Verify venue"
        onClick={() => setModal({ venueId: row.id, venueName: row.name, mergeOnly: false, invalidate })}
      >
        <ShieldCheck className="h-3.5 w-3.5" />
      </button>
    );
  };

  return (
    <>
      {modal && (
        <VenueVerifyModal
          venueId={modal.venueId}
          venueName={modal.venueName}
          mergeOnly={modal.mergeOnly}
          onClose={() => setModal(null)}
          onComplete={() => {
            modal.invalidate();
            setModal(null);
          }}
        />
      )}
      <AdminTableEditor
        title="Venues"
        queryKey="admin-venues"
        columns={COLUMNS}
        formFields={FORM_FIELDS}
        fetchFn={fetchAdminVenues}
        createFn={createAdminVenue}
        updateFn={updateAdminVenue}
        deleteFn={deleteAdminVenue}
        extraRowActions={extraRowActions}
      />
    </>
  );
}
