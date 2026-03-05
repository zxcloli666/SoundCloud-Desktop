import { ListMusic } from 'lucide-react';
import React from 'react';

import { useNavigate } from 'react-router-dom';
import type { Playlist } from '../../lib/hooks.ts';
import { replaceArtSize } from '../../lib/utils.ts';
import { ScdnImg } from '../common/ScdnImg.tsx';

const PlaylistCardBase = ({ playlist }: { playlist: Playlist }) => {
  const navigate = useNavigate();
  const cover = replaceArtSize(playlist.artwork_url, 't300x300');

  return (
    <div
      className="group relative flex flex-col gap-3 cursor-pointer"
      onClick={() => navigate(`/playlist/${encodeURIComponent(playlist.urn)}`)}
    >
      <div className="relative aspect-square rounded-2xl overflow-hidden bg-white/[0.02] ring-1 ring-white/[0.06] shadow-lg group-hover:shadow-2xl group-hover:ring-white/[0.15] transition-all duration-500 ease-[var(--ease-apple)]">
        {cover ? (
          <ScdnImg
            src={cover}
            alt={playlist.title}
            className="w-full h-full object-cover transition-transform duration-700 ease-[var(--ease-apple)] group-hover:scale-[1.05]"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/[0.04] to-transparent">
            <ListMusic size={32} className="text-white/10" />
          </div>
        )}

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {playlist.track_count != null && (
          <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5 text-[11px] font-medium bg-black/60 backdrop-blur-md text-white/90 px-2.5 py-1 rounded-full shadow-lg">
            <ListMusic size={11} />
            {playlist.track_count}
          </div>
        )}
      </div>

      <div className="min-w-0 px-1">
        <p className="text-[14px] font-semibold text-white/90 truncate leading-snug group-hover:text-white transition-colors">
          {playlist.title}
        </p>
        <p className="text-[12px] text-white/40 truncate mt-1">
          {playlist.user?.username || 'Unknown'}
        </p>
      </div>
    </div>
  );
};
export const PlaylistCard = React.memo(PlaylistCardBase);
