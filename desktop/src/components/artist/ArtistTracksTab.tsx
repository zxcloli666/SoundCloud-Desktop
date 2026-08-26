import {memo, useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {type Aura, auraRgba} from '../../lib/aura';
import {dur, fc} from '../../lib/formatters';
import {Calendar, ListMusic, Loader2, Music} from '../../lib/icons';
import {usePerfMode} from '../../lib/perf';
import {useArtistDisplay, useDisplayTitle} from '../../lib/track-display';
import type {Track} from '../../stores/player';
import {TrackStatusBadges} from '../music/TrackStatusBadges';
import {VirtualList} from '../ui/VirtualList';
import {ThemedTrackRow} from '../user/ThemedTrackRow';
import type {TracksSort} from './types';
import {useArtistTracks} from './useArtistData';

export type TracksView = 'list' | 'years';

interface ArtistTracksTabProps {
  artistId: string;
  role: 'primary' | 'featured';
  aura: Aura;
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
  aura,
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
        <Loader2 size={28} className="text-white/20 animate-spin" />
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <div className="py-24 flex flex-col items-center gap-4">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{
            background: 'rgba(255,255,255,0.03)',
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)',
          }}
        >
          <Music size={24} className="text-white/15" />
        </div>
        <p className="text-white/30 text-sm">
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
            <SortToggle
              sort={sort}
              onChange={onSortChange}
              aura={aura}
              disabled={view === 'years'}
            />
            <ViewToggle view={view} onChange={onViewChange} aura={aura} />
          </div>
          <span className="text-[11px] text-white/30 font-bold uppercase tracking-[0.18em] tabular-nums">
            {fc(tracks.length)} · {dur(totalDuration)}
            {view === 'years' && taggedYears > 0 && (
              <span className="ml-2 text-white/20">· {taggedYears} y</span>
            )}
          </span>
        </div>
      )}

      {view === 'list' && available.length > 0 && (
        <VirtualList
          items={available}
          rowHeight={ROW_HEIGHT}
          overscan={8}
          className="flex flex-col gap-1"
          getItemKey={(track) => track.urn}
          renderItem={(track, i) => (
            <ThemedTrackRow track={track} index={i} queue={available} aura={aura} />
          )}
        />
      )}

      {view === 'years' && yearBuckets.length > 0 && (
        <div className="flex flex-col gap-10">
          {yearBuckets.map((bucket, idx) => (
            <YearBlock
              key={bucket.year ?? `unknown-${idx}`}
              bucket={bucket}
              queue={yearsQueue}
              aura={aura}
            />
          ))}
        </div>
      )}

      {wanted.length > 0 && (
        <div className="space-y-3 pt-4">
          <div className="flex items-center gap-3 px-2">
            <span
              className="text-[10px] font-bold uppercase tracking-[0.22em] px-3 py-1 rounded-full"
              style={{
                background: auraRgba(aura, 0.16),
                color: '#fff',
                boxShadow: `inset 0 0 0 1px ${auraRgba(aura, 0.3)}`,
              }}
            >
              {t('artist.comingSoon')}
            </span>
            <span className="text-[11px] text-white/30 tabular-nums">{fc(wanted.length)}</span>
            <div className="flex-1 h-px bg-white/[0.05]" />
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
  ({ bucket, queue, aura }: { bucket: YearBucket; queue: Track[]; aura: Aura }) => {
    const { t } = useTranslation();
    const total = bucket.items.reduce((acc, x) => acc + (x.duration ?? 0), 0);
    return (
      <div className="deferred-year-group deferred-year-group--tracks flex flex-col md:flex-row md:gap-8 gap-3">
        {/* Year marker — same look as albums timeline */}
        <div className="md:w-[200px] md:shrink-0 flex md:flex-col md:items-end items-center md:sticky md:top-24 self-start">
          <div className="flex items-baseline gap-3 md:flex-col md:items-end md:gap-1 min-w-0 max-w-full">
            <span
              className="font-black leading-none tabular-nums tracking-tight whitespace-nowrap text-[clamp(48px,7vw,80px)]"
              style={{
                background: `linear-gradient(180deg, ${auraRgba(aura, 0.95)}, ${auraRgba(aura, 0.4)})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                filter: `drop-shadow(0 4px 24px ${auraRgba(aura, 0.35)})`,
              }}
            >
              {bucket.year ?? '∞'}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/30 md:text-right whitespace-nowrap">
              {bucket.year != null ? t('artist.releaseYear') : t('artist.unknownYear')} ·{' '}
              {bucket.items.length} · {dur(total)}
            </span>
          </div>
        </div>

        {/* Tracks of the year */}
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          {bucket.items.map((track, i) => (
            <ThemedTrackRow key={track.urn} track={track} index={i} queue={queue} aura={aura} />
          ))}
        </div>
      </div>
    );
  },
);

const SortToggle = memo(
  ({
    sort,
    onChange,
    aura,
    disabled,
  }: {
    sort: TracksSort;
    onChange: (s: TracksSort) => void;
    aura: Aura;
    disabled?: boolean;
  }) => {
    const { t } = useTranslation();
    const b = usePerfMode().blur(20);
    const options: Array<{ id: TracksSort; label: string }> = [
      { id: 'popular', label: t('artist.sortPopular') },
      { id: 'recent', label: t('artist.sortRecent') },
    ];
    return (
      <div
        className={`inline-flex items-center gap-1 p-1 rounded-2xl transition-opacity ${disabled ? 'opacity-40 pointer-events-none' : ''}`}
        style={{
          background: b > 0 ? 'rgba(255,255,255,0.03)' : 'rgba(22,22,26,0.85)',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)',
          backdropFilter: b > 0 ? `blur(${b}px)` : undefined,
          WebkitBackdropFilter: b > 0 ? `blur(${b}px)` : undefined,
        }}
      >
        {options.map((o) => {
          const active = o.id === sort;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onChange(o.id)}
              className={`relative px-4 h-8 rounded-xl text-[12px] font-semibold cursor-pointer transition-all ${
                active ? 'text-white' : 'text-white/40 hover:text-white/70'
              }`}
              style={
                active
                  ? {
                      background: `linear-gradient(180deg, ${auraRgba(aura, 0.22)}, ${auraRgba(aura, 0.06)})`,
                      boxShadow: `inset 0 0 0 1px ${auraRgba(aura, 0.35)}, 0 4px 12px ${auraRgba(aura, 0.2)}`,
                    }
                  : undefined
              }
            >
              {o.label}
            </button>
          );
        })}
      </div>
    );
  },
);

const ViewToggle = memo(
  ({
    view,
    onChange,
    aura,
  }: {
    view: TracksView;
    onChange: (v: TracksView) => void;
    aura: Aura;
  }) => {
    const { t } = useTranslation();
    const b = usePerfMode().blur(20);
    const options: Array<{ id: TracksView; label: string; icon: React.ReactNode }> = [
      {
        id: 'list',
        label: t('artist.viewList'),
        icon: <ListMusic size={13} />,
      },
      {
        id: 'years',
        label: t('artist.viewYears'),
        icon: <Calendar size={13} />,
      },
    ];
    return (
      <div
        className="inline-flex items-center gap-1 p-1 rounded-2xl"
        style={{
          background: b > 0 ? 'rgba(255,255,255,0.03)' : 'rgba(22,22,26,0.85)',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)',
          backdropFilter: b > 0 ? `blur(${b}px)` : undefined,
          WebkitBackdropFilter: b > 0 ? `blur(${b}px)` : undefined,
        }}
      >
        {options.map((o) => {
          const active = o.id === view;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onChange(o.id)}
              className={`relative inline-flex items-center gap-1.5 px-3 h-8 rounded-xl text-[12px] font-semibold cursor-pointer transition-all ${
                active ? 'text-white' : 'text-white/40 hover:text-white/70'
              }`}
              style={
                active
                  ? {
                      background: `linear-gradient(180deg, ${auraRgba(aura, 0.22)}, ${auraRgba(aura, 0.06)})`,
                      boxShadow: `inset 0 0 0 1px ${auraRgba(aura, 0.35)}, 0 4px 12px ${auraRgba(aura, 0.2)}`,
                    }
                  : undefined
              }
            >
              {o.icon}
              {o.label}
            </button>
          );
        })}
      </div>
    );
  },
);

const WantedRow = memo(({ track, index }: { track: Track; index: number }) => {
  const displayTitle = useDisplayTitle(track);
  const artistDisplay = useArtistDisplay(track);
  return (
    <div
      className="flex items-center gap-4 px-4 py-2.5 rounded-2xl opacity-50"
      style={{ background: 'rgba(255,255,255,0.015)' }}
    >
      <div className="w-10 h-10 flex items-center justify-center shrink-0">
        <span className="text-[12px] text-white/20 tabular-nums font-semibold">{index + 1}</span>
      </div>
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
        style={{
          background: 'rgba(255,255,255,0.03)',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)',
        }}
      >
        <Music size={16} className="text-white/20" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-white/55 truncate">{displayTitle}</p>
        <p className="text-[11px] text-white/25 truncate">{artistDisplay.primary}</p>
      </div>
      <div className="hidden md:flex shrink-0">
        <TrackStatusBadges meta={track._scd_meta} />
      </div>
      {track.enrichment?.release_year && (
        <span className="text-[11px] text-white/25 tabular-nums shrink-0">
          {track.enrichment.release_year}
        </span>
      )}
    </div>
  );
});

export const ArtistTracksTab = memo(ArtistTracksTabImpl);
