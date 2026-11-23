import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { resolveAura } from '../../lib/aura';
import { type CatalogAlbum, type CatalogArtist, useDiscoverSpotlight } from '../../lib/discover';
import { dur, fc } from '../../lib/formatters';
import { Disc3, Headphones, ListMusic, Sparkles, Star, User } from '../../lib/icons';
import { HorizontalScroll } from '../ui/HorizontalScroll';
import { Skeleton } from '../ui/Skeleton';
import { SyncNotice } from '../ui/SyncNotice';

function DiscoverSpotlightImpl() {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useDiscoverSpotlight();
  const items = data?.items ?? [];
  const isFailed = isError && items.length === 0;

  if (!isLoading && !isFailed && items.length === 0) return null;

  return (
    <section>
      <div className="mb-3 flex items-center gap-2.5 px-1">
        <Sparkles size={16} className="text-ink-55" />
        <h2 className="text-[16px] font-bold tracking-tight text-ink-90">
          {t('discover.spotlightTitle')}
        </h2>
        {items.length > 0 && (
          <span className="text-[12px] tabular-nums text-ink-30">{items.length}</span>
        )}
      </div>

      {isLoading ? (
        <HorizontalScroll>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[340px] w-[260px] shrink-0 rounded-3xl" />
          ))}
        </HorizontalScroll>
      ) : isFailed ? (
        <div className="py-8">
          <SyncNotice kind="failed" onRetry={() => void refetch()} />
        </div>
      ) : (
        <HorizontalScroll>
          {items.map((it) =>
            it.kind === 'album' ? (
              <AlbumSpotlightCard key={`al-${it.album.id}`} album={it.album} />
            ) : (
              <ArtistSpotlightCard key={`ar-${it.artist.id}`} artist={it.artist} />
            ),
          )}
        </HorizontalScroll>
      )}
    </section>
  );
}

const AlbumSpotlightCard = memo(function AlbumSpotlightCard({ album }: { album: CatalogAlbum }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const kindLabel = t(`artist.kind.${album.type}`, { defaultValue: album.type });

  return (
    <button
      type="button"
      onClick={() => navigate(`/album/${encodeURIComponent(album.id)}`)}
      className="group relative h-[340px] w-[260px] shrink-0 cursor-pointer overflow-hidden rounded-3xl bg-ink/[0.05] ring-1 ring-ink/[0.08] transition-shadow duration-300 hover:ring-ink/20"
    >
      {album.cover_url ? (
        <img
          src={album.cover_url}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          decoding="async"
          loading="lazy"
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <Disc3 size={44} className="text-ink-20" />
        </div>
      )}

      <span
        data-scheme="dark"
        className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-ink-90"
      >
        <Disc3 size={10} /> {kindLabel}
      </span>

      <div
        data-scheme="dark"
        className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 bg-gradient-to-t from-black/80 via-black/50 to-transparent px-5 pt-14 pb-5 text-left"
      >
        <p className="truncate text-[11px] font-semibold text-ink-75">
          {album.primary_artist.name}
        </p>
        <p className="line-clamp-2 text-[20px] font-bold leading-tight tracking-tight text-ink">
          {album.title}
        </p>
        <p className="flex items-center gap-2 text-[10.5px] tabular-nums text-ink-60">
          <span className="inline-flex items-center gap-1">
            <ListMusic size={10} /> {album.track_count}
          </span>
          {album.total_duration_ms > 0 && <span>· {dur(album.total_duration_ms)}</span>}
          {album.release_year && <span>· {album.release_year}</span>}
        </p>
      </div>
    </button>
  );
});

const ArtistSpotlightCard = memo(function ArtistSpotlightCard({
  artist,
}: {
  artist: CatalogArtist;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const ring = useMemo(
    () =>
      artist.star && artist.aura_id
        ? resolveAura(artist.aura_id, artist.custom_hex ?? null).orbs
        : null,
    [artist.aura_id, artist.custom_hex, artist.star],
  );

  return (
    <button
      type="button"
      onClick={() => navigate(`/artist/${encodeURIComponent(artist.id)}`)}
      className="panel group relative flex h-[340px] w-[260px] shrink-0 cursor-pointer flex-col items-center overflow-hidden rounded-3xl px-6 pt-10 transition-colors hover:border-ink/[0.16] hover:bg-ink/[0.04]"
    >
      <div className="relative h-[116px] w-[116px]">
        {ring && (
          <div
            className="absolute -inset-[5px] rounded-full p-[2px]"
            style={{
              background: `conic-gradient(from 200deg, ${ring[0]}, ${ring[1]}, ${ring[2]}, ${ring[0]})`,
              WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
              WebkitMaskComposite: 'xor',
              maskComposite: 'exclude',
            }}
          />
        )}
        <div className="relative h-full w-full overflow-hidden rounded-full bg-ink/[0.05] ring-1 ring-ink/[0.08]">
          {artist.avatar_url ? (
            <img
              src={artist.avatar_url}
              alt=""
              className="h-full w-full object-cover"
              decoding="async"
              loading="lazy"
              draggable={false}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <User size={34} className="text-ink-20" />
            </div>
          )}
        </div>
        {artist.star && (
          <span
            data-scheme="dark"
            className="absolute -right-0.5 -bottom-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-accent"
          >
            <Star size={12} fill="currentColor" />
          </span>
        )}
      </div>

      <p className="mt-5 w-full truncate text-center text-[19px] font-bold tracking-tight text-ink-95">
        {artist.name}
      </p>
      {artist.country && (
        <p className="mt-1 text-[11px] font-medium text-ink-40">{artist.country}</p>
      )}

      {artist.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap justify-center gap-1">
          {artist.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-ink/[0.06] px-2.5 py-0.5 text-[10.5px] font-medium text-ink-60"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="absolute inset-x-5 bottom-5 flex items-center justify-between gap-3 text-[11px] tabular-nums">
        <span className="inline-flex items-center gap-1.5 font-semibold text-ink-65">
          <Headphones size={11} className="text-ink-40" />
          {fc(artist.monthly_listeners)}
        </span>
        <span className="rounded-full bg-ink/[0.06] px-2.5 py-1 font-semibold text-ink-60">
          {t('discover.trendValue', { value: Math.round(artist.popularity * 100) })}
        </span>
      </div>
    </button>
  );
});

export const DiscoverSpotlight = memo(DiscoverSpotlightImpl);
