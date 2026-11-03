import { useQuery } from '@tanstack/react-query';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { chatBridge } from '../../../lib/chat/bridge';
import type { ConvId, SearchHit } from '../../../lib/chat/types';
import { useChatListStore } from '../../../stores/chat/list';
import { useDebouncedValue } from '../../discover/useDebouncedValue';
import { ConversationAvatar } from './ConversationAvatar';
import { conversationAvatar, conversationTitle } from './conversation-meta';
import { ListEmpty, ListFailed, ListSkeleton } from './ListEmpty';
import { rowTime } from './row-time';

export const SEARCH_MIN = 2;
const SEARCH_LIMIT = 60;

const HitRow = memo(function HitRow({
  hit,
  onOpen,
}: {
  hit: SearchHit;
  onOpen: (conversationId: ConvId) => void;
}) {
  const { t, i18n } = useTranslation();
  const conversation = useChatListStore((state) => state.byId[hit.conversationId]);
  const title = conversation ? conversationTitle(conversation, t) : t('chat.list.unknown');

  return (
    <button
      type="button"
      onClick={() => onOpen(hit.conversationId)}
      className="mx-2 flex w-[calc(100%-1rem)] cursor-pointer items-center gap-3 rounded-2xl px-2.5 py-2 text-left transition-colors duration-200 hover:bg-ink/[0.05]"
    >
      <ConversationAvatar
        kind={conversation?.kind ?? 'direct'}
        src={conversation ? conversationAvatar(conversation) : null}
        name={title}
        size={36}
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[13px] font-semibold text-ink-85">{title}</span>
          <span className="ml-auto shrink-0 text-[11px] tabular-nums text-ink-35">
            {rowTime(hit.ts, Date.now(), i18n.language)}
          </span>
        </span>
        <span className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-ink-50">
          {hit.snippet}
        </span>
      </span>
    </button>
  );
});

export const SearchResults = memo(function SearchResults({
  query,
  onOpen,
}: {
  query: string;
  onOpen: (conversationId: ConvId) => void;
}) {
  const text = useDebouncedValue(query.trim(), 200);
  const search = useQuery({
    queryKey: ['chat', 'search', text],
    queryFn: () => chatBridge.search({ text, conversationId: null, limit: SEARCH_LIMIT }),
    enabled: text.length >= SEARCH_MIN,
    staleTime: 10_000,
  });

  if (search.isPending) return <ListSkeleton rows={4} />;
  if (search.isError) return <ListFailed onRetry={() => void search.refetch()} />;
  if (search.data.length === 0) return <ListEmpty kind="search" />;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-3">
      {search.data.map((hit) => (
        <HitRow key={`${hit.conversationId}:${hit.seq}`} hit={hit} onOpen={onOpen} />
      ))}
    </div>
  );
});
