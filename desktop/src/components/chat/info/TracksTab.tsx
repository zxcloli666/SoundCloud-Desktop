import { useVirtualizer } from '@tanstack/react-virtual';
import type { TFunction } from 'i18next';
import { memo, type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { chatBridge } from '../../../lib/chat/bridge';
import { senderColor } from '../../../lib/chat/render';
import { DAY_MS, sameDay, shortDate } from '../../../lib/chat/time';
import type { EmbedHit, EmbedKind, Seq } from '../../../lib/chat/types';
import { Loader2, Music, RotateCcw } from '../../../lib/icons';
import { EmbedCard } from '../embeds/EmbedCard';
import { useThread } from '../thread/context';

const KINDS: EmbedKind[] = ['track', 'playlist'];
const PAGE = 30;
const LOAD_AHEAD = 5;

function hitDate(ts: number, now: number, t: TFunction, language: string): string {
  if (sameDay(ts, now - DAY_MS)) return t('chat.thread.day.yesterday');
  return shortDate(ts, now, language);
}

type Load = 'loading' | 'ready' | 'failed';

function TabState({ load, onRetry }: { load: Load; onRetry: () => void }) {
  const { t } = useTranslation();
  if (load === 'loading') {
    return (
      <div className="flex justify-center py-10 text-ink-40">
        <Loader2 size={18} className="animate-spin" />
      </div>
    );
  }
  if (load === 'failed') {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-[12.5px] text-ink-45">
        {t('chat.thread.info.tracksFailed')}
        <button
          type="button"
          onClick={onRetry}
          className="flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-ink/[0.06] px-3.5 text-[12px] font-semibold text-ink-75 hover:bg-ink/[0.1]"
        >
          <RotateCcw size={13} />
          {t('chat.thread.retry')}
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center text-[12.5px] text-ink-40">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-ink/[0.04] text-ink-30">
        <Music size={20} />
      </span>
      {t('chat.thread.info.noTracks')}
    </div>
  );
}

export const TracksTab = memo(function TracksTab({
  scrollRef,
  onJump,
}: {
  scrollRef: RefObject<HTMLDivElement | null>;
  onJump: (seq: Seq) => void;
}) {
  const { t, i18n } = useTranslation();
  const { conversation, nameOf } = useThread();
  const [items, setItems] = useState<EmbedHit[]>([]);
  const [more, setMore] = useState(false);
  const [load, setLoad] = useState<Load>('loading');
  const busy = useRef(false);
  const [offset, setOffset] = useState(0);
  const listRef = useCallback((node: HTMLDivElement | null) => {
    if (node) setOffset(node.offsetTop);
  }, []);

  const fetchPage = useCallback(
    async (before: Seq | null) => {
      if (busy.current) return;
      busy.current = true;
      try {
        const page = await chatBridge.embeds(conversation.id, {
          kinds: KINDS,
          before,
          limit: PAGE,
        });
        setItems((list) => (before === null ? page.items : [...list, ...page.items]));
        setMore(page.more);
        setLoad('ready');
      } catch {
        setLoad((current) => (current === 'ready' ? 'ready' : 'failed'));
      } finally {
        busy.current = false;
      }
    },
    [conversation.id],
  );

  useEffect(() => {
    void fetchPage(null);
  }, [fetchPage]);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 92,
    getItemKey: (index) => `${items[index].seq}:${items[index].embed.urn}:${index}`,
    overscan: 6,
    scrollMargin: offset,
  });
  const virtualItems = virtualizer.getVirtualItems();
  const lastIndex = virtualItems[virtualItems.length - 1]?.index ?? -1;

  useEffect(() => {
    if (more && lastIndex >= items.length - LOAD_AHEAD && items.length > 0) {
      void fetchPage(items[items.length - 1].seq);
    }
  }, [more, lastIndex, items, fetchPage]);

  if (load !== 'ready' || items.length === 0) {
    return <TabState load={load} onRetry={() => void fetchPage(null)} />;
  }

  return (
    <div ref={listRef} className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
      {virtualItems.map((item) => {
        const hit = items[item.index];
        return (
          <div
            key={item.key}
            data-index={item.index}
            ref={virtualizer.measureElement}
            className="absolute top-0 left-0 w-full pb-2.5"
            style={{ transform: `translateY(${item.start - offset}px)` }}
          >
            <button
              type="button"
              onClick={() => onJump(hit.seq)}
              className="mb-1 flex max-w-full cursor-pointer items-center gap-1.5 px-1 text-[11px] text-ink-40 hover:text-ink-70"
            >
              <span className="truncate font-semibold" style={{ color: senderColor(hit.sender) }}>
                {nameOf(hit.sender)}
              </span>
              <span className="shrink-0 tabular-nums">
                {hitDate(hit.ts, Date.now(), t, i18n.language)}
              </span>
            </button>
            <EmbedCard embed={hit.embed} compact />
          </div>
        );
      })}
    </div>
  );
});
