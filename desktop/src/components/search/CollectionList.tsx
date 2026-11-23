import { Loader2, Play } from 'lucide-react';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CatalogAlbum } from '../../lib/discover';
import { art } from '../../lib/formatters';
import type { Playlist } from '../../lib/hooks';
import { albumTracks, type EntityQueue, playlistTracks } from '../../lib/voice/entity-tracks';
import { usePlayerStore } from '../../stores/player';

interface Row {
  key: string;
  title: string;
  author: string;
  image: string | null;
  path: string;
  queue: () => Promise<EntityQueue>;
}

function albumRow(album: CatalogAlbum): Row {
  return {
    key: `album-${album.id}`,
    title: album.title,
    author: album.primary_artist?.name ?? '',
    image: art(album.cover_url, 't300x300'),
    path: `/album/${encodeURIComponent(album.id)}`,
    queue: () => albumTracks(album.id),
  };
}

function playlistRow(playlist: Playlist): Row {
  return {
    key: `playlist-${playlist.urn}`,
    title: playlist.title,
    author: playlist.user?.username ?? '',
    image: art(playlist.artwork_url, 't300x300'),
    path: `/playlist/${encodeURIComponent(playlist.urn)}`,
    queue: () => playlistTracks(playlist.urn),
  };
}

export const CollectionList = memo(function CollectionList({
  albums,
  playlists,
  onOpen,
}: {
  albums?: CatalogAlbum[];
  playlists?: Playlist[];
  onOpen: (path: string) => void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState<string | null>(null);
  const rows = albums ? albums.map(albumRow) : (playlists ?? []).map(playlistRow);

  const play = async (row: Row) => {
    if (busy) return;
    setBusy(row.key);
    try {
      const { tracks, arm } = await row.queue();
      if (tracks.length === 0) return;
      usePlayerStore.getState().play(tracks[0], tracks);
      arm?.();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 pb-8">
      <div className="overflow-hidden rounded-xl border border-ink/[0.08]">
        {rows.map((row, index) => (
          <div
            key={row.key}
            className="group grid grid-cols-[28px_48px_minmax(0,1fr)] items-center gap-3 px-3 py-2 transition-colors hover:bg-ink/[0.05]"
          >
            <span className="text-right text-[12px] tabular-nums text-ink-25">{index + 1}</span>
            <button
              type="button"
              onClick={() => void play(row)}
              aria-label={`${t('track.play')} ${row.title}`}
              className="relative block aspect-square cursor-pointer overflow-hidden rounded-lg bg-ink/[0.06]"
            >
              {row.image ? (
                <img
                  src={row.image}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="flex h-full items-center justify-center text-sm font-semibold text-ink-25">
                  {row.title.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span
                data-scheme="dark"
                className={`absolute inset-0 grid place-items-center bg-shade-55 text-ink transition-opacity ${busy === row.key ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
              >
                {busy === row.key ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Play size={16} fill="currentColor" />
                )}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onOpen(row.path)}
              className="min-w-0 cursor-pointer text-left"
            >
              <span className="block truncate text-[13px] font-semibold text-ink-85 group-hover:text-ink">
                {row.title}
              </span>
              <span className="block truncate text-[11px] text-ink-40">{row.author}</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
});
