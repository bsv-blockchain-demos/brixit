/**
 * Source / Product / Notes — the fields a submitter may change on their own
 * reading. Shared by the detail modal's edit mode and the resubmit view.
 */
import React from 'react';
import { BrixDataPoint } from '../../types';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import Combobox from '../ui/combo-box';
import { Package, FileText, Building } from 'lucide-react';
import { formatHumanDate } from '../../lib/formatDate';
import { formatFullLocation } from '../../lib/formatAddress';
import { NamedItem, SubmissionEditState } from './useSubmissionEditState';

// Grouped detail card: one icon-headed section holding a list of label/value rows.
// All colors go through inverting tokens (card, hairline, blue-deep, text-*) so the
// whole thing flips correctly in dark mode.
export function DetailSection({ icon, title, children, columns = 1 }: { icon: React.ReactNode; title: string; children: React.ReactNode; columns?: 1 | 2 }) {
  return (
    <section className="rounded-2xl border border-hairline bg-card shadow-sm overflow-hidden">
      <div className="flex items-center gap-1.5 px-4 pt-4 pb-1">
        {icon}
        <h4 className="text-xs font-semibold uppercase tracking-wider text-text-mid">{title}</h4>
      </div>
      {/* columns=2 → 2-col grid (mobile + desktop); drop per-row dividers since the grid gap separates cells. */}
      <div className={`px-4 pb-1 ${columns === 2 ? 'grid grid-cols-2 gap-x-6 [&>div]:border-b-0' : ''}`}>{children}</div>
    </section>
  );
}

// One row: muted label on top, prominent value below. `children` is either a plain
// value (view mode) or an input/combobox (edit mode).
export function DetailRow({ label, children, last = false, valueClassName = '' }: { label: string; children: React.ReactNode; last?: boolean; valueClassName?: string }) {
  return (
    <div className={last ? 'py-3' : 'py-3 border-b border-hairline'}>
      <p className="text-xs font-medium text-text-mid">{label}</p>
      <div className={`mt-1 text-sm font-medium text-text-dark ${valueClassName}`}>{children}</div>
    </div>
  );
}

// Resolve display label from static data, falling back to title-cased name
export const getDisplayLabel = (items: { name: string; label?: string }[], name: string | undefined) => {
  if (!name) return 'N/A';
  const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, '');
  const match = items.find(i => normalize(i.name) === normalize(name));
  const raw = match?.label || match?.name || name;
  // Labels are stored lowercase — always render with a capital first letter.
  return raw.replace(/\b\w/g, c => c.toUpperCase());
};

interface SubmissionEditFieldsProps {
  state: SubmissionEditState;
  isEditing: boolean;
  dataPoint: BrixDataPoint;
  crops: NamedItem[];
  brands: NamedItem[];
  locations: NamedItem[];
  getDisplayLabel: (items: { name: string; label?: string }[], name: string | undefined) => string;
}

const SubmissionEditFields: React.FC<SubmissionEditFieldsProps> = ({
  state,
  isEditing,
  dataPoint: initialDataPoint,
  crops,
  brands,
  locations,
  getDisplayLabel,
}) => {
  const { brixLevel, cropType, variety, brand, locationName, measurementDate, purchaseDate, outlierNotes } = state.values;
  const { setBrixLevel, setCropType, setVariety, setBrand, setLocationName, setMeasurementDate, setPurchaseDate, setOutlierNotes } = state.setters;

  return (
    <>
      <div className="space-y-4">
      <DetailSection icon={<Building className="w-3.5 h-3.5 text-text-mid" />} title="Source" columns={2}>
        <DetailRow label="Location (Store)">
          {isEditing ? (
            <Combobox items={Array.isArray(locations) ? locations : []} value={locationName} onSelect={setLocationName} placeholder="Select Store" />
          ) : (
            getDisplayLabel(locations, initialDataPoint.locationName)
          )}
        </DetailRow>
        <DetailRow label="Place (Address)">
          {/* Read-only (the address lives on the venue). Show the human address
              (street, city, state); never the raw coordinates. */}
          <span className="block break-words leading-relaxed">
            {formatFullLocation(initialDataPoint.streetAddress, initialDataPoint.city, initialDataPoint.state, initialDataPoint.country) || 'N/A'}
          </span>
        </DetailRow>
        <DetailRow label="Purchase Date">
          {isEditing ? (
            <Input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
          ) : (
            formatHumanDate(initialDataPoint.purchaseDate)
          )}
        </DetailRow>
        <DetailRow label="Assessment Date" last>
          {isEditing ? (
            <Input type="date" value={measurementDate} onChange={e => setMeasurementDate(e.target.value)} />
          ) : (
            formatHumanDate(initialDataPoint.submittedAt)
          )}
        </DetailRow>
      </DetailSection>

      <DetailSection icon={<Package className="w-3.5 h-3.5 text-text-mid" />} title="Product" columns={2}>
        <DetailRow label="Crop Type">
          {isEditing ? (
            <Combobox items={Array.isArray(crops) ? crops : []} value={cropType} onSelect={setCropType} placeholder="Select Crop" />
          ) : (
            getDisplayLabel(crops, initialDataPoint.cropType)
          )}
        </DetailRow>
        <DetailRow label="Variety">
          {isEditing ? (
            <Input type="text" value={variety} onChange={e => setVariety(e.target.value)} />
          ) : (
            initialDataPoint.variety || initialDataPoint.posType || 'N/A'
          )}
        </DetailRow>
        <DetailRow label="Brand">
          {isEditing ? (
            <Combobox items={Array.isArray(brands) ? brands : []} value={brand} onSelect={setBrand} placeholder="Select Brand" />
          ) : (
            getDisplayLabel(brands, initialDataPoint.brandName)
          )}
        </DetailRow>
        <DetailRow label="BRIX Level" last>
          {isEditing ? (
            <Input type="number" value={brixLevel} onChange={e => setBrixLevel(e.target.value === '' ? '' : Number(e.target.value))} min={0} step={0.1} />
          ) : (
            initialDataPoint.brixLevel
          )}
        </DetailRow>
      </DetailSection>
      </div>

      <div className="mt-4 space-y-4">
      <DetailSection icon={<FileText className="w-3.5 h-3.5 text-text-mid" />} title="Notes">
        <DetailRow label="Outlier Notes" last>
          {isEditing ? (
            <Textarea value={outlierNotes} onChange={e => setOutlierNotes(e.target.value)} rows={4} />
          ) : (
            <span className="font-normal">{initialDataPoint.outlier_notes || 'No notes for this submission.'}</span>
          )}
        </DetailRow>
      </DetailSection>
      </div>
    </>
  );
};

export default SubmissionEditFields;
