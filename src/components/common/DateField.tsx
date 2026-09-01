import React, { useState } from 'react';
import { CalendarIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatHumanDate } from '@/lib/formatDate';
import { cn } from '@/lib/utils';

/**
 * Date picker for the filter bar.
 *
 * Replaces `<input type="date">`. The native control renders its own calendar,
 * which no stylesheet can reach: it does not use our surface, hairline or
 * accent tokens, its position and icon placement differ per browser, and in
 * dark mode it stays light on Chrome. This drives the app's own Calendar
 * inside a Popover instead, so the panel matches every other overlay.
 *
 * Values stay as YYYY-MM-DD strings, matching what the filter state and the
 * API query already use.
 */

/** Parse YYYY-MM-DD as local midnight, not UTC. `new Date('2026-01-05')` is
 *  parsed as UTC and renders as the 4th anywhere west of Greenwich. */
function parseISODate(value: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return undefined;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Format back to YYYY-MM-DD from local parts, for the same reason. */
function toISODate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

interface DateFieldProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  'aria-label'?: string;
  className?: string;
  /** Latest selectable day; later days render disabled. */
  maxDate?: Date;
  /** Renders the trigger in an error state, matching the form inputs. */
  invalid?: boolean;
}

export function DateField({
  id,
  value,
  onChange,
  placeholder = 'Any date',
  className,
  maxDate,
  invalid = false,
  ...rest
}: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const selected = parseISODate(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          aria-label={rest['aria-label']}
          className={cn(
            // justify-between pushes the icon to the trailing edge, where the
            // native control put it on Chrome but not on Safari or Firefox.
            'w-full justify-between font-normal text-sm h-10 px-3',
            !selected && 'text-text-muted-brown',
            invalid && 'border-destructive',
            className,
          )}
        >
          <span className="truncate">{selected ? formatHumanDate(selected) : placeholder}</span>
          <span className="ml-2 flex shrink-0 items-center gap-1">
            {selected && (
              // A native date input has no clear affordance once set, so the
              // only way back to "any date" was selecting the text and deleting.
              <span
                role="button"
                tabIndex={0}
                aria-label="Clear date"
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); onChange(''); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.stopPropagation();
                    e.preventDefault();
                    onChange('');
                  }
                }}
                className="rounded p-0.5 text-text-muted-brown hover:text-text-dark hover:bg-surface-canvas"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <CalendarIcon className="h-4 w-4 text-text-muted-brown" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          disabled={maxDate ? { after: maxDate } : undefined}
          onSelect={(d) => {
            onChange(d ? toISODate(d) : '');
            setOpen(false);
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
