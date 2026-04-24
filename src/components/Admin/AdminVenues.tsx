import AdminTableEditor from './AdminTableEditor';
import type { ColumnDef, FieldDef } from './AdminTableEditor';
import { fetchAdminVenues, createAdminVenue, updateAdminVenue, deleteAdminVenue } from '@/lib/adminApi';
import { formatFullLocation } from '@/lib/formatAddress';

const POS_TYPE_OPTIONS = [
  { value: 'Supermarket',    label: 'Supermarket' },
  { value: 'Farmers Market', label: 'Farmers Market' },
  { value: 'Farm Direct',    label: 'Farm Direct' },
  { value: 'Online',         label: 'Online' },
  { value: 'Other',          label: 'Other' },
];

const COLUMNS: ColumnDef[] = [
  { key: 'name',      label: 'Name' },
  { key: 'posType',   label: 'Type' },
  {
    key: 'city',
    label: 'Location',
    render: (_val, row) => {
      const loc = formatFullLocation(row.streetAddress, row.city, row.state, row.country);
      return loc || <span className="text-muted-foreground text-xs">—</span>;
    },
  },
  { key: 'verified',  label: 'Verified' },
];

const FORM_FIELDS: FieldDef[] = [
  { key: 'name',          label: 'Name',           type: 'text',   required: true, placeholder: 'e.g. Green Valley Farm Stand' },
  { key: 'posType',       label: 'Type',           type: 'select', options: POS_TYPE_OPTIONS },
  { key: 'streetAddress', label: 'Street Address', type: 'text',   placeholder: 'e.g. Albisstrasse 81' },
  { key: 'city',          label: 'City',           type: 'text',   placeholder: 'e.g. Auckland' },
  { key: 'state',         label: 'State',          type: 'text',   placeholder: 'e.g. Auckland' },
  { key: 'country',       label: 'Country',        type: 'text',   placeholder: 'e.g. New Zealand' },
  { key: 'latitude',  label: 'Latitude',  type: 'text',   placeholder: 'e.g. -36.8485' },
  { key: 'longitude', label: 'Longitude', type: 'text',   placeholder: 'e.g. 174.7633' },
  { key: 'verified',  label: 'Verified',  type: 'checkbox' },
];

export default function AdminVenues() {
  return (
    <AdminTableEditor
      title="Venues"
      queryKey="admin-venues"
      columns={COLUMNS}
      formFields={FORM_FIELDS}
      fetchFn={fetchAdminVenues}
      createFn={createAdminVenue}
      updateFn={updateAdminVenue}
      deleteFn={deleteAdminVenue}
    />
  );
}
