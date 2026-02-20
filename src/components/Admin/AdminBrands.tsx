import AdminTableEditor from './AdminTableEditor';
import type { ColumnDef, FieldDef } from './AdminTableEditor';
import { fetchAdminBrands, createAdminBrand, updateAdminBrand, deleteAdminBrand } from '@/lib/adminApi';

const COLUMNS: ColumnDef[] = [
  { key: 'name', label: 'Name' },
  { key: 'label', label: 'Label' },
];

const FORM_FIELDS: FieldDef[] = [
  { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. whole-foods' },
  { key: 'label', label: 'Display Label', type: 'text', placeholder: 'e.g. Whole Foods' },
];

export default function AdminBrands() {
  return (
    <AdminTableEditor
      title="Brands"
      queryKey="admin-brands"
      columns={COLUMNS}
      formFields={FORM_FIELDS}
      fetchFn={fetchAdminBrands}
      createFn={createAdminBrand}
      updateFn={updateAdminBrand}
      deleteFn={deleteAdminBrand}
    />
  );
}
