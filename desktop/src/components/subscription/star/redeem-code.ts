import { PayError } from '../../../lib/pay-client';

/** STAR redeem code "STAR-XXXX-XXXX-XXXX-XXXX" or invite "JOIN-XXXX-XXXX-XXXX" (pure helpers). */
export const CODE_RE: Record<CodeKind, RegExp> = {
  star: /^STAR(-[0-9A-Z]{4}){4}$/,
  join: /^JOIN(-[0-9A-Z]{4}){3}$/,
};

export type CodeKind = 'star' | 'join';

export const BODY_LEN: Record<CodeKind, number> = { star: 16, join: 12 };

/**
 * Strip to alphanumerics and split the prefix off. "JOIN" marks a Duo/Family
 * invite (the redeem alphabet has no I or O, so no STAR body can start with it).
 */
export function parseCode(raw: string): { kind: CodeKind; body: string } {
  const s = raw.toUpperCase().replace(/[^0-9A-Z]/g, '');
  if (s.startsWith('JOIN')) return { kind: 'join', body: s.slice(4, 4 + BODY_LEN.join) };
  const body = s.startsWith('STAR') ? s.slice(4) : s;
  return { kind: 'star', body: body.slice(0, BODY_LEN.star) };
}

/** body → "STAR-XXXX-XXXX-XXXX-XXXX" / "JOIN-XXXX-XXXX-XXXX" with progressive dashes. */
export function formatCode(kind: CodeKind, body: string): string {
  const groups = body.match(/.{1,4}/g) ?? [];
  return [kind === 'join' ? 'JOIN' : 'STAR', ...groups].join('-');
}

/** Map a redeem error to its i18n key. */
export function redeemErrorKey(err: unknown): string {
  if (err instanceof PayError) {
    switch (err.status) {
      case 409:
        return 'starpass.redeem.errUsed';
      case 404:
        return 'starpass.redeem.errUnknown';
      case 403:
        return 'starpass.redeem.errRevoked';
      case 400:
        return 'starpass.redeem.errExpired';
    }
  }
  return 'starpass.redeem.errGeneric';
}
