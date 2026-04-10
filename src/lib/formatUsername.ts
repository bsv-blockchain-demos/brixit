const MAX_USERNAME_LENGTH = 20;

/**
 * Truncates long usernames (e.g. identity keys used as anonymous display names)
 * to `first4...last4` format. Short names are returned unchanged.
 */
export function formatUsername(username: string): string {
  if (username.length <= MAX_USERNAME_LENGTH) return username;
  return `${username.slice(0, 4)}...${username.slice(-4)}`;
}
