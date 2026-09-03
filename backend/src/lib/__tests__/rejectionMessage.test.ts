import { describe, it, expect } from 'vitest';
import { validateRejectionMessage } from '../rejectionMessage.js';

describe('validateRejectionMessage', () => {
  it('returns the trimmed message', () => {
    expect(validateRejectionMessage('  too high for this crop  ')).toBe('too high for this crop');
  });

  it('accepts a message with internal whitespace and newlines', () => {
    expect(validateRejectionMessage('line one\nline two')).toBe('line one\nline two');
  });

  it.each([
    ['empty string', ''],
    ['spaces only', '   '],
    ['tabs and newlines only', '\t\n  '],
    ['undefined', undefined],
    ['null', null],
    ['a number', 42],
    ['an object', { message: 'nope' }],
  ])('rejects %s', (_label, input) => {
    expect(validateRejectionMessage(input)).toBeNull();
  });
});
