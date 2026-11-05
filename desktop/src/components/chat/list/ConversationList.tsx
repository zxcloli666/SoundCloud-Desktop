import { memo, useEffect, useState } from 'react';
import type { ConvId } from '../../../lib/chat/types';
import { useChatListStore } from '../../../stores/chat/list';
import { RequestsList } from '../requests/RequestsList';
import { ConversationRows } from './ConversationRows';
import { FilterChips } from './FilterChips';
import { ListHeader } from './ListHeader';
import { RoomRow } from './RoomRow';
import { SEARCH_MIN, SearchResults } from './SearchResults';
import { type ListVariant, useRowMenu } from './useRowMenu';

interface ConversationListProps {
  variant: ListVariant;
  selectedId: ConvId | null;
  roomSelected?: boolean;
  onOpen: (conversationId: ConvId) => void;
  onOpenRoom: () => void;
}

export const ConversationList = memo(function ConversationList({
  variant,
  selectedId,
  roomSelected = false,
  onOpen,
  onOpenRoom,
}: ConversationListProps) {
  const [query, setQuery] = useState('');
  const filter = useChatListStore((state) => state.filter);
  const load = useChatListStore((state) => state.load);
  const refresh = useChatListStore((state) => state.refresh);
  const onMenu = useRowMenu(variant);
  const searching = query.trim().length >= SEARCH_MIN;

  useEffect(() => {
    if (load === 'idle') void refresh();
  }, [load, refresh]);

  return (
    <div data-ui="chat-list" className="flex h-full min-h-0 flex-col">
      <ListHeader variant={variant} query={query} onQuery={setQuery} />
      {!searching && <FilterChips />}
      {!searching && filter === 'all' && <RoomRow selected={roomSelected} onOpen={onOpenRoom} />}
      {searching ? (
        <SearchResults query={query} onOpen={onOpen} />
      ) : filter === 'requests' ? (
        <RequestsList selectedId={selectedId} onOpen={onOpen} />
      ) : (
        <ConversationRows selectedId={selectedId} onOpen={onOpen} onMenu={onMenu} />
      )}
    </div>
  );
});
