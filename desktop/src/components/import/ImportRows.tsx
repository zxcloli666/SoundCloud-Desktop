import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy, Search } from '../../lib/icons';
import { useImportStore } from '../../stores/import';
import type { Track } from '../../stores/player';
import { Skeleton } from '../ui/Skeleton';
import { ImportFinder, TrackCover } from './ImportFinder';

const ROW_HEIGHT = 56;
const SKELETON_ROWS = 3;

type Filter = 'all' | 'missed';

export function ImportRows({ editable }: { editable: boolean }) {
  const { t } = useTranslation();
  const rows = useImportStore((s) => s.rows);
  const tracks = useImportStore((s) => s.tracks);
  const total = useImportStore((s) => s.progress?.total ?? 0);
  const setMatch = useImportStore((s) => s.setMatch);
  const [filter, setFilter] = useState<Filter>('all');
  const [editing, setEditing] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  const missed = useMemo(() => rows.filter((row) => !row.urn), [rows]);
  const shown = filter === 'missed' ? missed : rows;
  const waiting = editable ? 0 : Math.max(0, Math.min(SKELETON_ROWS, total - rows.length));
  const count = shown.length + waiting;

  const virtual = useVirtualizer({
    count,
    getScrollElement: () => scroller.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  const following = useRef(true);
  useEffect(() => {
    if (!editable && following.current && count > 0) virtual.scrollToIndex(count - 1);
  }, [count, editable, virtual]);

  const copyMissed = () => {
    const text = missed.map((row) => `${row.artist} - ${row.title}`.replace(/^ - /, '')).join('\n');
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const row = editing === null ? undefined : rows.find((r) => r.position === editing);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div
          role="tablist"
          className="flex gap-0.5 rounded-[11px] border border-ink/[0.08] bg-ink/[0.02] p-[3px]"
        >
          {(['all', 'missed'] as const).map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={filter === id}
              onClick={() => setFilter(id)}
              className={`rounded-lg px-3 py-[5px] text-[12px] font-medium transition-colors cursor-pointer ${
                filter === id ? 'bg-ink/[0.08] text-ink-92' : 'text-ink-50 hover:text-ink-80'
              }`}
            >
              {t(`importer.filter.${id}`)}{' '}
              <span
                className={`font-mono ${id === 'missed' && missed.length ? 'text-red-400' : ''}`}
              >
                {id === 'all' ? rows.length : missed.length}
              </span>
            </button>
          ))}
        </div>
        {missed.length > 0 && (
          <button
            type="button"
            onClick={copyMissed}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors cursor-pointer ${
              copied
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                : 'border-ink/[0.08] bg-ink/[0.05] text-ink-70 hover:bg-ink/[0.09]'
            }`}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {t(copied ? 'importer.copied' : 'importer.copyMissed')}
          </button>
        )}
      </div>

      <div className="relative">
        <div
          ref={scroller}
          onScroll={(e) => {
            const el = e.currentTarget;
            following.current = el.scrollHeight - el.scrollTop - el.clientHeight < ROW_HEIGHT * 2;
          }}
          className="h-[300px] overflow-y-auto rounded-2xl border border-ink/[0.06] bg-ink/[0.02]"
        >
          <div style={{ height: virtual.getTotalSize(), position: 'relative' }}>
            {virtual.getVirtualItems().map((item) => {
              const data = shown[item.index];
              return (
                <div
                  key={data ? data.position : `wait-${item.index}`}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: ROW_HEIGHT,
                    transform: `translateY(${item.start}px)`,
                  }}
                >
                  {data ? (
                    <Row
                      editable={editable}
                      row={data}
                      track={data.urn ? tracks[data.urn] : undefined}
                      onOpen={() => setEditing(data.position)}
                    />
                  ) : (
                    <WaitingRow />
                  )}
                </div>
              );
            })}
          </div>
          {count === 0 && filter === 'missed' && (
            <p className="p-6 text-center text-[12px] text-ink-40">{t('importer.noMissed')}</p>
          )}
        </div>

        {row && (
          <ImportFinder
            key={row.position}
            row={row}
            current={row.urn ? tracks[row.urn] : undefined}
            onPick={(track) => {
              setMatch(row.position, track);
              setEditing(null);
            }}
            onRemove={() => {
              setMatch(row.position, null);
              setEditing(null);
            }}
            onClose={() => setEditing(null)}
          />
        )}
      </div>
    </div>
  );
}

function WaitingRow() {
  return (
    <div className="flex h-full items-center gap-3 px-3">
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-2.5 w-1/3" />
      </div>
      <Skeleton className="size-9" />
      <div className="w-1/3 space-y-1.5">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-2.5 w-2/3" />
      </div>
    </div>
  );
}

function Row({
  row,
  track,
  editable,
  onOpen,
}: {
  row: { artist: string; title: string; urn: string | null };
  track: Track | undefined;
  editable: boolean;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const missed = !row.urn;

  return (
    <button
      type="button"
      disabled={!editable}
      onClick={onOpen}
      className={`group flex h-full w-full items-center gap-3 px-3 text-left transition-colors animate-fade-in-up motion-reduce:animate-none disabled:cursor-default ${
        missed ? 'bg-red-500/[0.06]' : ''
      } ${editable ? 'cursor-pointer hover:bg-ink/[0.05] focus-visible:bg-ink/[0.07] focus-visible:outline-none' : ''}`}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-ink-85">{row.title}</span>
        <span className="block truncate text-[11px] text-ink-45">{row.artist}</span>
      </span>
      {missed ? (
        <span className="flex shrink-0 items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-[11px] font-semibold text-red-300">
          <Search size={12} />
          {t('importer.find')}
        </span>
      ) : (
        <>
          <TrackCover track={track} />
          <span className="min-w-0 basis-[38%]">
            {track ? (
              <>
                <span className="block truncate text-[13px] text-ink-80">{track.title}</span>
                <span className="block truncate text-[11px] text-ink-45">
                  {track.user.username}
                </span>
              </>
            ) : (
              <Skeleton className="h-3 w-3/4" />
            )}
          </span>
        </>
      )}
    </button>
  );
}
