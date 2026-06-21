import { Pencil, Trash2 } from 'lucide-react';
import AdminTableEditor from './AdminTableEditor';
import type { ColumnDef, FieldDef } from './AdminTableEditor';
import { fetchAdminBrands, createAdminBrand, updateAdminBrand, deleteAdminBrand } from '@/lib/adminApi';

const COLUMNS: ColumnDef[] = [
  {
    key: 'label',
    label: 'Display Label',
    render: (v) =>
      v ? <span className="text-text-dark">{v}</span> : <span className="italic text-text-muted">No display label</span>,
  },
  { key: 'name', label: 'DB Name', render: (v) => <span className="font-mono text-sm text-text-muted-brown">{v}</span> },
];

const FORM_FIELDS: FieldDef[] = [
  { key: 'label', label: 'Display Label', type: 'text', placeholder: 'e.g. Whole Foods' },
  {
    key: 'name',
    label: 'DB Name',
    type: 'text',
    required: true,
    slug: true,
    placeholder: 'e.g. whole_foods',
    help: 'The permanent identifier used in the database and across the app. Lowercase letters, numbers and underscores only, no spaces. Avoid changing it on existing brands, as it can break linked data.',
  },
];

export default function AdminBrands() {
  return (
    <AdminTableEditor
      title="Brands"
      description="Manage store and brand names"
      queryKey="admin-brands"
      columns={COLUMNS}
      formFields={FORM_FIELDS}
      fetchFn={fetchAdminBrands}
      createFn={createAdminBrand}
      updateFn={updateAdminBrand}
      deleteFn={deleteAdminBrand}
      renderMobileCard={(row, { onEdit, onDelete }) => (
        <div className="flex items-center justify-between gap-3 p-4">
          <div className="min-w-0">
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
  );
}
