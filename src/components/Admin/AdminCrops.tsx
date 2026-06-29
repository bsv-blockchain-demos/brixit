import { useQuery } from '@tanstack/react-query';
import { Pencil, Trash2 } from 'lucide-react';
import { titleCase } from '@/lib/titleCase';
import AdminTableEditor from './AdminTableEditor';
import type { ColumnDef, FieldDef } from './AdminTableEditor';
import { ScoreThresholdBar } from '../common/ScoreThresholdBar';
import {
  fetchAdminCrops,
  createAdminCrop,
  updateAdminCrop,
  deleteAdminCrop,
  fetchAdminCategories,
} from '@/lib/adminApi';

const TIERS: { key: string; label: string; short: string; bg: string; ink?: boolean; paleBg: string; text: string }[] = [
  { key: 'poor_brix', label: 'Poor', short: 'Poor', bg: 'bg-score-poor', paleBg: 'bg-score-poor-bg', text: 'text-score-poor' },
  { key: 'average_brix', label: 'Avg', short: 'Avg', bg: 'bg-score-average', ink: true, paleBg: 'bg-score-average-bg', text: 'text-score-average' },
  { key: 'good_brix', label: 'Good', short: 'Good', bg: 'bg-score-good', paleBg: 'bg-score-good-bg', text: 'text-score-good' },
  { key: 'excellent_brix', label: 'Excellent', short: 'Exc', bg: 'bg-score-excellent', paleBg: 'bg-score-excellent-bg', text: 'text-score-excellent' },
];

// Category chip (shared by the desktop column and the mobile card)
const CategoryChip = ({ value }: { value?: string | null }) =>
  value ? (
    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-surface-canvas text-text-mid border border-hairline capitalize">{value}</span>
  ) : (
    <span className="text-text-muted text-xs">-</span>
  );

const COLUMNS: ColumnDef[] = [
  {
    key: 'label',
    label: 'Crop',
    render: (_v, row) => (
      <div>
        <div className="font-medium text-text-dark">{titleCase(row.label ?? row.name)}</div>
        <div className="font-mono text-xs text-text-muted">{row.name}</div>
      </div>
    ),
  },
  {
    key: 'category',
    label: 'Category',
    render: (v) => <CategoryChip value={v} />,
  },
  {
    key: 'poor_brix',
    label: 'Score thresholds',
    render: (_v, row) => (
      <ScoreThresholdBar
        poor={row.poor_brix}
        average={row.average_brix}
        good={row.good_brix}
        excellent={row.excellent_brix}
        mode="threshold"
      />
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
    { key: 'label', label: 'Display Label', type: 'text', placeholder: 'e.g. Apple' },
    {
      key: 'name',
      label: 'DB Name',
      type: 'text',
      required: true,
      slug: true,
      placeholder: 'e.g. bell_pepper',
      help: 'The permanent identifier used in the database and across the app (submissions, score lookups). Lowercase letters, numbers and underscores only, no spaces. Avoid changing it on existing crops, as it can break linked data.',
    },
    { key: 'category', label: 'Category', type: 'select', options: categoryOptions },
    { key: 'poor_brix', label: 'Poor Brix threshold', type: 'number', step: '0.01', placeholder: '0.00' },
    { key: 'average_brix', label: 'Average Brix threshold', type: 'number', step: '0.01', placeholder: '0.00' },
    { key: 'good_brix', label: 'Good Brix threshold', type: 'number', step: '0.01', placeholder: '0.00' },
    { key: 'excellent_brix', label: 'Excellent Brix threshold', type: 'number', step: '0.01', placeholder: '0.00' },
  ];

  return (
    <AdminTableEditor
      title="Crops"
      description="Manage crops and their crop-relative score thresholds"
      queryKey="admin-crops"
      columns={COLUMNS}
      formFields={formFields}
      fetchFn={fetchAdminCrops}
      createFn={createAdminCrop}
      updateFn={updateAdminCrop}
      deleteFn={deleteAdminCrop}
      renderMobileCard={(row, { onEdit, onDelete }) => (
        <div className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <span className="font-semibold text-text-dark">{titleCase(row.label ?? row.name)}</span>
              {row.category && <CategoryChip value={row.category} />}
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
          <div className="grid grid-cols-4 gap-2">
            {TIERS.map((t) => (
              <div key={t.key} className={`rounded-lg ${t.paleBg} py-2 text-center`}>
                <div className={`font-mono text-sm font-bold leading-none ${t.text}`}>{row[t.key] ?? '-'}</div>
                <div className="mt-1 text-[10px] uppercase tracking-wide text-text-muted-brown">{t.short}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    />
  );
}
