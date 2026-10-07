import {useSortable} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import React, {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {toast} from 'sonner';
import {downloadTrack} from '../../lib/cache';
import {art, dur, formatBytes} from '../../lib/formatters';
import {
  ArrowDownToLine,
  FileDown,
  GripVertical,
  Loader2,
  Music,
  playWhite14,
  RefreshCw,
  Trash2,
} from '../../lib/icons';
import {usePerfMode} from '../../lib/perf';
import {useArtistLinkItems, useTrackDisplay} from '../../lib/track-display';
import {useTrackContextMenu} from '../../lib/useTrackContextMenu';
import {usePlayerStore} from '../../stores/player';
import {ArtistNameLinks} from '../music/ArtistNameLinks';
import {TrackStatusBadges} from '../music/TrackStatusBadges';
import {effectiveDurationMs, isTruncated} from './lib';
import type {OfflineEntry} from './types';

export const ROW_HEIGHT = 56;

function Stamp({
  tone,
  children,
}: {
  tone: 'raw' | 'forge' | 'preview' | 'missing';
  children: React.ReactNode;
}) {
  const cls = {
    raw: 'border-dashed border-white/[0.18] text-white/45',
    forge:
      'border-[var(--color-accent-glow)] text-[var(--color-accent-hover)] bg-[var(--color-accent-glow)]',
    preview: 'border-amber-400/40 bg-amber-400/[0.08] text-amber-200/90',
    missing: 'border-white/[0.08] text-white/25',
  }[tone];
  return (
    <span
      className={`whitespace-nowrap rounded-[5px] border px-[7px] py-[4px] font-mono text-[9px] font-semibold tracking-[0.13em] ${cls}`}
    >
      {children}
    </span>
  );
}

export interface OfflineRowProps {
  entry: OfflineEntry;
  index: number;
  sortable: boolean;
  likesSection: boolean;
  forging: boolean;
  downloadProgress?: number;
  onPlay: (entry: OfflineEntry) => void;
  onDownload: (entry: OfflineEntry) => void;
  onRefetch: (entry: OfflineEntry) => void;
  onRemove: (urn: string) => void;
  dragHandleProps?: React.HTMLAttributes<HTMLElement>;
}

export const OfflineTrackRow = React.memo(function OfflineTrackRow({
  entry,
  index,
  sortable,
  likesSection,
  forging,
  downloadProgress,
  onPlay,
  onDownload,
  onRefetch,
  onRemove,
  dragHandleProps,
}: OfflineRowProps) {
  const { t } = useTranslation();
  const perf = usePerfMode();
  const [saving, setSaving] = useState(false);
  const isCurrent = usePlayerStore((s) => s.currentTrack?.urn === entry.urn);
  const { track, inv } = entry;
  const display = useTrackDisplay(track);
  const onContextMenu = useTrackContextMenu(track);
  const artistLinks = useArtistLinkItems(track);
  const cached = inv !== null;
  const downloading = downloadProgress !== undefined;
  const truncated = isTruncated(inv);
  const artwork = art(track.artwork_url, 't200x200');

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await downloadTrack(track.urn, display.artistLine || track.user.username, display.title, {
        artworkUrl: track.artwork_url,
        durationMs: track.duration,
        storageQuality: track._scd_meta?.storage_quality,
      });
      toast.success(t('track.downloaded'));
    } catch (e: unknown) {
      if (!(e instanceof Error && e.message === 'cancelled')) toast.error(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      onContextMenu={onContextMenu}
      className={`group relative grid h-full select-none grid-cols-[28px_minmax(0,1fr)_88px_64px] items-center gap-3 border-b border-white/[0.045] pl-2 pr-4 transition-colors md:grid-cols-[28px_minmax(0,1fr)_auto_88px_64px] ${
        forging ? '' : 'hover:bg-white/[0.03]'
      } ${!cached && likesSection ? 'opacity-60' : ''}`}
    >
      {forging && (
        <>
          <span
            className="pointer-events-none absolute inset-0"
            style={{ background: 'var(--color-accent-glow)', opacity: 0.18 }}
          />
          <span
            className="absolute bottom-2 left-0 top-2 w-[2px] rounded-[2px]"
            style={{
              background: 'var(--color-accent)',
              boxShadow: perf.glow ? '0 0 12px var(--color-accent-glow)' : undefined,
            }}
          />
          {perf.idleAnim && (
            <span
              className="off-anim pointer-events-none absolute bottom-0 left-[-30%] top-0 w-[26%]"
              style={{
                background:
                  'linear-gradient(100deg, transparent, var(--color-accent-glow), transparent)',
                animation: 'off-rowsheen 3.2s linear -1.2s infinite',
                opacity: 0.35,
              }}
            />
          )}
        </>
      )}

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
          onClick={() => (cached ? onPlay(entry) : onDownload(entry))}
          className="relative size-[38px] flex-none cursor-pointer overflow-hidden rounded-lg shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]"
          aria-label={cached ? t('offline.actPlay') : t('offline.actDownload')}
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
            <span className="flex size-full items-center justify-center bg-white/[0.04] text-white/20">
              <Music size={15} />
            </span>
          )}
          {downloading && <span className="absolute inset-0 bg-black/55" />}
          <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100">
            {cached ? playWhite14 : <ArrowDownToLine size={14} />}
          </span>
        </button>
        <div className="min-w-0">
          <p
            className={`truncate text-[13px] font-medium leading-tight ${
              isCurrent ? 'text-accent' : entry.stub ? 'font-mono text-white/55' : 'text-white/88'
            }`}
          >
            {display.title}
          </p>
          {downloading ? (
            <div className="mt-1.5 h-[2px] w-[150px] overflow-hidden rounded-[1px] bg-white/[0.08]">
              <span
                className="block h-full origin-left bg-sky-400"
                style={{ transform: `scaleX(${downloadProgress})` }}
              />
            </div>
          ) : (
            <p
              className="truncate text-[11.5px] leading-tight text-white/40"
              style={forging ? { color: 'var(--color-accent-hover)' } : undefined}
            >
              {forging ? (
                t('offline.rowForging')
              ) : display.artistNames.length > 0 ? (
                <ArtistNameLinks
                  items={artistLinks}
                  linkClassName="cursor-pointer transition-colors hover:text-white/60"
                />
              ) : (
                track.user.username
              )}
            </p>
          )}
        </div>
      </div>

      <div className="hidden items-center justify-end gap-1.5 md:flex">
        <TrackStatusBadges meta={track._scd_meta} />
        {inv?.stage === 'raw' && !forging && <Stamp tone="raw">RAW</Stamp>}
        {forging && <Stamp tone="forge">{t('offline.stampForging')}</Stamp>}
        {truncated && <Stamp tone="preview">{t('offline.stampPreview')}</Stamp>}
        {!cached && likesSection && !downloading && (
          <Stamp tone="missing">{t('offline.stampMissing')}</Stamp>
        )}
      </div>

      <div className="text-right font-mono text-[12px] text-white/40 tabular-nums">
        {inv ? formatBytes(inv.bytes) : '—'}
      </div>
      <div
        className={`text-right font-mono text-[12px] tabular-nums ${
          truncated ? 'text-amber-200/90' : 'text-white/35'
        }`}
      >
        {dur(effectiveDurationMs(entry))}
      </div>

      <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-[5] flex translate-x-2 items-center gap-1.5 bg-[linear-gradient(90deg,rgba(15,15,18,0),rgba(18,18,22,0.97)_40%)] pl-14 pr-4 opacity-0 transition-all duration-150 group-hover:pointer-events-auto group-hover:translate-x-0 group-hover:opacity-100">
        {cached ? (
          <button
            type="button"
            onClick={() => onPlay(entry)}
            title={t('offline.actPlay')}
            aria-label={t('offline.actPlay')}
            className="flex size-[29px] cursor-pointer items-center justify-center rounded-[9px] border border-white/[0.12] bg-white/[0.05] text-white/55 transition-colors hover:border-[var(--color-accent-glow)] hover:text-[var(--color-accent-hover)]"
          >
            {playWhite14}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onDownload(entry)}
            disabled={downloading}
            title={t('offline.actDownload')}
            aria-label={t('offline.actDownload')}
            className="flex size-[29px] cursor-pointer items-center justify-center rounded-[9px] border border-white/[0.12] bg-white/[0.05] text-white/55 transition-colors hover:border-sky-400/40 hover:text-sky-200 disabled:opacity-40"
          >
            {downloading ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <ArrowDownToLine size={13} />
            )}
          </button>
        )}
        <button
          type="button"
          onClick={save}
          disabled={saving}
          title={t('offline.actSave')}
          aria-label={t('offline.actSave')}
          className="flex size-[29px] cursor-pointer items-center justify-center rounded-[9px] border border-white/[0.12] bg-white/[0.05] text-white/55 transition-colors hover:border-white/[0.25] hover:text-white/90 disabled:opacity-40"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <FileDown size={13} />}
        </button>
        {cached && (
          <button
            type="button"
            onClick={() => onRefetch(entry)}
            disabled={downloading}
            title={t('offline.actRefetch')}
            aria-label={t('offline.actRefetch')}
            className="flex size-[29px] cursor-pointer items-center justify-center rounded-[9px] border border-white/[0.12] bg-white/[0.05] text-white/55 transition-colors hover:border-sky-400/40 hover:text-sky-200 disabled:opacity-40"
          >
            {downloading ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <RefreshCw size={13} />
            )}
          </button>
        )}
        {cached && (
          <button
            type="button"
            onClick={() => onRemove(entry.urn)}
            title={t('offline.removeCached')}
            aria-label={t('offline.removeCached')}
            className="flex size-[29px] cursor-pointer items-center justify-center rounded-[9px] border border-white/[0.12] bg-white/[0.05] text-white/55 transition-colors hover:border-rose-400/40 hover:bg-rose-400/10 hover:text-rose-200"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  );
});

/** Sortable-обёртка: грип-ячейка получает listeners, строка — transform dnd-kit. */
export function SortableOfflineRow(props: Omit<OfflineRowProps, 'dragHandleProps'>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.entry.urn,
  });
  return (
    <div
      ref={setNodeRef}
      className={`h-full ${isDragging ? 'opacity-30' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <OfflineTrackRow {...props} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}

/** Плавающий клон для DragOverlay. */
export const OfflineRowClone = React.memo(function OfflineRowClone({
  entry,
}: {
  entry: OfflineEntry;
}) {
  const artwork = art(entry.track.artwork_url, 't200x200');
  const display = useTrackDisplay(entry.track);
  return (
    <div className="flex h-[56px] cursor-grabbing items-center gap-3 rounded-xl bg-[rgba(28,28,34,0.96)] px-3 shadow-[0_20px_50px_rgba(0,0,0,0.55)] ring-1 ring-white/15 backdrop-blur-xl">
      <GripVertical size={13} className="flex-none text-white/45" />
      <div className="size-[38px] flex-none overflow-hidden rounded-lg bg-white/[0.04]">
        {artwork && (
          <img src={artwork} alt="" className="size-full object-cover" decoding="async" />
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium text-white/88">{display.title}</p>
        <p className="truncate text-[11.5px] text-white/40">
          {display.artistLine || entry.track.user.username}
        </p>
      </div>
    </div>
  );
});
