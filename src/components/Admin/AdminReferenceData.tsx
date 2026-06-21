import { Pencil, Trash2 } from 'lucide-react';
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
  {
    key: 'label',
    label: 'Display Label',
    render: (v) =>
      v ? <span className="text-text-dark">{v}</span> : <span className="italic text-text-muted">No display label</span>,
  },
  { key: 'name', label: 'DB Name', render: (v) => <span className="font-mono text-sm text-text-muted-brown">{v}</span> },
];

const CATEGORY_FIELDS: FieldDef[] = [
  { key: 'label', label: 'Display Label', type: 'text', placeholder: 'e.g. Fruit' },
  {
    key: 'name',
    label: 'DB Name',
    type: 'text',
    required: true,
    slug: true,
    placeholder: 'e.g. fruit',
    help: 'The permanent identifier used in the database and across the app. Lowercase letters, numbers and underscores only, no spaces. Avoid changing it on existing categories, as it can break linked data.',
  },
  { key: 'sort_order', label: 'Sort Order', type: 'number', placeholder: '0' },
];

export default function AdminReferenceData() {
  return (
    <div className="space-y-4">
      <AdminTableEditor
        title="Crop Categories"
        heading="Reference Data"
        description="Manage crop categories used across the app"
        singular="Category"
        queryKey="admin-categories"
        columns={CATEGORY_COLUMNS}
        formFields={CATEGORY_FIELDS}
        fetchFn={fetchAdminCategories}
        createFn={createAdminCategory}
        updateFn={updateAdminCategory}
        deleteFn={deleteAdminCategory}
        renderMobileCard={(row, { onEdit, onDelete }) => (
          <div className="flex items-center gap-3 p-4">
            <span className="inline-flex items-center justify-center min-w-[1.75rem] h-7 px-2 rounded-md bg-select-bg text-select-fg font-mono text-xs shrink-0">
              {row.sort_order ?? 0}
            </span>
            <div className="min-w-0 flex-1">
              {row.label
                ? <div className="font-semibold text-text-dark truncate">{row.label}</div>
                : <div className="italic text-text-muted">No display label</div>}
              <div className="font-mono text-xs text-text-muted-brown truncate">{row.name}</div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={onEdit} aria-label="Edit" className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-text-mid hover:bg-surface-canvas">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button onClick={onDelete} aria-label="Delete" className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      />
    </div>
  );
}
