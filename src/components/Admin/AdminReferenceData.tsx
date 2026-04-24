import AdminTableEditor from './AdminTableEditor';
import type { ColumnDef, FieldDef } from './AdminTableEditor';
import {
  fetchAdminCategories,
  createAdminCategory,
  updateAdminCategory,
  deleteAdminCategory,
} from '@/lib/adminApi';

const CATEGORY_COLUMNS: ColumnDef[] = [
  { key: 'name', label: 'Name' },
  { key: 'label', label: 'Label' },
  { key: 'sort_order', label: 'Sort Order' },
];

const CATEGORY_FIELDS: FieldDef[] = [
  { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. fruit' },
  { key: 'label', label: 'Display Label', type: 'text', placeholder: 'e.g. Fruit' },
  { key: 'sort_order', label: 'Sort Order', type: 'number', placeholder: '0' },
];

export default function AdminReferenceData() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Reference Data</h2>
        <p className="text-sm text-muted-foreground">
          Manage crop categories used across the app
        </p>
      </div>
      <AdminTableEditor
        title="Crop Categories"
        queryKey="admin-categories"
        columns={CATEGORY_COLUMNS}
        formFields={CATEGORY_FIELDS}
        fetchFn={fetchAdminCategories}
        createFn={createAdminCategory}
        updateFn={updateAdminCategory}
        deleteFn={deleteAdminCategory}
      />
    </div>
  );
}
