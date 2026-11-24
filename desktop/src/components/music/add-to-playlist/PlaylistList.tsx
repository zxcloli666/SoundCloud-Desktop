import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useRef } from 'react';
import { type Playlist, usePlaylistsWith } from '../../../lib/hooks';
import { PlaylistRow } from './PlaylistRow';

const ROW_HEIGHT = 66;

export function PlaylistList({
  playlists,
  trackUrn,
  onEnd,
}: {
  playlists: Playlist[];
  trackUrn: string;
  onEnd: () => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const { inside, ready, mark } = usePlaylistsWith(trackUrn);
  const virtual = useVirtualizer({
    count: playlists.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
  });

  const rows = virtual.getVirtualItems();
  const last = rows[rows.length - 1]?.index ?? -1;
  useEffect(() => {
    if (last === playlists.length - 1) onEnd();
  }, [last, playlists.length, onEnd]);

  return (
    <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-2">
      <div className="relative" style={{ height: virtual.getTotalSize() }}>
        {rows.map((row) => {
          const playlist = playlists[row.index];
          return (
            <div
              key={playlist.urn}
              className="absolute inset-x-0 top-0 py-[1px]"
              style={{ height: ROW_HEIGHT, transform: `translateY(${row.start}px)` }}
            >
              <PlaylistRow
                playlist={playlist}
                trackUrn={trackUrn}
                inside={inside?.has(playlist.urn) ?? false}
                ready={ready}
                onMark={mark}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
