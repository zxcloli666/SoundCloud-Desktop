import { memo } from 'react';
import type { ConvId } from '../../../lib/chat/types';
import { useChatListStore } from '../../../stores/chat/list';
import { ListEmpty, ListFailed, ListSkeleton } from '../list/ListEmpty';
import { RequestRow } from './RequestRow';

interface RequestsListProps {
  selectedId: ConvId | null;
  onOpen: (conversationId: ConvId) => void;
}

export const RequestsList = memo(function RequestsList({ selectedId, onOpen }: RequestsListProps) {
  const items = useChatListStore((state) => state.requestItems);
  const load = useChatListStore((state) => state.load);
  const refresh = useChatListStore((state) => state.refresh);

  if (items.length === 0) {
    if (load === 'loading' || load === 'idle') return <ListSkeleton rows={3} />;
    if (load === 'failed') return <ListFailed onRetry={() => void refresh()} />;
    return <ListEmpty kind="requests" />;
  }

  return (
    <div data-ui="chat-requests" className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-3">
      {items.map((request) => (
        <RequestRow
          key={request.conversation.id}
          request={request}
          selected={request.conversation.id === selectedId}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
});
