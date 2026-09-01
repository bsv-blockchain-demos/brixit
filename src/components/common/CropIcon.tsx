import React, { useMemo, useState } from 'react';
import { Sprout } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CROP_ICON_SLUGS } from '@/lib/cropIconManifest';

/**
 * The crop's icon, from openfarmcc/open-crop-icons (CC0-1.0).
 *
 * The SVGs live in public/crop-icons rather than the bundle: there are 247 of
 * them and a page shows a handful, so the browser should fetch only those.
 * CROP_ICON_SLUGS mirrors that directory so matching is a synchronous lookup
 * instead of a request that might 404.
 *
 * Crop names come from the database and will not always be a slug in the set,
 * so resolveCropIcon widens gradually and gives up rather than guessing badly.
 * Anything unmatched falls back to a sprout, which is honest about being a
 * placeholder.
 */

const SLUGS = new Set(CROP_ICON_SLUGS);

/** Hand-checked cases where slugifying alone lands on nothing, or on the wrong
 *  plant. "Grape" has no icon in the set; leaves rather than mislabel it. */
const ALIASES: Record<string, string> = {
  courgette: 'zucchini',
  aubergine: 'eggplant',
  capsicum: 'bell-pepper',
  rocket: 'arugula',
  coriander: 'cilantro',
  maize: 'corn',
  'spring-onion': 'scallion',
  'green-onion': 'scallion',
  mangetout: 'snow-pea',
  swede: 'rutabaga',
  silverbeet: 'swiss-chard',
  chard: 'swiss-chard',
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function resolveCropIcon(name: string | null | undefined): string | null {
  if (!name) return null;
  const slug = slugify(name);
  if (!slug) return null;

  if (SLUGS.has(slug)) return slug;
  if (ALIASES[slug] && SLUGS.has(ALIASES[slug])) return ALIASES[slug];
  if (SLUGS.has(`generic-${slug}`)) return `generic-${slug}`;

  // "kale" should reach curly-kale, but only when one variety is unambiguous
  // enough to stand for the crop: prefer the shortest match so "kale" picks
  // curly-kale over red-russian-kale.
  const suffixed = CROP_ICON_SLUGS.filter((s) => s.endsWith(`-${slug}`));
  if (suffixed.length > 0) {
    return suffixed.reduce((a, b) => (a.length <= b.length ? a : b));
  }

  return null;
}

export function CropIcon({
  name,
  className,
}: {
  name: string | null | undefined;
  className?: string;
}) {
  const slug = useMemo(() => resolveCropIcon(name), [name]);
  const [failed, setFailed] = useState(false);

  const box = cn('inline-block shrink-0 h-4 w-4 align-[-0.15em]', className);

  if (!slug || failed) {
    return <Sprout aria-hidden="true" className={cn(box, 'text-text-muted-brown')} />;
  }

  return (
    <img
      src={`/crop-icons/${slug}.svg`}
      // Decorative: the crop name is always rendered next to it.
      alt=""
      aria-hidden="true"
      loading="lazy"
      onError={() => setFailed(true)}
      className={box}
    />
  );
}
