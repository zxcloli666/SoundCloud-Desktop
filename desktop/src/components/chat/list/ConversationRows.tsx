import { useVirtualizer } from '@tanstack/react-virtual';
import { memo, useEffect, useRef } from 'react';
import type { ConvId } from '../../../lib/chat/types';
import { useChatListStore } from '../../../stores/chat/list';
import { ConversationRow, ROW_HEIGHT, type RowMenu } from './ConversationRow';
import { ListEmpty, ListFailed, ListSkeleton } from './ListEmpty';
import { useScrollGuard } from './useScrollGuard';

const LOAD_AHEAD = 20;

interface ConversationRowsProps {
  selectedId: ConvId | null;
  onOpen: (conversationId: ConvId) => void;
  onMenu: RowMenu;
}

export const ConversationRows = memo(function ConversationRows({
  selectedId,
  onOpen,
  onMenu,
}: ConversationRowsProps) {
  const items = useChatListStore((state) => state.items);
  const load = useChatListStore((state) => state.load);
  const filter = useChatListStore((state) => state.filter);
  const loadMore = useChatListStore((state) => state.loadMore);
  const refresh = useChatListStore((state) => state.refresh);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const hasItems = items.length > 0;

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
    getItemKey: (index) => items[index].id,
  });
  const rows = virtualizer.getVirtualItems();
  const lastIndex = rows.length > 0 ? rows[rows.length - 1].index : -1;

  useScrollGuard(scrollRef, contentRef, hasItems);

  useEffect(() => {
    if (hasItems && lastIndex >= items.length - LOAD_AHEAD) void loadMore();
  }, [hasItems, lastIndex, items.length, loadMore]);

  if (!hasItems) {
    if (load === 'loading' || load === 'idle') return <ListSkeleton />;
    if (load === 'failed') return <ListFailed onRetry={() => void refresh()} />;
    return <ListEmpty kind={filter} />;
  }

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-3">
      <div
        ref={contentRef}
        style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}
      >
        {rows.map((row) => {
          const conversation = items[row.index];
          return (
            <div
              key={row.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: ROW_HEIGHT,
                transform: `translateY(${row.start}px)`,
              }}
            >
              <ConversationRow
                conversation={conversation}
                selected={conversation.id === selectedId}
                onOpen={onOpen}
                onMenu={onMenu}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
});
