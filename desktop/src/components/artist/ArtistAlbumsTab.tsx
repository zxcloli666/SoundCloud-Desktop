import {memo, useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {useNavigate} from 'react-router-dom';
import {type Aura, auraRgba} from '../../lib/aura';
import {art} from '../../lib/formatters';
import {Disc3, Loader2} from '../../lib/icons';
import {usePerfMode} from '../../lib/perf';
import type {ArtistAlbum} from './types';
import {useArtistAlbums} from './useArtistData';

interface ArtistAlbumsTabProps {
  artistId: string;
  aura: Aura;
}

type Bucket = { year: number | null; items: ArtistAlbum[] };

function bucketByYear(items: ArtistAlbum[]): Bucket[] {
  const byYear = new Map<number | 'unknown', ArtistAlbum[]>();
  for (const a of items) {
    const k = a.release_year ?? 'unknown';
    const arr = byYear.get(k) ?? [];
    arr.push(a);
    byYear.set(k, arr);
  }
  const known: Bucket[] = [];
  for (const [k, arr] of byYear) {
    if (k === 'unknown') continue;
    known.push({ year: k as number, items: arr });
  }
  known.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
  const unknown = byYear.get('unknown');
  if (unknown && unknown.length > 0) known.push({ year: null, items: unknown });
  return known;
}

function ArtistAlbumsTabImpl({ artistId, aura }: ArtistAlbumsTabProps) {
  const { t } = useTranslation();
  const query = useArtistAlbums(artistId);
  const items = query.data ?? [];
  const buckets = useMemo(() => bucketByYear(items), [items]);

  if (query.isLoading) {
    return (
      <div className="py-24 flex justify-center">
        <Loader2 size={28} className="text-white/20 animate-spin" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-24 flex flex-col items-center gap-4">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '0.5px solid rgba(255,255,255,0.06)',
          }}
        >
          <Disc3 size={24} className="text-white/15" />
        </div>
        <p className="text-white/30 text-sm">{t('artist.noAlbums')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-12 py-2">
      {buckets.map((bucket, idx) => (
        <YearGroup
          key={bucket.year ?? `unknown-${idx}`}
          year={bucket.year}
          items={bucket.items}
          aura={aura}
        />
      ))}
    </div>
  );
}

const YearGroup = memo(
  ({ year, items, aura }: { year: number | null; items: ArtistAlbum[]; aura: Aura }) => {
    const { t } = useTranslation();
    return (
        <div className="deferred-year-group deferred-year-group--albums flex flex-col md:flex-row md:gap-8 gap-4">
        {/* Year marker */}
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
              {year ?? '∞'}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/30 md:text-right whitespace-nowrap">
              {year != null ? t('artist.releaseYear') : t('artist.unknownYear')} · {items.length}
            </span>
          </div>
        </div>

        {/* Albums grid */}
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
          {items.map((al) => (
            <AlbumCard key={al.id} album={al} aura={aura} />
          ))}
        </div>
      </div>
    );
  },
);

const AlbumCard = memo(({ album, aura }: { album: ArtistAlbum; aura: Aura }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
    const perf = usePerfMode();
  const kind = (album.type ?? 'album').toLowerCase();
  const kindLabel = t(`artist.kind.${kind}`, { defaultValue: kind });
    const cb = perf.blur(20);
    const badgeB = perf.blur(12);

  return (
    <button
      type="button"
      onClick={() => navigate(`/album/${encodeURIComponent(album.id)}`)}
      className="group relative flex flex-col gap-2 text-left p-3 rounded-2xl cursor-pointer transition-all duration-500 hover:scale-[1.03]"
      style={{
          background: cb > 0 ? 'rgba(255,255,255,0.03)' : 'rgba(22,22,26,0.85)',
        border: '0.5px solid rgba(255,255,255,0.06)',
          backdropFilter: cb > 0 ? `blur(${cb}px)` : undefined,
          WebkitBackdropFilter: cb > 0 ? `blur(${cb}px)` : undefined,
      }}
    >
      <div
        className="aspect-square rounded-xl overflow-hidden relative"
        style={{
          background: `linear-gradient(135deg, ${auraRgba(aura, 0.22)}, rgba(255,255,255,0.04))`,
          border: '0.5px solid rgba(255,255,255,0.08)',
        }}
      >
        {album.cover_url ? (
          <img
            src={art(album.cover_url, 't300x300') ?? undefined}
            alt={album.title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            decoding="async"
            loading="lazy"
            width={300}
            height={300}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Disc3 size={40} className="text-white/15" />
          </div>
        )}
        <div
          className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-[0.18em]"
          style={{
            background: 'rgba(0,0,0,0.55)',
            color: '#fff',
              backdropFilter: badgeB > 0 ? `blur(${badgeB}px)` : undefined,
              WebkitBackdropFilter: badgeB > 0 ? `blur(${badgeB}px)` : undefined,
            border: '0.5px solid rgba(255,255,255,0.12)',
          }}
        >
          {kindLabel}
        </div>
      </div>
      <div className="px-1 min-w-0">
        <p className="text-[13px] font-semibold text-white/90 truncate group-hover:text-white">
          {album.title}
        </p>
        <p className="text-[11px] text-white/35 truncate">
          {album.role === 'primary' ? kindLabel : t('artist.featured')}
          {album.release_year != null && ` · ${album.release_year}`}
        </p>
      </div>
    </button>
  );
});

export const ArtistAlbumsTab = memo(ArtistAlbumsTabImpl);
