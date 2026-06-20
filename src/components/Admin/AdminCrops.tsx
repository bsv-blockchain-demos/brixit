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

const TIERS: { key: string; label: string; bg: string; ink?: boolean }[] = [
  { key: 'poor_brix', label: 'Poor', bg: 'bg-score-poor' },
  { key: 'average_brix', label: 'Avg', bg: 'bg-score-average', ink: true },
  { key: 'good_brix', label: 'Good', bg: 'bg-score-good' },
  { key: 'excellent_brix', label: 'Excellent', bg: 'bg-score-excellent' },
];

const COLUMNS: ColumnDef[] = [
  {
    key: 'label',
    label: 'Crop',
    render: (_v, row) => (
      <div>
        <div className="font-medium text-text-dark">{row.label ?? row.name}</div>
        <div className="font-mono text-xs text-text-muted">{row.name}</div>
      </div>
    ),
  },
  {
    key: 'category',
    label: 'Category',
    render: (v) =>
      v ? (
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-surface-canvas text-text-mid border border-hairline capitalize">{v}</span>
      ) : (
        <span className="text-text-muted text-xs">—</span>
      ),
  },
  {
    key: 'poor_brix',
    label: 'Score thresholds',
    render: (_v, row) => (
      <div className="flex items-center gap-px rounded-md overflow-hidden w-fit">
        {TIERS.map((t) => (
          <span
            key={t.key}
            className={`flex flex-col items-center justify-center min-w-[3rem] px-2 py-1 ${t.bg} ${t.ink ? 'text-text-dark' : 'text-white'}`}
          >
            <span className="text-[9px] leading-none uppercase tracking-wide opacity-90">{t.label}</span>
            <span className="font-mono text-xs leading-tight">{row[t.key] ?? '—'}</span>
          </span>
        ))}
      </div>
    ),
  },
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
