import { useState } from 'react';
import { ShieldCheck, GitMerge } from 'lucide-react';
import AdminTableEditor from './AdminTableEditor';
import type { ColumnDef, FieldDef } from './AdminTableEditor';
import { fetchAdminVenues, createAdminVenue, updateAdminVenue, deleteAdminVenue } from '@/lib/adminApi';
import { formatFullLocation } from '@/lib/formatAddress';
import { Button } from '@/components/ui/button';
import VenueVerifyModal from './VenueVerifyModal';

const POS_TYPE_OPTIONS = [
  { value: 'Supermarket',    label: 'Supermarket' },
  { value: 'Farmers Market', label: 'Farmers Market' },
  { value: 'Farm Direct',    label: 'Farm Direct' },
  { value: 'Online',         label: 'Online' },
  { value: 'Other',          label: 'Other' },
];

const COLUMNS: ColumnDef[] = [
  { key: 'name',     label: 'Name' },
  { key: 'posType',  label: 'Type' },
  {
    key: 'city',
    label: 'Location',
    render: (_val, row) => {
      const loc = formatFullLocation(row.streetAddress, row.city, row.state, row.country);
      return loc || <span className="text-muted-foreground text-xs">—</span>;
    },
  },
  {
    key: 'verified',
    label: 'Verified',
    render: (val) => val
      ? <span className="text-xs font-medium text-action-primary">Yes</span>
      : <span className="text-xs text-muted-foreground">No</span>,
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

  const extraRowActions = (row: any, invalidate: () => void) => {
    if (row.verified) {
      return (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          title="Merge nearby unverified venues"
          onClick={() => setModal({ venueId: row.id, venueName: row.name, mergeOnly: true, invalidate })}
        >
          <GitMerge className="h-3.5 w-3.5" />
        </Button>
      );
    }
    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-action-primary"
        title="Verify venue"
        onClick={() => setModal({ venueId: row.id, venueName: row.name, mergeOnly: false, invalidate })}
      >
        <ShieldCheck className="h-3.5 w-3.5" />
      </Button>
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
