import React from 'react';
import { ListMusic } from '../../../lib/icons';
import type { LocalPlaylist } from '../../../lib/local-library';
import { localCoverUrl } from '../../../lib/local-library';
import { useLocalLibrary } from '../../../stores/local-library';

export const LocalPlaylistCover = React.memo(function LocalPlaylistCover({
  playlist,
  className,
}: {
  playlist: LocalPlaylist;
  className: string;
}) {
  const tracks = useLocalLibrary((s) => s.tracks);
  const covers: string[] = [];
  for (const id of playlist.trackIds) {
    const url = localCoverUrl(tracks[id]?.cover ?? null);
    if (url && !covers.includes(url)) covers.push(url);
    if (covers.length === 4) break;
  }

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        background: 'linear-gradient(135deg, var(--color-accent-glow), rgba(255,255,255,0.03) 70%)',
      }}
    >
      {covers.length >= 4 ? (
        <div className="grid h-full w-full grid-cols-2 grid-rows-2">
          {covers.map((src) => (
            <img key={src} src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
          ))}
        </div>
      ) : covers.length > 0 ? (
        <img src={covers[0]} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-white/45">
          <ListMusic size={28} />
        </div>
      )}
    </div>
  );
});
