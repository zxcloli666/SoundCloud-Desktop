import {memo, useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {useNavigate} from 'react-router-dom';
import {Disc3, Loader2} from '../../lib/icons';
import type {ArtistAlbum} from './types';
import {useArtistAlbums} from './useArtistData';

interface ArtistAlbumsTabProps {
  artistId: string;
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

function ArtistAlbumsTabImpl({ artistId }: ArtistAlbumsTabProps) {
  const { t } = useTranslation();
  const query = useArtistAlbums(artistId);
  const items = query.data ?? [];
  const buckets = useMemo(() => bucketByYear(items), [items]);

  if (query.isLoading) {
    return (
      <div className="py-24 flex justify-center">
        <Loader2 size={28} className="text-ink-20 animate-spin" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-24 flex flex-col items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-ink/[0.03] ring-1 ring-ink/[0.07]">
          <Disc3 size={24} className="text-ink-15" />
        </div>
        <p className="text-ink-30 text-sm">{t('artist.noAlbums')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-12 py-2">
      {buckets.map((bucket, idx) => (
        <YearGroup key={bucket.year ?? `unknown-${idx}`} year={bucket.year} items={bucket.items} />
      ))}
    </div>
  );
}

const YearGroup = memo(
  ({ year, items }: { year: number | null; items: ArtistAlbum[] }) => {
    const { t } = useTranslation();
    return (
        <div className="flex flex-col md:flex-row md:gap-8 gap-4">
        {/* Year marker */}
        <div className="md:w-[200px] md:shrink-0 flex md:flex-col md:items-end items-center md:sticky md:top-24 self-start">
          <div className="flex items-baseline gap-3 md:flex-col md:items-end md:gap-1 min-w-0 max-w-full">
            <span className="whitespace-nowrap text-[clamp(44px,6vw,72px)] font-bold leading-none tabular-nums tracking-tight text-ink-90">
              {year ?? '∞'}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-ink-30 md:text-right whitespace-nowrap">
              {year != null ? t('artist.releaseYear') : t('artist.unknownYear')} · {items.length}
            </span>
          </div>
        </div>

        {/* Albums grid */}
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
          {items.map((al) => (
            <AlbumCard key={al.id} album={al} />
          ))}
        </div>
      </div>
    );
  },
);

const AlbumCard = memo(({ album }: { album: ArtistAlbum }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const kind = (album.type ?? 'album').toLowerCase();
  const kindLabel = t(`artist.kind.${kind}`, { defaultValue: kind });

  return (
    <button
      type="button"
      onClick={() => navigate(`/album/${encodeURIComponent(album.id)}`)}
      className="group relative flex cursor-pointer flex-col gap-2 rounded-2xl border border-ink/[0.07] p-3 text-left transition-colors duration-200 hover:bg-ink/[0.05]"
    >
      <div className="relative aspect-square overflow-hidden rounded-xl bg-ink/[0.04] ring-1 ring-ink/[0.08]">
        {album.cover_url ? (
          <img
            src={album.cover_url}
            alt={album.title}
            className="h-full w-full object-cover"
            decoding="async"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Disc3 size={40} className="text-ink-15" />
          </div>
        )}
        <div
          data-scheme="dark"
          className="absolute left-2 top-2 rounded-full bg-shade-60 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-ink"
        >
          {kindLabel}
        </div>
      </div>
      <div className="px-1 min-w-0">
        <p className="text-[13px] font-semibold text-ink-90 truncate group-hover:text-ink">
          {album.title}
        </p>
        <p className="text-[11px] text-ink-35 truncate">
          {album.role === 'primary' ? kindLabel : t('artist.featured')}
          {album.release_year != null && ` · ${album.release_year}`}
        </p>
      </div>
    </button>
  );
});

export const ArtistAlbumsTab = memo(ArtistAlbumsTabImpl);
