import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { chatBridge } from '../../../lib/chat/bridge';
import type { ConversationPage, ConversationSummary } from '../../../lib/chat/types';
import { foldName } from '../../../lib/track-display';
import { useChatListStore } from '../../../stores/chat/list';
import { useTogetherStore } from '../../../stores/together';

const LIST_LIMIT = 60;
const LIST_STALE_MS = 15_000;
const ROOM_STALE_MS = 60_000;

function canReceive(conversation: ConversationSummary): boolean {
  return conversation.state === 'active' && conversation.accepted && conversation.kind !== 'room';
}

function cachedPage(): ConversationPage | undefined {
  const items = useChatListStore.getState().items;
  return items.length > 0 ? { items, nextCursor: null } : undefined;
}

export interface ShareTargets {
  items: ConversationSummary[];
  loading: boolean;
  failed: boolean;
}

export function useShareTargets(
  search: string,
  titleOf: (conversation: ConversationSummary) => string,
): ShareTargets {
  const roomCode = useTogetherStore((s) => s.room?.code ?? null);
  const list = useQuery({
    queryKey: ['chat', 'share-targets'],
    queryFn: () => chatBridge.list({ filter: 'all', limit: LIST_LIMIT }),
    staleTime: LIST_STALE_MS,
    placeholderData: cachedPage,
  });
  const room = useQuery({
    queryKey: ['chat', 'share-room', roomCode],
    queryFn: () => chatBridge.roomChat(roomCode ?? ''),
    enabled: !!roomCode,
    staleTime: ROOM_STALE_MS,
    retry: false,
  });
  const roomChat = roomCode ? (room.data ?? null) : null;

  const items = useMemo(() => {
    const listed = (list.data?.items ?? []).filter(canReceive);
    const all = roomChat ? [roomChat, ...listed.filter((c) => c.id !== roomChat.id)] : listed;
    const needle = foldName(search.trim());
    if (!needle) return all;
    return all.filter((conversation) => foldName(titleOf(conversation)).includes(needle));
  }, [list.data, roomChat, search, titleOf]);

  return {
    items,
    loading: list.isPending,
    failed: list.isError && !list.data,
  };
}
