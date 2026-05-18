import { describe, it, expect } from 'vitest';
import { canonicalJSON } from '../canonicalJSON';

describe('canonicalJSON', () => {
  it('produces the same bytes regardless of input key order', () => {
    const a = { z: 1, a: 2, m: 3 };
    const b = { m: 3, a: 2, z: 1 };
    expect(canonicalJSON(a)).toBe(canonicalJSON(b));
  });

  it('sorts keys alphabetically', () => {
    expect(canonicalJSON({ z: 1, a: 2 })).toBe('{"a":2,"z":1}');
  });

  it('recurses into nested objects', () => {
    const v = { outer: { z: 1, a: 2 }, x: { c: 3, b: 4 } };
    expect(canonicalJSON(v)).toBe('{"outer":{"a":2,"z":1},"x":{"b":4,"c":3}}');
  });

  it('preserves array order (arrays are ordered, not sorted)', () => {
    expect(canonicalJSON([3, 1, 2])).toBe('[3,1,2]');
  });

  it('sorts keys inside objects inside arrays', () => {
    expect(canonicalJSON([{ z: 1, a: 2 }])).toBe('[{"a":2,"z":1}]');
  });

  it('handles primitives unchanged', () => {
    expect(canonicalJSON('hello')).toBe('"hello"');
    expect(canonicalJSON(42)).toBe('42');
    expect(canonicalJSON(null)).toBe('null');
    expect(canonicalJSON(true)).toBe('true');
  });

  it('handles empty objects and arrays', () => {
    expect(canonicalJSON({})).toBe('{}');
    expect(canonicalJSON([])).toBe('[]');
  });

  it('is byte-identical for a realistic submission payload across two key orders', () => {
    const payload1 = {
      cropName: 'tomato',
      brixValue: 12.5,
      brandName: null,
      notes: null,
      assessmentDate: '2026-05-18T00:00:00.000Z',
      latitude: 47.5,
      longitude: 8.0,
    };
    const payload2 = {
      longitude: 8.0,
      latitude: 47.5,
      assessmentDate: '2026-05-18T00:00:00.000Z',
      notes: null,
      brandName: null,
      brixValue: 12.5,
      cropName: 'tomato',
    };
    expect(canonicalJSON(payload1)).toBe(canonicalJSON(payload2));
  });
});
