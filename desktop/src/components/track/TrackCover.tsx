import React from 'react';
import { Pause, Play } from '../../lib/icons';
import { useVideoOpaque } from '../../lib/video-element';
import { AlbumCoverArtifact } from '../album/AlbumCoverArtifact';
import { VideoLoadMark } from '../music/lyrics/VideoLoadMark';
import { RoomVideo } from './RoomVideo';

export const TrackCover = React.memo(function TrackCover({
  title,
  coverUrl,
  isPlaying,
  isCurrent,
  onToggle,
}: {
  title: string;
  coverUrl?: string;
  isPlaying: boolean;
  isCurrent: boolean;
  onToggle: () => void;
}) {
  const live = useVideoOpaque() === 'room';
  const held = isPlaying && !live;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={title}
      data-ui="artwork"
      className="group/cover relative shrink-0 cursor-pointer self-center @min-[740px]:self-start"
    >
      <AlbumCoverArtifact title={title} coverUrl={coverUrl} hasStar={false}>
        <RoomVideo on={isCurrent} />
      </AlbumCoverArtifact>
      <VideoLoadMark host="room" className="right-4 top-4" />
      <div
        data-scheme="dark"
        className={`pointer-events-none absolute inset-0 flex items-center justify-center rounded-3xl bg-black/30 transition-opacity duration-300 ${
          held ? 'opacity-100' : 'opacity-0 group-hover/cover:opacity-100'
        }`}
      >
        <span className="flex h-16 w-16 items-center justify-center rounded-full border border-(--disc-line) bg-(--disc) text-(--disc-ink)">
          {isPlaying ? (
            <Pause size={24} fill="currentColor" strokeWidth={0} />
          ) : (
            <Play size={24} fill="currentColor" strokeWidth={0} className="ml-1" />
          )}
        </span>
      </div>
    </button>
  );
});
