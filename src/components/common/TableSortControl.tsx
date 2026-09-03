import React from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export type SortOrder = 'asc' | 'desc';

export interface SortOption<T extends string> {
  value: T;
  label: string;
}

interface TableSortControlProps<T extends string> {
  options: SortOption<T>[];
  sortBy: T;
  sortOrder: SortOrder;
  onSortByChange: (value: T) => void;
  onSortOrderToggle: () => void;
  className?: string;
}

/**
 * Sort control for viewports where the table collapses to cards.
 *
 * The desktop tables sort by clicking a column header, but those headers are
 * inside a `hidden desktop:block` wrapper, so on mobile the sort is
 * unreachable. This drives the same sortBy/sortOrder state through a select
 * plus a direction toggle.
 */
export function TableSortControl<T extends string>({
  options,
  sortBy,
  sortOrder,
  onSortByChange,
  onSortOrderToggle,
  className,
}: TableSortControlProps<T>) {
  const activeLabel = options.find((o) => o.value === sortBy)?.label ?? 'value';
  const ascending = sortOrder === 'asc';

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span id="table-sort-label" className="text-xs text-text-muted-brown shrink-0">
        Sort
      </span>
      <Select value={sortBy} onValueChange={(v) => onSortByChange(v as T)}>
        <SelectTrigger className="h-8 flex-1 text-sm" aria-labelledby="table-sort-label">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <button
        type="button"
        onClick={onSortOrderToggle}
        // Names the current state and the column, so it is not just "toggle".
        aria-label={`${activeLabel}, sorted ${ascending ? 'ascending' : 'descending'}. Reverse the order.`}
        className="shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-md border border-hairline text-text-mid hover:bg-surface-canvas transition-colors"
      >
        {ascending ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
      </button>
    </div>
  );
}
