import { chatErrorKey } from '../../../lib/chat/errors';

const KNOWN: ReadonlySet<string> = new Set([
  'too_young',
  'not_found',
  'offline',
  'busy',
  'device_revoked',
  'disabled',
]);

export function deviceErrorKey(error: unknown): string {
  return chatErrorKey(error, 'devices', KNOWN);
}
