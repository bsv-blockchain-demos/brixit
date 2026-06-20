import AdminTableEditor from './AdminTableEditor';
import type { ColumnDef, FieldDef } from './AdminTableEditor';
import {
  fetchAdminCategories,
  createAdminCategory,
  updateAdminCategory,
  deleteAdminCategory,
} from '@/lib/adminApi';

const CATEGORY_COLUMNS: ColumnDef[] = [
  {
    key: 'sort_order',
    label: 'Order',
    render: (v) => (
      <span className="inline-flex items-center justify-center min-w-[1.75rem] h-7 px-2 rounded-md bg-select-bg text-select-fg font-mono text-xs">
        {v ?? 0}
      </span>
    ),
  },
  { key: 'name', label: 'Name', render: (v) => <span className="font-mono text-sm text-text-dark">{v}</span> },
  {
    key: 'label',
    label: 'Display Label',
    render: (v) =>
      v ? <span className="text-text-dark">{v}</span> : <span className="italic text-text-muted">No display label</span>,
  },
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
        <h2 className="text-xl font-display font-bold text-text-dark">Reference Data</h2>
        <p className="text-sm text-text-mid">Manage crop categories used across the app</p>
      </div>
      <AdminTableEditor
        title="Crop Categories"
        singular="Category"
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
