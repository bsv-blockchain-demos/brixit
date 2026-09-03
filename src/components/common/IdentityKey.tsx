import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

/**
 * Collapse the middle of a long hex key so both ends stay readable.
 * Returns the value untouched when it is already short enough that
 * truncating would not save any characters.
 */
export function truncateKey(value: string, head = 16, tail = 16): string {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

interface IdentityKeyProps {
  value: string | null | undefined;
  /** Leading characters kept. */
  head?: number;
  /** Trailing characters kept. */
  tail?: number;
  /** Names the value in the toast, e.g. "Identity key copied". */
  label?: string;
  /** Rendered when there is no value. */
  fallback?: React.ReactNode;
  className?: string;
}

/**
 * A middle-truncated key with an inline copy button.
 *
 * Copying confirms twice: the icon flips to a check for a moment (inline,
 * next to the thing you clicked) and a sonner toast fires (global, and
 * survives the popover this often sits inside being dismissed).
 */
export function IdentityKey({
  value,
  head = 16,
  tail = 16,
  label = 'Identity key',
  fallback = <span className="italic">no wallet identity</span>,
  className,
}: IdentityKeyProps) {
  const [copied, setCopied] = useState(false);

  if (!value) return <>{fallback}</>;

  const handleCopy = async (e: React.MouseEvent) => {
    // These often sit inside a clickable row or a menu item; copying should
    // not also navigate or dismiss the parent.
    e.stopPropagation();
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast.success(`${label} copied`);
    } catch {
      toast.error(`Could not copy ${label.toLowerCase()}`);
    }
  };

  return (
    <span className={cn('inline-flex items-center gap-2 min-w-0', className)}>
      <code className="flex-1 min-w-0 truncate text-xs font-mono" title={value}>
        {truncateKey(value, head, tail)}
      </code>
      <button
        type="button"
        onClick={handleCopy}
        className="shrink-0 p-1 rounded hover:bg-accent transition-colors"
        aria-label={`Copy ${label.toLowerCase()}`}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-green-fresh" />
        ) : (
          <Copy className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>
    </span>
  );
}
