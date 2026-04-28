import React from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X, Package, Droplets, Camera, FileText, Building2, Trash2, ChevronDown } from 'lucide-react';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Slider } from '../ui/slider';
import ComboBoxAddable from '../ui/combo-box-addable';
import Combobox from '../ui/combo-box';
import { useCropThresholds } from '../../contexts/CropThresholdContext';
import { scoreBrix } from '../../lib/getBrixColor';

export interface CropReading {
  id: string;
  cropType: string;
  brixLevel: number;
  brandName: string;
  notes: string;
  images: File[];
}

const QUALITY_COLOR: Record<string, string> = {
  Excellent: 'var(--green-mid)',
  Good: 'var(--green-fresh)',
  Average: 'var(--gold)',
  Poor: 'var(--score-poor)',
};

const ReadingCard: React.FC<{
  reading: CropReading;
  index: number;
  crops: { id: string; name: string; label?: string }[];
  brands: { id?: string; name: string; label?: string }[];
  errors: Record<string, string>;
  showRemove: boolean;
  isOpen: boolean;
  onChange: (id: string, field: keyof CropReading, value: any) => void;
  onRemove: (id: string) => void;
  onToggle: (id: string) => void;
  onAddBrand: (readingId: string, name: string) => void;
  onImageUpload: (id: string, e: React.ChangeEvent<HTMLInputElement>) => void;
  onImageRemove: (id: string, index: number) => void;
}> = ({ reading, index, crops, brands, errors, showRemove, isOpen, onChange, onRemove, onToggle, onAddBrand, onImageUpload, onImageRemove }) => {
  const prefersReducedMotion = useReducedMotion();
  const { getThresholds } = useCropThresholds();
  const thresholds = reading.cropType ? getThresholds(reading.cropType) : null;
  const score = scoreBrix(reading.brixLevel, thresholds);
  const tierColor = QUALITY_COLOR[score.quality] ?? 'var(--score-poor)';
  const tierLabel = score.quality;
  const cropLabel = crops.find(c => c.name === reading.cropType)?.label || reading.cropType;
  const hasError = !!(errors[`reading_${reading.id}_cropType`] || errors[`reading_${reading.id}_brixLevel`]);

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: hasError ? 'var(--score-poor)' : 'var(--blue-pale)', backgroundColor: 'hsl(var(--card))' }}
    >
      {/* Accordion header */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onToggle(reading.id)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(reading.id); } }}
        className="flex items-center justify-between p-4 cursor-pointer select-none hover:bg-blue-mist transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
            style={{ backgroundColor: hasError ? 'var(--score-poor)' : 'var(--green-fresh)' }}
          >
            {index + 1}
          </span>
          <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-mid)' }}>
            {cropLabel || 'New reading'}
          </span>
          {!isOpen && reading.cropType && (
            <span className="hidden sm:flex items-center gap-1.5 ml-1 text-xs" style={{ color: tierColor }}>
              · {reading.brixLevel} BRIX · {tierLabel}
            </span>
          )}
          {!isOpen && hasError && (
            <span className="text-xs ml-1" style={{ color: 'var(--score-poor)' }}>— incomplete</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-2">
          {showRemove && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onRemove(reading.id); }}
              className="p-1.5 rounded-lg text-destructive hover:opacity-70 transition-opacity"
              aria-label="Remove reading"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            style={{ color: 'var(--text-muted)' }}
          />
        </div>
      </div>

      {/* Animated body */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={prefersReducedMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={prefersReducedMotion ? {} : { height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-4 pb-5 border-t space-y-4" style={{ borderColor: 'var(--blue-pale)' }}>
              {/* Crop Type */}
              <div className="pt-4">
                <Label
                  className="flex items-center gap-1 mb-1.5 text-xs font-semibold"
                  style={{ color: 'var(--text-mid)' }}
                >
                  <Package className="w-3.5 h-3.5" />
                  Crop Type <span className="text-destructive ml-0.5">*</span>
                </Label>
                <Combobox
                  items={crops}
                  value={reading.cropType}
                  onSelect={val => onChange(reading.id, 'cropType', val)}
                  placeholder="Select crop type"
                />
                {errors[`reading_${reading.id}_cropType`] && (
                  <p className="text-destructive text-xs mt-1 flex items-center gap-1">
                    <X className="w-3 h-3" />{errors[`reading_${reading.id}_cropType`]}
                  </p>
                )}
              </div>

              {/* Brand Name */}
              <div>
                <Label
                  className="flex items-center gap-1 mb-1.5 text-xs font-semibold"
                  style={{ color: 'var(--text-mid)' }}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  Farm / Brand Name <span className="text-destructive ml-0.5">*</span>
                </Label>
                <ComboBoxAddable
                  items={[{ name: 'Unknown', label: 'Unknown' }, ...brands]}
                  value={reading.brandName}
                  onSelect={val => onChange(reading.id, 'brandName', val)}
                  onAddNew={name => onAddBrand(reading.id, name)}
                  placeholder="Select or enter farm/brand name"
                />
                {errors[`reading_${reading.id}_brandName`] && (
                  <p className="text-destructive text-xs mt-1 flex items-center gap-1">
                    <X className="w-3 h-3" />{errors[`reading_${reading.id}_brandName`]}
                  </p>
                )}
              </div>

              {/* BRIX */}
              <div>
                <Label
                  className="flex items-center gap-1 mb-2 text-xs font-semibold"
                  style={{ color: 'var(--text-mid)' }}
                >
                  <Droplets className="w-3.5 h-3.5" style={{ color: tierColor }} />
                  BRIX Reading <span className="text-destructive ml-0.5">*</span>
                </Label>
                <div className="flex items-center gap-4">
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    inputMode="decimal"
                    value={isNaN(reading.brixLevel) ? '' : reading.brixLevel}
                    onChange={e => {
                      const parsed = parseFloat(e.target.value);
                      onChange(reading.id, 'brixLevel', isNaN(parsed) ? 0 : Math.min(Math.max(parsed, 0), 100));
                    }}
                    className="w-20 shrink-0 text-center border-2 rounded-xl px-2 py-2 font-display font-bold text-lg transition-all border-input focus:border-green-fresh bg-card focus:outline-none"
                    style={{ color: tierColor }}
                  />
                  <Slider
                    value={[reading.brixLevel]}
                    onValueChange={([v]) => onChange(reading.id, 'brixLevel', Math.min(Math.max(v, 0), 100))}
                    max={100}
                    step={0.1}
                    className="flex-1"
                  />
                </div>
                <span className="text-xs font-medium mt-1 inline-block w-20 text-center" style={{ color: tierColor }}>{tierLabel}</span>
                {errors[`reading_${reading.id}_brixLevel`] && (
                  <p className="text-destructive text-xs mt-1 flex items-center gap-1">
                    <X className="w-3 h-3" />{errors[`reading_${reading.id}_brixLevel`]}
                  </p>
                )}
              </div>

              {/* Notes */}
              <div>
                <Label
                  className="flex items-center gap-1 mb-1.5 text-xs font-semibold"
                  style={{ color: 'var(--text-mid)' }}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Notes
                  <span className="font-normal ml-1" style={{ color: 'var(--text-muted)' }}>(optional)</span>
                </Label>
                <Textarea
                  placeholder="Variety, observations, or anomalies — e.g. Red Delicious, grown outdoors, unusually sweet..."
                  value={reading.notes}
                  onChange={e => onChange(reading.id, 'notes', e.target.value)}
                  rows={2}
                  className={`w-full border-2 rounded-xl px-3 py-2 text-sm transition-all hover:border-blue-light focus:outline-none focus:ring-4 focus:ring-blue-pale ${errors[`reading_${reading.id}_notes`] ? 'border-destructive bg-red-50' : 'border-input focus:border-green-fresh bg-card'}`}
                  style={{ color: 'var(--text-dark)' }}
                />
                {errors[`reading_${reading.id}_notes`] && (
                  <p className="text-destructive text-xs mt-1 flex items-center gap-1">
                    <X className="w-3 h-3" />{errors[`reading_${reading.id}_notes`]}
                  </p>
                )}
              </div>

              {/* Photos */}
              <div>
                <Label
                  className="flex items-center gap-1 mb-2 text-xs font-semibold"
                  style={{ color: 'var(--text-mid)' }}
                >
                  <Camera className="w-3.5 h-3.5" />
                  Photos
                  <span className="font-normal ml-1" style={{ color: 'var(--text-muted)' }}>(optional, max 3)</span>
                </Label>
                <div className="flex flex-wrap items-center gap-2">
                  {reading.images.map((file, i) => (
                    <div
                      key={i}
                      className="relative w-20 h-20 rounded-xl overflow-hidden border-2 group"
                      style={{ borderColor: 'var(--green-pale)' }}
                    >
                      <img
                        src={URL.createObjectURL(file)}
                        alt={`Preview ${i + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => onImageRemove(reading.id, i)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {reading.images.length < 3 && (
                    <Label
                      htmlFor={`image-upload-${reading.id}`}
                      className="w-20 h-20 flex flex-col items-center justify-center border-2 border-dashed rounded-xl cursor-pointer hover:border-green-fresh transition-colors"
                      style={{ borderColor: 'var(--green-pale)', color: 'var(--text-muted)' }}
                    >
                      <Camera className="w-5 h-5 mb-1" />
                      <span className="text-xs text-center">Add Photo</span>
                      <Input
                        id={`image-upload-${reading.id}`}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        onChange={e => onImageUpload(reading.id, e)}
                        className="sr-only"
                      />
                    </Label>
                  )}
                </div>
                {errors[`reading_${reading.id}_images`] && (
                  <p className="text-destructive text-xs mt-1 flex items-center gap-1">
                    <X className="w-3 h-3" />{errors[`reading_${reading.id}_images`]}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ReadingCard;
