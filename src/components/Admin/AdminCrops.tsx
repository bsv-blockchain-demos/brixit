import { useQuery } from '@tanstack/react-query';
import AdminTableEditor from './AdminTableEditor';
import type { ColumnDef, FieldDef } from './AdminTableEditor';
import {
  fetchAdminCrops,
  createAdminCrop,
  updateAdminCrop,
  deleteAdminCrop,
  fetchAdminCategories,
} from '@/lib/adminApi';

const COLUMNS: ColumnDef[] = [
  { key: 'name', label: 'Name' },
  { key: 'label', label: 'Label' },
  { key: 'category', label: 'Category' },
  { key: 'poor_brix', label: 'Poor' },
  { key: 'average_brix', label: 'Average' },
  { key: 'good_brix', label: 'Good' },
  { key: 'excellent_brix', label: 'Excellent' },
];

export default function AdminCrops() {
  // Fetch categories to populate the select options in the form
  const { data: catData } = useQuery({
    queryKey: ['admin-categories-all'],
    queryFn: () => fetchAdminCategories({ limit: 200, offset: 0 }),
  });

  const categoryOptions = (catData?.data ?? []).map(c => ({
    value: c.name,
    label: c.label ?? c.name,
  }));

  const formFields: FieldDef[] = [
    { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. apple' },
    { key: 'label', label: 'Display Label', type: 'text', placeholder: 'e.g. Apple' },
    { key: 'category', label: 'Category', type: 'select', options: categoryOptions },
    { key: 'poor_brix', label: 'Poor Brix threshold', type: 'number', step: '0.01', placeholder: '0.00' },
    { key: 'average_brix', label: 'Average Brix threshold', type: 'number', step: '0.01', placeholder: '0.00' },
    { key: 'good_brix', label: 'Good Brix threshold', type: 'number', step: '0.01', placeholder: '0.00' },
    { key: 'excellent_brix', label: 'Excellent Brix threshold', type: 'number', step: '0.01', placeholder: '0.00' },
  ];

  return (
    <AdminTableEditor
      title="Crops"
      queryKey="admin-crops"
      columns={COLUMNS}
      formFields={formFields}
      fetchFn={fetchAdminCrops}
      createFn={createAdminCrop}
      updateFn={updateAdminCrop}
      deleteFn={deleteAdminCrop}
    />
  );
}
