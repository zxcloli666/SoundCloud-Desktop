import { type MouseEvent, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Archive, BellOff, CheckCheck } from '../../../lib/chat/icons';
import type { ConversationSummary } from '../../../lib/chat/types';
import { Ban, Bell, Fullscreen, PictureInPicture2, Pin, Trash2 } from '../../../lib/icons';
import { useChatPrefsStore } from '../../../stores/chat/prefs';
import { type ContextMenuEntry, openContextMenu } from '../../../stores/context-menu';
import { chatPath } from '../shell/useOpenChat';
import { openDeleteChat } from './delete-chat-store';
import { isMuted, muteForHours } from './mute';
import { blockUser, markRead, patchMine } from './row-actions';

export type ListVariant = 'page' | 'dock';

const ICON = 14;

export function useRowMenu(variant: ListVariant) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return useCallback(
    (event: Pick<MouseEvent, 'clientX' | 'clientY' | 'preventDefault'>, c: ConversationSummary) => {
      const now = Date.now();
      const muted = isMuted(c, now);
      const open: ContextMenuEntry =
        variant === 'page'
          ? {
              id: 'dock',
              label: t('chat.list.menu.openDock'),
              icon: <PictureInPicture2 size={ICON} />,
              onSelect: () => useChatPrefsStore.getState().openInDock(c.id),
            }
          : {
              id: 'page',
              label: t('chat.list.menu.openPage'),
              icon: <Fullscreen size={ICON} />,
              onSelect: () => navigate(chatPath(c.id)),
            };
      const mute: ContextMenuEntry[] = muted
        ? [
            {
              id: 'unmute',
              label: t('chat.list.menu.unmute'),
              icon: <Bell size={ICON} />,
              onSelect: () => void patchMine(c.id, { mute: { kind: 'off' }, notify: 'all' }),
            },
          ]
        : [
            {
              id: 'mute1',
              label: t('chat.list.menu.mute1h'),
              icon: <BellOff size={ICON} />,
              onSelect: () => void patchMine(c.id, { mute: muteForHours(1, now) }),
            },
            {
              id: 'mute8',
              label: t('chat.list.menu.mute8h'),
              icon: <BellOff size={ICON} />,
              onSelect: () => void patchMine(c.id, { mute: muteForHours(8, now) }),
            },
            {
              id: 'muteForever',
              label: t('chat.list.menu.muteForever'),
              icon: <BellOff size={ICON} />,
              onSelect: () => void patchMine(c.id, { mute: { kind: 'forever' } }),
            },
          ];
      const peer = c.kind === 'direct' ? c.peer : null;
      const entries: ContextMenuEntry[] = [
        open,
        {
          id: 'pin',
          label: t(c.pinnedAt === null ? 'chat.list.menu.pin' : 'chat.list.menu.unpin'),
          icon: <Pin size={ICON} />,
          onSelect: () => void patchMine(c.id, { pinned: c.pinnedAt === null }),
        },
        ...(c.unread > 0
          ? [
              {
                id: 'read',
                label: t('chat.list.menu.read'),
                icon: <CheckCheck size={ICON} />,
                onSelect: () => void markRead(c),
              },
            ]
          : []),
        'separator',
        ...mute,
        {
          id: 'archive',
          label: t(c.archived ? 'chat.list.menu.unarchive' : 'chat.list.menu.archive'),
          icon: <Archive size={ICON} />,
          onSelect: () => void patchMine(c.id, { archived: !c.archived }),
        },
        'separator',
        ...(peer
          ? [
              {
                id: 'block',
                label: t('chat.list.menu.block'),
                icon: <Ban size={ICON} />,
                onSelect: () => void blockUser(peer),
              },
            ]
          : []),
        {
          id: 'delete',
          label: t('chat.list.menu.delete'),
          icon: <Trash2 size={ICON} />,
          onSelect: () => openDeleteChat(c),
        },
      ];
      openContextMenu(event, entries);
    },
    [navigate, t, variant],
  );
}
