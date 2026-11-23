import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { dur } from '../../../lib/formatters';
import { GripVertical, X } from '../../../lib/icons';
import { useTrackContextMenu } from '../../../lib/useTrackContextMenu';
import { type Track, usePlayerStore } from '../../../stores/player';
import { LikeButton } from '../LikeButton';
import { TrackStatusBadges } from '../TrackStatusBadges';
import type { RowTone } from './queue-items';
import { RowCover, RowText } from './RowBody';

export function playQueueIndex(index: number) {
  const player = usePlayerStore.getState();
  if (index === player.queueIndex && player.currentTrack) player.togglePlay();
  else player.playFromQueue(index);
}

const TONE: Record<RowTone, string> = {
  next: 'hover:bg-ink/[0.05]',
  played: 'opacity-55 hover:opacity-100 hover:bg-ink/[0.05] focus-visible:opacity-100',
  now: 'bg-accent/10 ring-1 ring-inset ring-accent/25',
};

interface Props {
  track: Track;
  id: string;
  index: number;
  at: number;
  tone: RowTone;
  playing: boolean;
}

export const QueueRow = React.memo(function QueueRow({
  track,
  id,
  index,
  at,
  tone,
  playing,
}: Props) {
  const { t } = useTranslation();
  const onContextMenu = useTrackContextMenu(track, index);
  const sortable = tone === 'next';
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !sortable,
  });

  return (
    <div
      ref={setNodeRef}
      data-ui="queue-item"
      data-tone={tone}
      data-q-at={at}
      tabIndex={0}
      aria-current={tone === 'now' || undefined}
      onClick={() => playQueueIndex(index)}
      onContextMenu={onContextMenu}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`group relative my-0.5 flex h-[52px] cursor-pointer select-none items-center gap-2.5 rounded-[14px] pr-1 outline-none transition-[background-color,opacity] duration-150 focus-visible:ring-2 focus-visible:ring-accent/60 ${
        isDragging
          ? 'bg-ink/[0.04] outline-1 outline-dashed outline-ink/20 [&>*]:invisible'
          : TONE[tone]
      }`}
    >
      <span
        {...(sortable ? { ...attributes, ...listeners } : {})}
        aria-label={sortable ? t('reorder.grip') : undefined}
        onClick={(event) => event.stopPropagation()}
        className={`flex h-full w-[18px] shrink-0 touch-none items-center justify-center text-ink-30 opacity-0 transition-opacity group-hover:opacity-100 ${
          sortable ? 'cursor-grab hover:text-ink-70 active:cursor-grabbing' : ''
        }`}
      >
        {sortable && <GripVertical size={14} />}
      </span>
      <RowCover track={track} now={tone === 'now'} playing={playing} />
      <RowText track={track} now={tone === 'now'} />
      <TrackStatusBadges meta={track._scd_meta} videos={track.videos} />
      <span className="relative h-8 w-16 shrink-0">
        <span className="absolute inset-0 flex items-center justify-end pr-2 font-mono text-[11.5px] tabular-nums text-ink-35 transition-opacity group-focus-within:opacity-0 group-hover:opacity-0">
          {dur(track.duration)}
        </span>
        <span className="absolute inset-0 flex items-center justify-end opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          <LikeButton track={track} />
          {tone !== 'now' && (
            <button
              type="button"
              data-ui="queue-remove"
              aria-label={t('queue.remove')}
              title={t('queue.remove')}
              onClick={(event) => {
                event.stopPropagation();
                usePlayerStore.getState().removeFromQueue(index);
              }}
              className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-ink-40 transition-colors hover:bg-ink/[0.07] hover:text-ink"
            >
              <X size={15} />
            </button>
          )}
        </span>
      </span>
    </div>
  );
});

export function QueueRowLifted({ track }: { track: Track }) {
  return (
    <div className="queue-lifted flex h-[52px] cursor-grabbing items-center gap-2.5 rounded-[14px] pr-4 rotate-[1.2deg]">
      <span className="flex w-[18px] shrink-0 justify-center text-ink-60">
        <GripVertical size={14} />
      </span>
      <RowCover track={track} now={false} playing={false} />
      <RowText track={track} now={false} />
    </div>
  );
}
