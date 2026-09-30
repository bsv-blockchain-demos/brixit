/**
 * Turns a raw Mycelia login error (fetch failures, relay HTTP codes, auth
 * flow throws) into user-facing copy: what happened, and what to do next.
 * The raw message is kept separately for the "technical details" disclosure.
 */
export interface LoginErrorCopy {
  title: string;
  description: string;
  /** Short, actionable next steps. */
  tips: string[];
  /** Connectivity problem (show an offline icon rather than a generic alert). */
  offline: boolean;
}

const NETWORK_ERROR = /failed to fetch|networkerror|load failed|network request failed/i;

export function describeLoginError(raw: string | null | undefined): LoginErrorCopy {
  const message = raw ?? '';

  if (NETWORK_ERROR.test(message)) {
    return {
      title: "We can't reach BRIXit right now",
      description:
        "Your browser couldn't connect to our sign-in service, so we couldn't create a code for you to scan.",
      tips: [
        'Check that you are connected to the internet.',
        'On a work or school network? A firewall or VPN may be blocking the connection.',
        'Wait a moment, then try again.',
      ],
      offline: true,
    };
  }

  const http = message.match(/HTTP (\d{3})/);
  if (http && Number(http[1]) >= 500) {
    return {
      title: 'Our sign-in service is having trouble',
      description: "This one is on our side, not yours. It's usually back within a few minutes.",
      tips: ['Try again in a minute or two.'],
      offline: false,
    };
  }

  if (/expired/i.test(message) || (http && Number(http[1]) >= 400)) {
    return {
      title: 'Your sign-in code expired',
      description: 'Codes only last a few minutes to keep your account safe.',
      tips: ['Generate a new code and scan it with Mycelia straight away.'],
      offline: false,
    };
  }

  if (/configuration error/i.test(message)) {
    return {
      title: "Sign-in isn't available right now",
      description: "BRIXit isn't set up correctly to accept Mycelia sign-ins at the moment.",
      tips: ['Please try again later, or let us know if it keeps happening.'],
      offline: false,
    };
  }

  if (/profile data/i.test(message)) {
    return {
      title: "We couldn't read your profile from Mycelia",
      description: 'Mycelia connected, but it did not share the details BRIXit needs to sign you in.',
      tips: [
        'In Mycelia, approve every request that appears after scanning.',
        'Make sure Mycelia is up to date, then try again.',
      ],
      offline: false,
    };
  }

  return {
    title: "We couldn't sign you in",
    description: 'Something interrupted the connection between BRIXit and Mycelia.',
    tips: [
      'Keep Mycelia open until this page moves on.',
      'Approve the connection request in Mycelia when it appears.',
      'Try again with a fresh code.',
    ],
    offline: false,
  };
}
