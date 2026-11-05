import type { TFunction } from 'i18next';
import type { Device, Millis } from '../../../../lib/chat/types';
import { AGE_RULE_MS } from '../../../../stores/chat/devices';
import { spanText } from '../../devices/time';

export function grownIn(me: Device | undefined, now: Millis): number {
  return me ? Math.max(0, me.createdAt + AGE_RULE_MS - now) : 0;
}

export function removeHint(t: TFunction, me: Device | undefined, now: Millis): string | undefined {
  const wait = grownIn(me, now);
  return wait > 0 ? t('chat.devices.list.lockedFor', { span: spanText(t, wait) }) : undefined;
}

export function confirmHint(
  t: TFunction,
  device: Device,
  me: Device | undefined,
  now: Millis,
): string | undefined {
  if (me && device.createdAt < me.createdAt) return t('chat.devices.list.olderOnly');
  return removeHint(t, me, now);
}
