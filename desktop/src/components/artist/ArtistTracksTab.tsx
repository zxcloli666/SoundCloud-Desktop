import {memo, useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {dur, fc} from '../../lib/formatters';
import {Calendar, ListMusic, Loader2, Music} from '../../lib/icons';
import {useArtistDisplay, useDisplayTitle} from '../../lib/track-display';
import type {Track} from '../../stores/player';
import {TrackColumns} from '../music/columns/TrackColumns';
import {TrackStatusBadges} from '../music/TrackStatusBadges';
import {VirtualList} from '../ui/VirtualList';
import {ThemedTrackRow} from '../user/ThemedTrackRow';
import {useThemedShape} from '../user/useThemedShape';
import type {TracksSort} from './types';
import {useArtistTracks} from './useArtistData';

export type TracksView = 'list' | 'years';

interface ArtistTracksTabProps {
  artistId: string;
  role: 'primary' | 'featured';
  sort: TracksSort;
  onSortChange: (s: TracksSort) => void;
  view: TracksView;
  onViewChange: (v: TracksView) => void;
  showSort?: boolean;
}

const ROW_HEIGHT = 72;

function partition(tracks: Track[]): { available: Track[]; wanted: Track[] } {
  const available: Track[] = [];
  const wanted: Track[] = [];
  for (const t of tracks) {
    if (t.enrichment?.availability === 'wanted') wanted.push(t);
    else available.push(t);
  }
  return { available, wanted };
}

type YearBucket = { year: number | null; items: Track[] };

function compareByReleaseDateDesc(a: Track, b: Track): number {
  const da = a.enrichment?.release_date;
  const db = b.enrichment?.release_date;
  if (da && db) {
    if (da === db) return 0;
    return da < db ? 1 : -1;
  }
  if (da) return -1;
  if (db) return 1;
  return 0;
}

function groupByYear(tracks: Track[]): YearBucket[] {
  const map = new Map<number | 'unknown', Track[]>();
  for (const t of tracks) {
    const y = t.enrichment?.release_year;
    const key = typeof y === 'number' && y > 1900 ? y : 'unknown';
    const arr = map.get(key) ?? [];
    arr.push(t);
    map.set(key, arr);
  }
  const known: YearBucket[] = [];
  for (const [k, items] of map) {
    if (k === 'unknown') continue;
    items.sort(compareByReleaseDateDesc);
    known.push({ year: k as number, items });
  }
  known.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
  const undated = map.get('unknown');
  if (undated && undated.length > 0) {
    undated.sort(compareByReleaseDateDesc);
    known.push({ year: null, items: undated });
  }
  return known;
}

function ArtistTracksTabImpl({
  artistId,
  role,
  sort,
  onSortChange,
  view,
  onViewChange,
  showSort = true,
}: ArtistTracksTabProps) {
  const { t } = useTranslation();
  // Years view groups by release_year, so it must fetch by release date (not
  // popularity) and pull a deep page — otherwise low-play recent tracks (a fresh
  // album) fall past the popularity cutoff and the newest year bucket is empty.
  const yearsView = view === 'years';
  const query = useArtistTracks(
    artistId,
    role,
    yearsView ? 'recent' : sort,
    yearsView ? 200 : 80,
  );
  const tracks = query.data ?? [];
  const shape = useThemedShape(tracks[0]?.user?.urn);
  const { available, wanted } = useMemo(() => partition(tracks), [tracks]);
  const yearBuckets = useMemo(
    () => (view === 'years' ? groupByYear(available) : []),
    [view, available],
  );
  const yearsQueue = useMemo(
    () => (view === 'years' ? yearBuckets.flatMap((b) => b.items) : []),
    [view, yearBuckets],
  );
  const totalDuration = useMemo(
    () => tracks.reduce((acc, x) => acc + (x.duration ?? 0), 0),
    [tracks],
  );
  const taggedYears = useMemo(
    () => yearBuckets.filter((b) => b.year != null).length,
    [yearBuckets],
  );

  if (query.isLoading) {
    return (
      <div className="py-24 flex justify-center">
        <Loader2 size={28} className="text-ink-20 animate-spin" />
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <div className="py-24 flex flex-col items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-ink/[0.03] ring-1 ring-ink/[0.07]">
          <Music size={24} className="text-ink-15" />
        </div>
        <p className="text-ink-30 text-sm">
          {role === 'primary' ? t('artist.noTracks') : t('artist.noAppearances')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showSort && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-2 flex-wrap">
            <SortToggle sort={sort} onChange={onSortChange} disabled={view === 'years'} />
            <ViewToggle view={view} onChange={onViewChange} />
          </div>
          <span className="text-[11px] text-ink-30 font-bold uppercase tracking-[0.18em] tabular-nums">
            {fc(tracks.length)} · {dur(totalDuration)}
            {view === 'years' && taggedYears > 0 && (
              <span className="ml-2 text-ink-20">· {taggedYears} y</span>
            )}
          </span>
        </div>
      )}

      {view === 'list' && available.length > 0 && (
        <TrackColumns shape={shape}>
          <VirtualList
            items={available}
            rowHeight={ROW_HEIGHT}
            overscan={8}
            className="flex flex-col gap-1"
            getItemKey={(track) => track.urn}
            renderItem={(track, i) => (
              <ThemedTrackRow track={track} index={i} queue={available} />
            )}
          />
        </TrackColumns>
      )}

      {view === 'years' && yearBuckets.length > 0 && (
        <div className="@container flex flex-col gap-10">
          {yearBuckets.map((bucket, idx) => (
            <YearBlock key={bucket.year ?? `unknown-${idx}`} bucket={bucket} queue={yearsQueue} />
          ))}
        </div>
      )}

      {wanted.length > 0 && (
        <div className="space-y-3 pt-4">
          <div className="flex items-center gap-3 px-2">
            <span className="rounded-full bg-accent/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink ring-1 ring-accent/30">
              {t('artist.comingSoon')}
            </span>
            <span className="text-[11px] text-ink-30 tabular-nums">{fc(wanted.length)}</span>
            <div className="flex-1 h-px bg-ink/[0.05]" />
          </div>
          <div className="flex flex-col gap-1">
            {wanted.slice(0, 100).map((track, i) => (
              <WantedRow key={track.urn} track={track} index={i} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const YearBlock = memo(
  ({ bucket, queue }: { bucket: YearBucket; queue: Track[] }) => {
    const { t } = useTranslation();
    const shape = useThemedShape(bucket.items[0]?.user?.urn);
    const total = bucket.items.reduce((acc, x) => acc + (x.duration ?? 0), 0);
    return (
      <div className="flex flex-col @4xl:flex-row @4xl:gap-8 gap-3">
        {/* Year marker — same look as albums timeline */}
        <div className="@4xl:w-[200px] @4xl:shrink-0 flex @4xl:flex-col @4xl:items-end items-center @4xl:sticky @4xl:top-24 self-start">
          <div className="flex items-baseline gap-3 @4xl:flex-col @4xl:items-end @4xl:gap-1 min-w-0 max-w-full">
            <span className="whitespace-nowrap text-[clamp(44px,6vw,72px)] font-bold leading-none tabular-nums tracking-tight text-ink-90">
              {bucket.year ?? '∞'}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-ink-30 @4xl:text-right whitespace-nowrap">
              {bucket.year != null ? t('artist.releaseYear') : t('artist.unknownYear')} ·{' '}
              {bucket.items.length} · {dur(total)}
            </span>
          </div>
        </div>

        {/* Tracks of the year */}
        <div className="flex-1 min-w-0">
          <TrackColumns shape={shape} header={false}>
            <div className="flex flex-col gap-1">
              {bucket.items.map((track, i) => (
                <ThemedTrackRow key={track.urn} track={track} index={i} queue={queue} />
              ))}
            </div>
          </TrackColumns>
        </div>
      </div>
    );
  },
);

const SortToggle = memo(
  ({
    sort,
    onChange,
    disabled,
  }: {
    sort: TracksSort;
    onChange: (s: TracksSort) => void;
    disabled?: boolean;
  }) => {
    const { t } = useTranslation();
    const options: Array<{ id: TracksSort; label: string }> = [
      { id: 'popular', label: t('artist.sortPopular') },
      { id: 'recent', label: t('artist.sortRecent') },
    ];
    return (
      <div
        role="radiogroup"
        className={`chip-group ${disabled ? 'pointer-events-none opacity-40' : ''}`}
      >
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={o.id === sort}
            onClick={() => onChange(o.id)}
            className="chip-seg"
          >
            {o.label}
          </button>
        ))}
      </div>
    );
  },
);

const ViewToggle = memo(
  ({ view, onChange }: { view: TracksView; onChange: (v: TracksView) => void }) => {
    const { t } = useTranslation();
    const options: Array<{ id: TracksView; label: string; icon: React.ReactNode }> = [
      { id: 'list', label: t('artist.viewList'), icon: <ListMusic size={13} /> },
      { id: 'years', label: t('artist.viewYears'), icon: <Calendar size={13} /> },
    ];
    return (
      <div role="radiogroup" className="chip-group">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={o.id === view}
            onClick={() => onChange(o.id)}
            className="chip-seg"
          >
            {o.icon}
            {o.label}
          </button>
        ))}
      </div>
    );
  },
);

const WantedRow = memo(({ track, index }: { track: Track; index: number }) => {
  const displayTitle = useDisplayTitle(track);
  const artistDisplay = useArtistDisplay(track);
  return (
    <div className="@container flex items-center gap-4 rounded-2xl px-4 py-2.5 opacity-50">
      <div className="w-10 h-10 flex items-center justify-center shrink-0">
        <span className="text-[12px] text-ink-20 tabular-nums font-semibold">{index + 1}</span>
      </div>
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-ink/[0.03] ring-1 ring-ink/[0.07]">
        <Music size={16} className="text-ink-20" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-ink-55 truncate">{displayTitle}</p>
        <p className="text-[11px] text-ink-25 truncate">{artistDisplay.primary}</p>
      </div>
      <div className="hidden @lg:flex shrink-0">
        <TrackStatusBadges meta={track._scd_meta} videos={track.videos} />
      </div>
      {track.enrichment?.release_year && (
        <span className="text-[11px] text-ink-25 tabular-nums shrink-0">
          {track.enrichment.release_year}
        </span>
      )}
    </div>
  );
});

export const ArtistTracksTab = memo(ArtistTracksTabImpl);
