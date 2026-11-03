import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { proxiedAssetUrl } from '../../lib/asset-url';
import { pagedUrl } from '../../lib/hooks';
import { Search, Trash2, X } from '../../lib/icons';
import type { ImportRow } from '../../stores/import';
import type { Track } from '../../stores/player';
import { useDebouncedValue } from '../discover/useDebouncedValue';
import { Skeleton } from '../ui/Skeleton';

const RESULT_LIMIT = 8;
const SEARCH_DEBOUNCE_MS = 350;

interface Props {
  row: ImportRow;
  current: Track | undefined;
  onPick: (track: Track) => void;
  onRemove: () => void;
  onClose: () => void;
}

export function ImportFinder({ row, current, onPick, onRemove, onClose }: Props) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(`${row.artist} ${row.title}`.trim());
  const debounced = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS);

  useEffect(() => input.current?.select(), []);

  const found = useQuery({
    queryKey: ['import', 'find', debounced],
    queryFn: () =>
      api<{ collection: Track[] }>(
        pagedUrl('/search/db/tracks', 0, RESULT_LIMIT, `q=${encodeURIComponent(debounced)}`),
      ),
    enabled: debounced.length >= 2,
    staleTime: 60_000,
  });

  return (
    <div
      role="dialog"
      aria-label={t('importer.find')}
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return;
        e.stopPropagation();
        onClose();
      }}
      className="rounded-2xl border border-ink/[0.1] bg-surface/95 p-3 shadow-[0_18px_60px_rgb(var(--shade)/calc(0.4*var(--shade-alpha)))] backdrop-blur-xl animate-fade-in-up"
    >
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-ink/[0.08] bg-ink/[0.04] px-3 py-2 focus-within:border-ink/[0.16]">
          <Search size={14} className="shrink-0 text-ink-40" />
          <input
            ref={input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('importer.findPlaceholder')}
            className="min-w-0 flex-1 bg-transparent text-[13px] text-ink-85 outline-none placeholder:text-ink-25"
          />
        </div>
        {row.urn && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={t('importer.removeMatch')}
            title={t('importer.removeMatch')}
            className="flex size-9 items-center justify-center rounded-xl border border-red-500/15 bg-red-500/10 text-red-300 transition-colors hover:bg-red-500/20 cursor-pointer"
          >
            <Trash2 size={14} />
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label={t('common.close')}
          className="flex size-9 items-center justify-center rounded-xl text-ink-40 transition-colors hover:bg-ink/[0.08] hover:text-ink-70 cursor-pointer"
        >
          <X size={14} />
        </button>
      </div>
      <ul className="mt-2 max-h-[220px] space-y-1 overflow-y-auto">
        {found.isFetching &&
          Array.from({ length: 4 }, (_, i) => (
            <li key={i} className="flex items-center gap-3 p-1.5">
              <Skeleton className="size-9" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-2.5 w-1/3" />
              </div>
            </li>
          ))}
        {!found.isFetching &&
          found.data?.collection.map((track) => (
            <li key={track.urn}>
              <button
                type="button"
                onClick={() => onPick(track)}
                className={`flex w-full items-center gap-3 rounded-xl p-1.5 text-left transition-colors cursor-pointer hover:bg-ink/[0.07] ${
                  current?.urn === track.urn ? 'bg-accent/10' : ''
                }`}
              >
                <TrackCover track={track} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink-85">
                    {track.title}
                  </span>
                  <span className="block truncate text-[11px] text-ink-45">
                    {track.user.username}
                  </span>
                </span>
              </button>
            </li>
          ))}
        {!found.isFetching && found.data?.collection.length === 0 && (
          <li className="px-2 py-4 text-center text-[12px] text-ink-40">
            {t('importer.findEmpty')}
          </li>
        )}
      </ul>
    </div>
  );
}

export function TrackCover({ track }: { track: Track | undefined }) {
  const src = track?.artwork_url ? proxiedAssetUrl(track.artwork_url) : null;
  return (
    <span className="size-9 shrink-0 overflow-hidden rounded-lg bg-ink/[0.08]">
      {src && <img src={src} alt="" loading="lazy" className="size-full object-cover" />}
    </span>
  );
}
