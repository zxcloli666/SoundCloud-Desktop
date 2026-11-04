import { memo, type RefObject, useCallback, useEffect, useState } from 'react';
import type { Seq } from '../../../lib/chat/types';
import { useThread } from '../thread/context';
import { GalleryGrid } from './view/GalleryGrid';
import { GalleryEmpty, GalleryFailed, GallerySkeleton, GalleryTail } from './view/GalleryStates';
import type { ViewImage } from './view/images';
import { showLightbox } from './view/lightbox-root';
import { useMediaView } from './view/media-state';
import { useGallery } from './view/useGallery';

const AUTO_SCANS = 5;

function chronological(items: ViewImage[]): ViewImage[] {
  return items.slice().sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0) || a.position - b.position);
}

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
        items: chronological(items),
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

  const [scans, setScans] = useState(0);
  const scanning = items.length === 0 && more && tail === 'idle' && scans < AUTO_SCANS;

  useEffect(() => {
    if (load !== 'ready' || !scanning) return;
    setScans((count) => count + 1);
    loadMore();
  }, [load, scanning, loadMore]);

  if (load === 'failed') return <GalleryFailed onRetry={gallery.reload} />;
  if (load === 'loading' || scanning || (items.length === 0 && tail === 'loading')) {
    return <GallerySkeleton />;
  }
  if (items.length === 0) {
    if (tail === 'failed') return <GalleryFailed onRetry={loadMore} />;
    return <GalleryEmpty onOlder={more ? () => setScans(0) : undefined} />;
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
