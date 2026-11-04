import { memo, type RefObject, useCallback, useEffect } from 'react';
import type { Seq } from '../../../lib/chat/types';
import { useThread } from '../thread/context';
import { GalleryGrid } from './view/GalleryGrid';
import { GalleryEmpty, GalleryFailed, GallerySkeleton, GalleryTail } from './view/GalleryStates';
import { showLightbox } from './view/lightbox-root';
import { useMediaView } from './view/media-state';
import { useGallery } from './view/useGallery';

export const GalleryTab = memo(function GalleryTab({
  scrollRef,
  onJump,
}: {
  scrollRef: RefObject<HTMLDivElement | null>;
  onJump: (seq: Seq) => void;
}) {
  useMediaView();
  const { conversation, nameOf } = useThread();
  const gallery = useGallery(conversation.id);
  const { items, load, tail, more, loadMore } = gallery;

  const open = useCallback(
    (index: number) => {
      const start = items[index];
      if (!start) return;
      showLightbox({
        items: items.slice().reverse(),
        start,
        more,
        nameOf,
        onJump,
      });
    },
    [items, more, nameOf, onJump],
  );

  const nearEnd = useCallback(() => {
    if (tail === 'idle') loadMore();
  }, [tail, loadMore]);

  useEffect(() => {
    if (load === 'ready' && items.length === 0 && more && tail === 'idle') loadMore();
  }, [load, items.length, more, tail, loadMore]);

  if (load === 'failed') return <GalleryFailed onRetry={gallery.reload} />;
  if (load === 'loading' || (items.length === 0 && more && tail !== 'failed')) {
    return <GallerySkeleton />;
  }
  if (items.length === 0) {
    return tail === 'failed' ? <GalleryFailed onRetry={loadMore} /> : <GalleryEmpty />;
  }

  return (
    <div className="flex flex-col">
      <GalleryGrid
        items={items}
        scrollRef={scrollRef}
        nameOf={nameOf}
        onOpen={open}
        onNearEnd={nearEnd}
      />
      <GalleryTail state={tail} onRetry={loadMore} />
    </div>
  );
});
