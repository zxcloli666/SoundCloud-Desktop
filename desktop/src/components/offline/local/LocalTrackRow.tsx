import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { art, dur, formatBytes } from '../../../lib/formatters';
import {
  FolderOpen,
  GripVertical,
  ListEnd,
  Music,
  playWhite14,
  Trash2,
  TriangleAlert,
} from '../../../lib/icons';
import { localArtist } from '../../../lib/local-library';
import { usePlayerStore } from '../../../stores/player';
import { AddToLocalPlaylist } from './AddToLocalPlaylist';
import { fileExtension, type LocalRow } from './lib';

export const LOCAL_ROW_HEIGHT = 56;

const ACTION =
  'flex size-[29px] cursor-pointer items-center justify-center rounded-[9px] border border-white/[0.12] bg-white/[0.05] text-white/55 transition-colors';

export interface LocalRowProps {
  row: LocalRow;
  index: number;
  sortable: boolean;
  inPlaylist: boolean;
  onPlay: (row: LocalRow) => void;
  onRemove: (row: LocalRow) => void;
  dragHandleProps?: React.HTMLAttributes<HTMLElement>;
}

export const LocalTrackRow = React.memo(function LocalTrackRow({
  row,
  index,
  sortable,
  inPlaylist,
  onPlay,
  onRemove,
  dragHandleProps,
}: LocalRowProps) {
  const { t } = useTranslation();
  const isCurrent = usePlayerStore((s) => s.currentTrack?.urn === row.urn);
  const { info, track, missing } = row;
  const artwork = art(track.artwork_url, 't200x200');
  const subtitle = [localArtist(info), info.album].filter(Boolean).join(' · ');

  const play = () => {
    if (missing) toast.error(t('local.fileMissing'), { description: info.path });
    else onPlay(row);
  };

  const playNext = () => {
    usePlayerStore.getState().addToQueueNext([track]);
    toast.success(t('local.queuedNext'));
  };

  return (
    <div
      className={`group relative grid h-full select-none grid-cols-[28px_minmax(0,1fr)_88px_64px] items-center gap-3 border-b border-white/[0.045] pl-2 pr-4 transition-colors hover:bg-white/[0.03] md:grid-cols-[28px_minmax(0,1fr)_auto_88px_64px] ${
        missing ? 'opacity-55' : ''
      }`}
    >
      <div
        className={`flex items-center justify-center font-mono text-[11px] text-white/25 tabular-nums ${
          sortable ? 'cursor-grab touch-none active:cursor-grabbing' : ''
        }`}
        {...(sortable ? dragHandleProps : undefined)}
      >
        {sortable ? (
          <>
            <span className="group-hover:hidden">{index + 1}</span>
            <GripVertical size={13} className="hidden text-white/45 group-hover:block" />
          </>
        ) : (
          <span>{index + 1}</span>
        )}
      </div>

      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={play}
          className="relative size-[38px] flex-none cursor-pointer overflow-hidden rounded-lg shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]"
          aria-label={t('offline.actPlay')}
        >
          {artwork ? (
            <img
              src={artwork}
              alt=""
              className="size-full object-cover"
              decoding="async"
              loading="lazy"
            />
          ) : (
            <span
              className="flex size-full items-center justify-center text-white/35"
              style={{
                background:
                  'linear-gradient(135deg, var(--color-accent-glow), rgba(255,255,255,0.03) 75%)',
              }}
            >
              <Music size={15} />
            </span>
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100">
            {missing ? <TriangleAlert size={14} /> : playWhite14}
          </span>
        </button>
        <div className="min-w-0">
          <p
            className={`truncate text-[13px] font-medium leading-tight ${
              isCurrent ? 'text-accent' : 'text-white/88'
            }`}
          >
            {info.title}
          </p>
          <p className="truncate text-[11.5px] leading-tight text-white/40">{subtitle}</p>
        </div>
      </div>

      <div className="hidden items-center justify-end gap-1.5 md:flex">
        {missing ? (
          <span className="whitespace-nowrap rounded-[5px] border border-rose-400/35 bg-rose-400/[0.08] px-[7px] py-[4px] font-mono text-[9px] font-semibold tracking-[0.13em] text-rose-200/90">
            {t('local.stampMissing')}
          </span>
        ) : (
          <span className="whitespace-nowrap rounded-[5px] border border-white/[0.12] px-[7px] py-[4px] font-mono text-[9px] font-semibold tracking-[0.13em] text-white/45">
            {fileExtension(info.path)}
          </span>
        )}
      </div>

      <div className="text-right font-mono text-[12px] text-white/40 tabular-nums">
        {formatBytes(info.bytes)}
      </div>
      <div className="text-right font-mono text-[12px] text-white/35 tabular-nums">
        {info.durationMs ? dur(info.durationMs) : '—'}
      </div>

      <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-[5] flex translate-x-2 items-center gap-1.5 bg-[linear-gradient(90deg,rgba(15,15,18,0),rgba(18,18,22,0.97)_40%)] pl-14 pr-4 opacity-0 transition-all duration-150 group-hover:pointer-events-auto group-hover:translate-x-0 group-hover:opacity-100">
        {!missing && (
          <>
            <button
              type="button"
              onClick={play}
              title={t('offline.actPlay')}
              aria-label={t('offline.actPlay')}
              className={`${ACTION} hover:border-[var(--color-accent-glow)] hover:text-[var(--color-accent-hover)]`}
            >
              {playWhite14}
            </button>
            <button
              type="button"
              onClick={playNext}
              title={t('local.playNext')}
              aria-label={t('local.playNext')}
              className={`${ACTION} hover:border-white/[0.25] hover:text-white/90`}
            >
              <ListEnd size={13} />
            </button>
            <AddToLocalPlaylist
              trackId={row.id}
              className={`${ACTION} hover:border-white/[0.25] hover:text-white/90`}
            />
            <button
              type="button"
              onClick={() => void revealItemInDir(info.path).catch(() => {})}
              title={t('local.showInFolder')}
              aria-label={t('local.showInFolder')}
              className={`${ACTION} hover:border-white/[0.25] hover:text-white/90`}
            >
              <FolderOpen size={13} />
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => onRemove(row)}
          title={inPlaylist ? t('local.removeFromPlaylist') : t('local.removeFromLibrary')}
          aria-label={inPlaylist ? t('local.removeFromPlaylist') : t('local.removeFromLibrary')}
          className={`${ACTION} hover:border-rose-400/40 hover:bg-rose-400/10 hover:text-rose-200`}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
});

export function SortableLocalRow(props: Omit<LocalRowProps, 'dragHandleProps'>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.row.id,
  });
  return (
    <div
      ref={setNodeRef}
      className={`h-full ${isDragging ? 'opacity-30' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <LocalTrackRow {...props} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}

export const LocalRowClone = React.memo(function LocalRowClone({ row }: { row: LocalRow }) {
  const artwork = art(row.track.artwork_url, 't200x200');
  return (
    <div className="flex h-[56px] cursor-grabbing items-center gap-3 rounded-xl bg-[rgba(28,28,34,0.96)] px-3 shadow-[0_20px_50px_rgba(0,0,0,0.55)] ring-1 ring-white/15 backdrop-blur-xl">
      <GripVertical size={13} className="flex-none text-white/45" />
      <div className="size-[38px] flex-none overflow-hidden rounded-lg bg-white/[0.04]">
        {artwork && (
          <img src={artwork} alt="" className="size-full object-cover" decoding="async" />
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium text-white/88">{row.info.title}</p>
        <p className="truncate text-[11.5px] text-white/40">{localArtist(row.info)}</p>
      </div>
    </div>
  );
});
