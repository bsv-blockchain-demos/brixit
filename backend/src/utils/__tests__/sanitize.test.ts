import { describe, it, expect } from 'vitest';
import { sanitizeInput, fixPrecision, parseAddressString, createHumanReadableLabel } from '../sanitize.js';

// ---------------------------------------------------------------------------
// sanitizeInput
// ---------------------------------------------------------------------------
describe('sanitizeInput', () => {
  it('returns null for null', () => expect(sanitizeInput(null)).toBeNull());
  it('returns null for undefined', () => expect(sanitizeInput(undefined)).toBeNull());
  it('returns null for a number', () => expect(sanitizeInput(42)).toBeNull());
  it('returns null for an object', () => expect(sanitizeInput({})).toBeNull());

  it('returns null for an empty string', () => expect(sanitizeInput('')).toBeNull());
  it('returns null for a whitespace-only string', () => expect(sanitizeInput('   ')).toBeNull());

  it('trims surrounding whitespace', () => expect(sanitizeInput('  hello  ')).toBe('hello'));

  it('strips NUL control character', () => expect(sanitizeInput('hel\u0000lo')).toBe('hello'));
  it('strips unit separator (\\u001F)', () => expect(sanitizeInput('hel\u001Flo')).toBe('hello'));
  it('strips DEL character (\\u007F)', () => expect(sanitizeInput('hel\u007Flo')).toBe('hello'));

  it('strips < and > (HTML injection)', () => {
    expect(sanitizeInput('<script>alert(1)</script>')).toBe('scriptalert(1)/script');
  });
  it('strips < and > but preserves quotes in mixed input', () => {
    expect(sanitizeInput('<b>O\'Brien\'s</b>')).toBe("O'Brien's");
  });
  it('preserves double quotes (legitimate in text, Prisma parameterises)', () => expect(sanitizeInput('"quoted"')).toBe('"quoted"'));
  it("preserves single quotes (e.g. O'Brien's Farm)", () => expect(sanitizeInput("O'Brien's Farm")).toBe("O'Brien's Farm"));
  it('strips backticks (shell injection vector)', () => expect(sanitizeInput('back`tick')).toBe('backtick'));
  it('strips backslash (escape injection vector)', () => expect(sanitizeInput('back\\slash')).toBe('backslash'));

  it('strips SQL wildcard %', () => expect(sanitizeInput('100%')).toBe('100'));
  it('preserves underscores (used in crop/brand names like bell_pepper)', () => expect(sanitizeInput('col_name')).toBe('col_name'));

  it('strips javascript: protocol (lowercase)', () => {
    expect(sanitizeInput('javascript:alert(1)')).toBe('alert(1)');
  });
  it('strips JAVASCRIPT: protocol (uppercase)', () => {
    expect(sanitizeInput('JAVASCRIPT:alert(1)')).toBe('alert(1)');
  });
  it('strips data: protocol', () => {
    expect(sanitizeInput('data:text/html,hi')).toBe('text/html,hi');
  });

  it('collapses multiple spaces into one', () => {
    expect(sanitizeInput('hello   world')).toBe('hello world');
  });

  it('passes through a clean string unchanged', () => {
    expect(sanitizeInput('Organic Valley')).toBe('Organic Valley');
  });

  it('passes through numbers and hyphens', () => {
    expect(sanitizeInput('US-123')).toBe('US-123');
  });
});

// ---------------------------------------------------------------------------
// fixPrecision
// ---------------------------------------------------------------------------
describe('fixPrecision', () => {
  it('rounds down at the 7th decimal place', () => {
    expect(fixPrecision(1.1234561)).toBe(1.123456);
  });
  it('rounds up at the 7th decimal place', () => {
    expect(fixPrecision(1.1234567)).toBe(1.123457);
  });
  it('leaves an integer unchanged', () => {
    expect(fixPrecision(10)).toBe(10);
  });
  it('handles negative coordinates', () => {
    expect(fixPrecision(-97.1234567)).toBe(-97.123457);
  });
  it('handles zero', () => {
    expect(fixPrecision(0)).toBe(0);
  });
  it('does not alter exactly 6 decimal places', () => {
    expect(fixPrecision(1.123456)).toBe(1.123456);
  });
});

// ---------------------------------------------------------------------------
// parseAddressString
// ---------------------------------------------------------------------------
describe('parseAddressString', () => {
  it('parses a 4-part address', () => {
    const r = parseAddressString('123 Main St, Austin, TX, USA');
    expect(r.street_address).toBe('123 Main St');
    expect(r.city).toBe('Austin');
    expect(r.state).toBe('TX');
    expect(r.country).toBe('USA');
  });

  it('parses a 3-part address (city, state, country — no street)', () => {
    const r = parseAddressString('Austin, TX, USA');
    expect(r.street_address).toBeNull();
    expect(r.city).toBe('Austin');
    expect(r.state).toBe('TX');
    expect(r.country).toBe('USA');
  });

  it('returns street_address for a single-part string', () => {
    const r = parseAddressString('123 Main St');
    expect(r.street_address).toBe('123 Main St');
    expect(r.city).toBeUndefined();
  });

  it('trims whitespace from each part', () => {
    const r = parseAddressString(' Austin , TX , USA ');
    expect(r.city).toBe('Austin');
    expect(r.state).toBe('TX');
    expect(r.country).toBe('USA');
  });

  it('handles empty parts as null', () => {
    const r = parseAddressString('123 Main, , TX, USA');
    expect(r.street_address).toBe('123 Main');
    expect(r.city).toBeNull();
    expect(r.state).toBe('TX');
  });
});

// ---------------------------------------------------------------------------
// createHumanReadableLabel
// ---------------------------------------------------------------------------
describe('createHumanReadableLabel', () => {
  it('returns store_name when present (highest priority)', () => {
    expect(createHumanReadableLabel({ store_name: 'Whole Foods', city: 'Austin' })).toBe('Whole Foods');
  });

  it('returns business_name when no store_name', () => {
    expect(createHumanReadableLabel({ business_name: 'Happy Farm', city: 'Austin' })).toBe('Happy Farm');
  });

  it('returns poi_name when no store or business name', () => {
    expect(createHumanReadableLabel({ poi_name: 'Farmers Market', city: 'Austin' })).toBe('Farmers Market');
  });

  it('builds an address label from parts when no named place', () => {
    const r = createHumanReadableLabel({ street_address: '123 Main', city: 'Austin', state: 'TX' });
    expect(r).toBe('123 Main, Austin, TX');
  });

  it('excludes "United States" from the address label', () => {
    const r = createHumanReadableLabel({ city: 'Austin', state: 'TX', country: 'United States' });
    expect(r).toBe('Austin, TX');
    expect(r).not.toContain('United States');
  });

  it('includes non-US countries in the address label', () => {
    const r = createHumanReadableLabel({ city: 'Toronto', state: 'ON', country: 'Canada' });
    expect(r).toContain('Canada');
  });

  it('skips street_address that already contains a comma', () => {
    // Streets like "123 Main, Suite 4" are pre-formatted — don't double-print
    const r = createHumanReadableLabel({ street_address: '123 Main, Suite 4', city: 'Austin' });
    expect(r).toBe('Austin');
  });

  it('falls back to locationName when no address parts available', () => {
    expect(createHumanReadableLabel({ locationName: 'Farm Stand' })).toBe('Farm Stand');
  });

  it('falls back to "Unknown Location" when nothing is provided', () => {
    expect(createHumanReadableLabel({})).toBe('Unknown Location');
  });
});
