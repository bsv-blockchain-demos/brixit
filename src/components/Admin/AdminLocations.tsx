import { useQuery } from '@tanstack/react-query';
import AdminTableEditor from './AdminTableEditor';
import type { ColumnDef, FieldDef } from './AdminTableEditor';
import {
  fetchAdminLocations,
  createAdminLocation,
  updateAdminLocation,
  deleteAdminLocation,
  fetchAdminLocationTypes,
} from '@/lib/adminApi';

const COLUMNS: ColumnDef[] = [
  { key: 'name', label: 'Name' },
  { key: 'label', label: 'Label' },
  { key: 'type', label: 'Type' },
];

export default function AdminLocations() {
  // Fetch location types to populate the select options in the form
  const { data: typesData } = useQuery({
    queryKey: ['admin-location-types-all'],
    queryFn: () => fetchAdminLocationTypes({ limit: 200, offset: 0 }),
  });

  const typeOptions = (typesData?.data ?? []).map(t => ({
    value: t.name,
    label: t.label ?? t.name,
  }));

  const formFields: FieldDef[] = [
    { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. whole-foods-downtown' },
    { key: 'label', label: 'Display Label', type: 'text', placeholder: 'e.g. Whole Foods Downtown' },
    { key: 'type', label: 'Location Type', type: 'select', options: typeOptions },
  ];

  return (
    <AdminTableEditor
      title="Locations"
      queryKey="admin-locations"
      columns={COLUMNS}
      formFields={formFields}
      fetchFn={fetchAdminLocations}
      createFn={createAdminLocation}
      updateFn={updateAdminLocation}
      deleteFn={deleteAdminLocation}
    />
  );
}
