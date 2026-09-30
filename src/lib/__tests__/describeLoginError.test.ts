import { describe, it, expect } from 'vitest';
import { describeLoginError } from '../describeLoginError';

describe('describeLoginError', () => {
  it.each(['Failed to fetch', 'NetworkError when attempting to fetch resource.', 'Load failed'])(
    'treats %s as a connectivity problem',
    (raw) => {
      expect(describeLoginError(raw).title).toBe("We can't reach BRIXit right now");
    },
  );

  it('treats 5xx as a server problem', () => {
    expect(describeLoginError('HTTP 503').title).toBe('Our sign-in service is having trouble');
  });

  it('treats 4xx and expiry as an expired code', () => {
    expect(describeLoginError('HTTP 410').title).toBe('Your sign-in code expired');
    expect(describeLoginError('Session expired').title).toBe('Your sign-in code expired');
  });

  it('maps config and profile errors', () => {
    expect(describeLoginError('Configuration error: VITE_SERVER_PUBLIC_KEY is not set').title)
      .toBe("Sign-in isn't available right now");
    expect(describeLoginError('Unable to retrieve wallet profile data.').title)
      .toBe("We couldn't read your profile from Mycelia");
  });

  it('falls back to a generic message', () => {
    expect(describeLoginError('Authentication failed. Please try again.').title).toBe("We couldn't sign you in");
    expect(describeLoginError(null).title).toBe("We couldn't sign you in");
  });
});
