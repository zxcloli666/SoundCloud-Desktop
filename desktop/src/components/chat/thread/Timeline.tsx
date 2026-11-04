import { useVirtualizer } from '@tanstack/react-virtual';
import {
  memo,
  type Ref,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { peerSeqs, type Tick, tickOf } from '../../../lib/chat/render';
import type { ConvId, Message, PeerMark, Seq } from '../../../lib/chat/types';
import { useChatThreadStore } from '../../../stores/chat/thread';
import { MessageRow } from '../bubbles/MessageRow';
import { useThread } from './context';
import { isRequest } from './permissions';
import { buildRows, estimateRow, type Row, rowIndexOfSeq, unseenBelow } from './rows';
import { DaySeparator, SystemRow, UnreadDivider } from './Separators';
import { FloatingDay, JumpButton, TopSpinner } from './TimelineOverlays';
import { useLineChars } from './useLineChars';
import { useReadMarker } from './useReadMarker';
import { useTimelineScroll } from './useTimelineScroll';

export interface TimelineHandle {
  jumpTo: (seq: Seq) => Promise<void>;
  toBottom: () => void;
}

const NO_MESSAGES: Message[] = [];
const NO_MARKS: PeerMark[] = [];
const FLASH_MS = 1500;
const LOAD_AHEAD = 3;

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function rowTs(rows: Row[], index: number): number | null {
  for (let i = index; i < rows.length; i++) {
    const row = rows[i];
    if (row.kind === 'day') return row.ts;
    if (row.kind === 'message' || row.kind === 'system') return row.message.ts;
  }
  return null;
}

export const Timeline = memo(function Timeline({
  conversationId,
  ref,
}: {
  conversationId: ConvId;
  ref?: Ref<TimelineHandle>;
}) {
  const { t } = useTranslation();
  const { me, conversation } = useThread();
  const thread = useChatThreadStore((state) => state.threads[conversationId]);
  const messages = thread?.messages ?? NO_MESSAGES;
  const unread = thread?.unread ?? null;
  const marks = thread?.marks ?? NO_MARKS;
  const ready = thread?.load === 'ready';
  const readSeq = thread?.readSeq ?? 0;

  const rows = useMemo(() => buildRows(messages, unread), [messages, unread]);
  const bySeq = useMemo(() => {
    const map = new Map<Seq, Message>();
    for (const message of messages) if (message.seq !== null) map.set(message.seq, message);
    return map;
  }, [messages]);
  const { read, delivered } = useMemo(() => peerSeqs(marks, me), [marks, me]);
  const initialIndex = useMemo(() => rows.findIndex((row) => row.kind === 'unread'), [rows]);
  const avatars = conversation.kind === 'group' || conversation.kind === 'room';
  const saved = conversation.kind === 'self';

  const scrollRef = useRef<HTMLDivElement>(null);
  const perLine = useLineChars(scrollRef);
  const getItemKey = useCallback((index: number) => rows[index].key, [rows]);
  const estimateSize = useCallback(
    (index: number) => estimateRow(rows[index], perLine),
    [rows, perLine],
  );
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize,
    getItemKey,
    overscan: 8,
    paddingStart: 8,
    paddingEnd: 14,
  });

  useEffect(() => {
    if (perLine > 0) virtualizer.measure();
  }, [virtualizer, perLine]);
  const { away, settled, moving, onScroll, toBottom, release } = useTimelineScroll(
    scrollRef,
    virtualizer,
    rows,
    ready,
    initialIndex,
  );

  const items = virtualizer.getVirtualItems();
  const startIndex = virtualizer.range?.startIndex ?? -1;
  const endIndex = virtualizer.range?.endIndex ?? -1;
  useReadMarker(conversationId, rows, endIndex, ready && !isRequest(conversation));

  const firstIndex = items[0]?.index ?? -1;
  useEffect(() => {
    if (settled && firstIndex >= 0 && firstIndex <= LOAD_AHEAD) {
      void useChatThreadStore.getState().loadBefore(conversationId);
    }
  }, [settled, firstIndex, conversationId]);

  const [flashKey, setFlashKey] = useState<string | null>(null);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const jumpTo = useCallback(
    async (seq: Seq) => {
      let index = rowIndexOfSeq(rowsRef.current, seq);
      if (index < 0) {
        const found = await useChatThreadStore
          .getState()
          .loadUntil(conversationId, seq)
          .catch(() => false);
        await nextFrame();
        await nextFrame();
        index = found ? rowIndexOfSeq(rowsRef.current, seq) : -1;
      }
      if (index < 0) {
        toast(t('chat.thread.reply.gone'));
        return;
      }
      release();
      virtualizer.scrollToIndex(index, { align: 'center' });
      const key = rowsRef.current[index].key;
      setFlashKey(key);
      setTimeout(() => setFlashKey((current) => (current === key ? null : current)), FLASH_MS);
    },
    [conversationId, release, virtualizer, t],
  );

  useImperativeHandle(ref, () => ({ jumpTo, toBottom }), [jumpTo, toBottom]);

  const tickFor = (message: Message): Tick | null => {
    if (!message.mine) return null;
    const tick = tickOf(message, read, delivered);
    return saved && tick !== 'pending' && tick !== 'failed' ? null : tick;
  };

  const renderRow = (row: Row) => {
    if (row.kind === 'day') return <DaySeparator ts={row.ts} />;
    if (row.kind === 'unread') return <UnreadDivider count={row.count} />;
    if (row.kind === 'system') return <SystemRow message={row.message} />;
    const { message } = row;
    return (
      <MessageRow
        message={message}
        replied={message.replyTo !== null ? (bySeq.get(message.replyTo) ?? null) : null}
        first={row.first}
        last={row.last}
        tick={tickFor(message)}
        flash={row.key === flashKey}
        avatars={avatars}
      />
    );
  };

  const topTs = moving && away && startIndex >= 0 ? rowTs(rows, startIndex) : null;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto"
        style={{ overflowAnchor: 'none' }}
      >
        <div
          className="relative mt-auto w-full shrink-0"
          style={{ height: virtualizer.getTotalSize() }}
        >
          {items.map((item) => (
            <div
              key={item.key}
              data-index={item.index}
              ref={virtualizer.measureElement}
              className="absolute top-0 left-0 w-full"
              style={{ transform: `translateY(${item.start}px)`, contain: 'layout style' }}
            >
              <div className="mx-auto w-full max-w-[780px]">{renderRow(rows[item.index])}</div>
            </div>
          ))}
        </div>
      </div>
      {thread?.loadingBefore && <TopSpinner />}
      {!thread?.loadingBefore && topTs !== null && <FloatingDay ts={topTs} />}
      {away && <JumpButton count={unseenBelow(rows, endIndex, readSeq)} onClick={toBottom} />}
    </div>
  );
});
