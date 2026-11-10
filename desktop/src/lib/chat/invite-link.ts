const INVITE_PREFIX = 'scd://invite?token=';
const TOKEN = /^[A-Za-z0-9_-]{16,128}$/;

export function inviteToken(link: string): string | null {
  if (!link.toLowerCase().startsWith(INVITE_PREFIX)) return null;
  try {
    const token = decodeURIComponent(link.slice(INVITE_PREFIX.length));
    return TOKEN.test(token) ? token : null;
  } catch {
    return null;
  }
}
