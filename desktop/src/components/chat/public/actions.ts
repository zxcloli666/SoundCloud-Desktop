import { toast } from 'sonner';
import i18n from '../../../i18n';
import { chatBridge } from '../../../lib/chat/bridge';
import { chatErrorKey } from '../../../lib/chat/errors';
import { shortDate } from '../../../lib/chat/time';
import type { ConvId, UserRef } from '../../../lib/chat/types';
import { notifyError } from '../../../lib/notify';
import { useChatListStore } from '../../../stores/chat/list';
import { usePublicStore } from '../../../stores/chat/public';
import { useChatThreadStore } from '../../../stores/chat/thread';

const KNOWN: ReadonlySet<string> = new Set([
  'not_member',
  'not_found',
  'invalid',
  'busy',
  'offline',
  'disabled',
  'send_limited',
]);

function fail(error: unknown) {
  notifyError(i18n.t(chatErrorKey(error, 'public', KNOWN)));
}

async function attempt(task: () => Promise<void>): Promise<boolean> {
  try {
    await task();
    return true;
  } catch (error) {
    fail(error);
    return false;
  }
}

export function durationLabel(seconds: number): string {
  if (seconds % 3600 === 0) return i18n.t('chat.public.duration.hours', { count: seconds / 3600 });
  if (seconds % 60 === 0) return i18n.t('chat.public.duration.minutes', { count: seconds / 60 });
  return i18n.t('chat.public.duration.seconds', { count: seconds });
}

export function muteUser(user: UserRef, seconds: number, reason: string | null) {
  return attempt(async () => {
    const until = await chatBridge.publicMute(user.id, seconds, reason);
    usePublicStore.getState().noteSanction(user.id, { mutedUntil: until });
    toast(
      i18n.t('chat.public.toast.muted', {
        name: user.name,
        time: shortDate(until, Date.now(), i18n.language),
      }),
    );
  });
}

export function unmuteUser(user: UserRef) {
  return attempt(async () => {
    await chatBridge.publicUnmute(user.id);
    usePublicStore.getState().noteSanction(user.id, { mutedUntil: null });
    toast(i18n.t('chat.public.toast.unmuted', { name: user.name }));
  });
}

export function banUser(user: UserRef, reason: string | null) {
  return attempt(async () => {
    await chatBridge.publicBan(user.id, reason);
    usePublicStore.getState().noteSanction(user.id, { banned: true, mutedUntil: null });
    toast(i18n.t('chat.public.toast.banned', { name: user.name }));
  });
}

export function unbanUser(user: UserRef) {
  return attempt(async () => {
    await chatBridge.publicUnban(user.id);
    usePublicStore.getState().noteSanction(user.id, { banned: false });
    toast(i18n.t('chat.public.toast.unbanned', { name: user.name }));
  });
}

export function setModerator(conversationId: ConvId, user: UserRef, on: boolean) {
  return attempt(async () => {
    await chatBridge.publicModerator(user.id, on);
    await useChatThreadStore.getState().loadMembers(conversationId);
    toast(
      i18n.t(on ? 'chat.public.toast.moderatorOn' : 'chat.public.toast.moderatorOff', {
        name: user.name,
      }),
    );
  });
}

export function setSlowMode(conversationId: ConvId, seconds: number) {
  return attempt(async () => {
    const summary = await chatBridge.publicSlowMode(conversationId, seconds);
    useChatThreadStore.getState().setConversation(summary);
    useChatListStore.getState().upsert(summary);
    toast(
      seconds > 0
        ? i18n.t('chat.public.toast.slow', { value: durationLabel(seconds) })
        : i18n.t('chat.public.toast.slowOff'),
    );
  });
}
