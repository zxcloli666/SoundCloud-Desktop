import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/shallow';
import { art, dur } from '../../lib/formatters';
import { GripVertical, pauseTextWhite12, playIcon32, Trash2, X } from '../../lib/icons';
import { usePlayerStore } from '../../stores/player';

/* ── Now Playing (single, non-draggable) ─────────────────────────── */
const NowPlayingItem = React.memo(() => {
  const { currentTrack, isPlaying } = usePlayerStore(
    useShallow((s) => ({
      currentTrack: s.currentTrack,
      isPlaying: s.isPlaying,
    })),
  );

  if (!currentTrack) return null;
  const artwork = art(currentTrack.artwork_url, 't200x200');

  const handleClick = () => {
    const { pause, resume } = usePlayerStore.getState();
    isPlaying ? pause() : resume();
  };

  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.08] ring-1 ring-white/[0.08] cursor-pointer"
      onClick={handleClick}
    >
      <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 relative bg-white/[0.04]">
        {artwork ? (
          <img src={artwork} alt="" className="w-full h-full object-cover" decoding="async" />
        ) : (
          <div className="w-full h-full" />
        )}
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          {isPlaying ? (
            <div className="flex items-center gap-[2px]">
              <div className="w-[2px] h-3 bg-accent rounded-full animate-pulse" />
              <div className="w-[2px] h-2 bg-accent rounded-full animate-pulse [animation-delay:150ms]" />
              <div className="w-[2px] h-3.5 bg-accent rounded-full animate-pulse [animation-delay:300ms]" />
            </div>
          ) : (
            pauseTextWhite12
          )}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] text-accent font-medium truncate leading-snug">
          {currentTrack.title}
        </p>
        <p className="text-[10px] text-white/30 truncate mt-0.5">{currentTrack.user.username}</p>
      </div>
      <span className="text-[10px] text-white/20 tabular-nums shrink-0">
        {dur(currentTrack.duration)}
      </span>
    </div>
  );
});

/* ── Draggable queue list ────────────────────────────────────────── */
const QueueRow = React.memo(function QueueRow({
  track,
  absIdx,
}: {
  track: ReturnType<typeof usePlayerStore.getState>['queue'][number];
  absIdx: number;
}) {
  const queueIndex = usePlayerStore((s) => s.queueIndex);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isCurrent = absIdx === queueIndex;
  const artwork = art(track.artwork_url, 't200x200');

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(absIdx),
  });

  const handleClick = () => {
    const { playFromQueue, pause, resume } = usePlayerStore.getState();
    if (absIdx === queueIndex && isPlaying) pause();
    else if (absIdx === queueIndex) resume();
    else playFromQueue(absIdx);
  };

  const handleRemove = () => {
    usePlayerStore.getState().removeFromQueue(absIdx);
  };

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-3 px-3 py-2 rounded-xl group transition-all duration-150 select-none ${
        isDragging
          ? 'opacity-40 scale-[0.97]'
          : isCurrent
            ? 'bg-white/[0.08] ring-1 ring-white/[0.08]'
            : 'hover:bg-white/[0.04]'
      }`}
    >
      <div
        className="text-white/15 group-hover:text-white/30 hover:!text-white/50 cursor-grab active:cursor-grabbing transition-colors touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={14} />
      </div>

      <div
        className="w-9 h-9 rounded-lg overflow-hidden shrink-0 relative bg-white/[0.04] cursor-pointer"
        onClick={handleClick}
      >
        {artwork ? (
          <img src={artwork} alt="" className="w-full h-full object-cover" decoding="async" />
        ) : (
          <div className="w-full h-full" />
        )}
        {isCurrent && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            {isPlaying ? (
              <div className="flex items-center gap-[2px]">
                <div className="w-[2px] h-3 bg-accent rounded-full animate-pulse" />
                <div className="w-[2px] h-2 bg-accent rounded-full animate-pulse [animation-delay:150ms]" />
                <div className="w-[2px] h-3.5 bg-accent rounded-full animate-pulse [animation-delay:300ms]" />
              </div>
            ) : (
              pauseTextWhite12
            )}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 cursor-pointer" onClick={handleClick}>
        <p
          className={`text-[12px] truncate leading-snug ${isCurrent ? 'text-accent font-medium' : 'text-white/80'}`}
        >
          {track.title}
        </p>
        <p className="text-[10px] text-white/30 truncate mt-0.5">{track.user.username}</p>
      </div>

      <span className="text-[10px] text-white/20 tabular-nums shrink-0">{dur(track.duration)}</span>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleRemove();
        }}
        className="w-6 h-6 rounded-md flex items-center justify-center text-white/0 group-hover:text-white/20 hover:!text-white/50 hover:!bg-white/[0.06] transition-all duration-150 cursor-pointer shrink-0"
      >
        <X size={12} />
      </button>
    </div>
  );
});

const DraggableQueue = React.memo(({ startIndex }: { startIndex: number }) => {
  const queue = usePlayerStore((s) => s.queue);
  const items = queue.slice(startIndex);
  const itemIds = items.map((_, localIdx) => String(startIndex + localIdx));
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={({ active, over }) => {
        if (!over || active.id === over.id) return;
        usePlayerStore.getState().moveInQueue(Number(active.id), Number(over.id));
      }}
    >
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-0.5">
          {items.map((track, localIdx) => (
            <QueueRow
              key={`${track.urn}-${startIndex + localIdx}`}
              track={track}
              absIdx={startIndex + localIdx}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
});

/* ── Panel ───────────────────────────────────────────────────────── */
export const QueuePanel = React.memo(
  ({ open, onClose }: { open: boolean; onClose: () => void }) => {
    const { t } = useTranslation();
    const { currentTrack, queue, queueIndex } = usePlayerStore(
      useShallow((s) => ({
        currentTrack: s.currentTrack,
        queue: s.queue,
        queueIndex: s.queueIndex,
      })),
    );

    const upNextCount = queue.length - queueIndex - 1;

    return (
      <>
        {/* Backdrop */}
        <div
          className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300 ${
            open ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          onClick={onClose}
        />

        {/* Panel */}
        <div
          className="fixed top-0 right-0 bottom-0 w-[360px] z-50 flex flex-col"
          style={{
            background: 'rgba(18, 18, 20, 0.88)',
            backdropFilter: 'blur(60px) saturate(1.8)',
            borderLeft: '1px solid rgba(255,255,255,0.06)',
            transform: open ? 'translateX(0)' : 'translateX(100%)',
            visibility: open ? 'visible' : 'hidden',
            transition: 'transform 300ms cubic-bezier(0.16, 1, 0.3, 1), visibility 300ms',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h2 className="text-base font-semibold tracking-tight">{t('player.queue')}</h2>
            <div className="flex items-center gap-1">
              {queue.length > 0 && (
                <button
                  type="button"
                  onClick={() => usePlayerStore.getState().clearQueue()}
                  className="h-7 px-2.5 rounded-lg text-[11px] text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-all duration-150 cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 size={12} />
                  {t('player.clearQueue')}
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-all duration-150 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Now Playing (single item, not draggable) */}
          {currentTrack && (
            <div className="px-4 pb-2">
              <p className="text-[10px] text-white/25 uppercase tracking-wider font-medium mb-2 px-1">
                {t('player.nowPlaying')}
              </p>
              <NowPlayingItem />
            </div>
          )}

          {/* Up Next (draggable) */}
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {upNextCount > 0 && (
              <>
                <p className="text-[10px] text-white/25 uppercase tracking-wider font-medium mb-2 mt-3 px-1">
                  {t('player.upNext')} · {upNextCount}
                </p>
                <DraggableQueue startIndex={queueIndex + 1} />
              </>
            )}

            {queue.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-white/15">
                {playIcon32}
                <p className="text-sm mt-3">Queue is empty</p>
              </div>
            )}
          </div>
        </div>
      </>
    );
  },
);
