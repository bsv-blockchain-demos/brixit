import * as React from 'react';
import { Textarea } from './textarea';
import { cn } from '@/lib/utils';

interface CountedTextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  max: number;
}

/**
 * Controlled `<Textarea>` with a character counter underneath. Hard-caps input
 * at `max` via the native `maxLength` attribute; counter color shifts to gold
 * near the limit and destructive at the limit.
 */
export const CountedTextarea = React.forwardRef<HTMLTextAreaElement, CountedTextareaProps>(
  function CountedTextarea({ value, onChange, max, className, ...rest }, ref) {
    const overOrAt = value.length >= max;
    const near = value.length / max >= 0.9;
    const counterClass = overOrAt
      ? 'text-destructive'
      : near
      ? 'text-[var(--gold)]'
      : 'text-muted-foreground';

    return (
      <div>
        <Textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={max}
          className={className}
          {...rest}
        />
        <div className={cn('text-xs mt-1 text-right tabular-nums', counterClass)}>
          {value.length}/{max}
        </div>
      </div>
    );
  },
);
