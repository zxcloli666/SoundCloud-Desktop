import { chatErrorKey } from '../../../lib/chat/errors';

const KNOWN: ReadonlySet<string> = new Set([
  'unavailable',
  'request_limit',
  'too_young',
  'send_limited',
  'busy',
  'offline',
  'disabled',
  'send_paused',
  'muted',
  'not_member',
  'slow_mode',
]);

export function listErrorKey(error: unknown): string {
  return chatErrorKey(error, 'list', KNOWN);
}
