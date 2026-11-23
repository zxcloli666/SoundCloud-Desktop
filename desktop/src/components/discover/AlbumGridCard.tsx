import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { CatalogAlbum } from '../../lib/discover';
import { dur } from '../../lib/formatters';
import { Disc3, Star } from '../../lib/icons';

export const ALBUM_CARD_TEXT = 70;

function AlbumGridCardImpl({ album }: { album: CatalogAlbum }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const kindLabel = t(`artist.kind.${album.type}`, { defaultValue: album.type });
  const facts = [
    t('album.tracksCount', { count: album.track_count }),
    album.total_duration_ms > 0 ? dur(album.total_duration_ms) : null,
    album.release_year,
  ].filter(Boolean);

  return (
    <button
      type="button"
      onClick={() => navigate(`/album/${encodeURIComponent(album.id)}`)}
      className="group flex h-full w-full cursor-pointer flex-col text-left"
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-ink/[0.05] ring-1 ring-ink/[0.08] transition-shadow duration-300 group-hover:ring-ink/20">
        {album.cover_url ? (
          <img
            src={album.cover_url}
            alt=""
            className="h-full w-full object-cover"
            decoding="async"
            loading="lazy"
            draggable={false}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Disc3 size={30} className="text-ink-20" />
          </div>
        )}
        <span
          data-scheme="dark"
          className="absolute top-2.5 left-2.5 rounded-full bg-black/60 px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-ink-90"
        >
          {kindLabel}
        </span>
        {album.star && (
          <span
            data-scheme="dark"
            className="absolute top-2.5 right-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-accent"
          >
            <Star size={11} fill="currentColor" />
          </span>
        )}
      </div>
      <p className="mt-3 truncate text-[13px] font-medium text-ink-90 transition-colors group-hover:text-ink">
        {album.title}
      </p>
      <p className="mt-0.5 truncate text-[11.5px] text-ink-45">{album.primary_artist.name}</p>
      <p className="mt-0.5 truncate text-[10.5px] tabular-nums text-ink-30">{facts.join(' · ')}</p>
    </button>
  );
}

export const AlbumGridCard = memo(AlbumGridCardImpl);
