/**
 * Capitalises the first letter of each word for display. Use this for crop /
 * brand / location labels, which are stored lowercase in the DB but should
 * render title-cased. It only upper-cases word-initial letters (it never
 * lower-cases the rest), so existing capitalisation like "365 Organic" or
 * acronyms are preserved. Display-only — never mutate the stored value, since
 * crop names double as matching keys.
 */
export const titleCase = (s: string | null | undefined): string =>
  (s ?? '').replace(/\b\w/g, (c) => c.toUpperCase());
