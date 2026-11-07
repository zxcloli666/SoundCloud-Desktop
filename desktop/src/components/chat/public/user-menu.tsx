import type { TFunction } from 'i18next';
import {
  type ConversationSummary,
  type Member,
  PUBLIC_MUTE_SECONDS,
  type UserId,
  type UserRef,
} from '../../../lib/chat/types';
import { Ban } from '../../../lib/icons';
import { sanctionOf, usePublicStore } from '../../../stores/chat/public';
import { type ContextMenuEntry, openContextMenu } from '../../../stores/context-menu';
import { Avatar } from '../../ui/Avatar';
import { MicOff, ShieldMinus, ShieldPlus } from '../room/icons';
import { useThreadDialogs } from '../thread/dialogs';
import { canSanction } from '../thread/permissions';
import { durationLabel, setModerator, unbanUser, unmuteUser } from './actions';
import { Mic, UserCheck } from './icons';

type MenuEvent = Pick<MouseEvent, 'clientX' | 'clientY' | 'preventDefault'>;

export function publicUserEntries(
  user: UserRef,
  conversation: ConversationSummary,
  me: UserId | null,
  staff: Member[],
  t: TFunction,
): ContextMenuEntry[] {
  if (!canSanction(conversation, user.id, me, staff)) return [];
  const dialogs = useThreadDialogs.getState();
  const known = sanctionOf(usePublicStore.getState(), user.id);
  const muted = known.mutedUntil !== null && known.mutedUntil > Date.now();
  const entries: ContextMenuEntry[] = [];
  if (muted) {
    entries.push({
      id: 'unmute',
      label: t('chat.public.menu.unmute'),
      icon: <Mic size={14} />,
      onSelect: () => void unmuteUser(user),
    });
  } else {
    for (const seconds of PUBLIC_MUTE_SECONDS) {
      entries.push({
        id: `mute-${seconds}`,
        label: t('chat.public.menu.mute', { duration: durationLabel(seconds) }),
        icon: <MicOff size={14} />,
        onSelect: () =>
          dialogs.open({ kind: 'public-mute', conversationId: conversation.id, user, seconds }),
      });
    }
  }
  if (known.banned) {
    entries.push({
      id: 'unban',
      label: t('chat.public.menu.unban'),
      icon: <UserCheck size={14} />,
      onSelect: () => void unbanUser(user),
    });
  } else {
    entries.push({
      id: 'ban',
      label: t('chat.public.menu.ban'),
      icon: <Ban size={14} />,
      onSelect: () => dialogs.open({ kind: 'public-ban', conversationId: conversation.id, user }),
    });
  }
  if (conversation.role === 'owner') {
    const moderator = staff.some((member) => member.user.id === user.id && member.role === 'admin');
    entries.push('separator', {
      id: 'moderator',
      label: t(moderator ? 'chat.public.menu.dropModerator' : 'chat.public.menu.makeModerator'),
      icon: moderator ? <ShieldMinus size={14} /> : <ShieldPlus size={14} />,
      onSelect: () => void setModerator(conversation.id, user, !moderator),
    });
  }
  return entries;
}

export function openPublicUserMenu(
  event: MenuEvent,
  user: UserRef,
  conversation: ConversationSummary,
  me: UserId | null,
  staff: Member[],
  t: TFunction,
) {
  const entries = publicUserEntries(user, conversation, me, staff, t);
  if (entries.length === 0) return;
  openContextMenu(
    event,
    entries,
    <div className="flex items-center gap-2.5 px-2.5 pt-1.5 pb-2">
      <Avatar src={user.avatarUrl} alt="" size={28} />
      <span className="min-w-0 truncate text-[13px] font-semibold text-ink-90">{user.name}</span>
    </div>,
  );
}
