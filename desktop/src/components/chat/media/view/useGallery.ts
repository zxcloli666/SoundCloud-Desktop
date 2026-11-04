import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ConvId, Message, Seq } from '../../../../lib/chat/types';
import { useChatThreadStore } from '../../../../stores/chat/thread';
import { imagesBefore, threadImages, type ViewImage } from './images';

export type GalleryLoad = 'loading' | 'ready' | 'failed';
export type GalleryTail = 'idle' | 'loading' | 'failed';

export interface Gallery {
  items: ViewImage[];
  load: GalleryLoad;
  tail: GalleryTail;
  more: boolean;
  reload: () => void;
  loadMore: () => void;
}

const NO_MESSAGES: Message[] = [];

function newestFirst(images: ViewImage[]): ViewImage[] {
  return images.slice().reverse();
}

export function useGallery(conversationId: ConvId): Gallery {
  const [items, setItems] = useState<ViewImage[]>([]);
  const [load, setLoad] = useState<GalleryLoad>('loading');
  const [tail, setTail] = useState<GalleryTail>('idle');
  const [more, setMore] = useState(false);
  const oldest = useRef<Seq | null>(null);
  const busy = useRef(false);
  const generation = useRef(0);
  const messages = useChatThreadStore(
    (state) => state.threads[conversationId]?.messages ?? NO_MESSAGES,
  );

  const fetchPage = useCallback(
    async (reset: boolean) => {
      if (busy.current && !reset) return;
      busy.current = true;
      const run = ++generation.current;
      if (reset) {
        setLoad('loading');
        oldest.current = null;
      } else setTail('loading');
      try {
        const page = await imagesBefore(conversationId, reset ? null : oldest.current);
        if (run !== generation.current) return;
        oldest.current = page.oldest;
        const fresh = newestFirst(page.images);
        setItems((current) => (reset ? fresh : [...current, ...fresh]));
        setMore(page.more);
        setLoad('ready');
        setTail('idle');
      } catch {
        if (run !== generation.current) return;
        if (reset) setLoad('failed');
        else setTail('failed');
      } finally {
        if (run === generation.current) busy.current = false;
      }
    },
    [conversationId],
  );

  useEffect(() => {
    void fetchPage(true);
  }, [fetchPage]);

  const live = useMemo(() => {
    if (load !== 'ready') return [];
    const top = items[0]?.seq ?? 0;
    return newestFirst(threadImages(messages).filter((image) => (image.seq ?? 0) > top));
  }, [messages, items, load]);

  const all = useMemo(() => (live.length > 0 ? [...live, ...items] : items), [live, items]);
  const reload = useCallback(() => void fetchPage(true), [fetchPage]);
  const loadMore = useCallback(() => {
    if (more) void fetchPage(false);
  }, [more, fetchPage]);

  return { items: all, load, tail, more, reload, loadMore };
}
