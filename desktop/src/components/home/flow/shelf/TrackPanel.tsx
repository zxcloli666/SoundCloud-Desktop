import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { art } from '../../../../lib/formatters';
import { Heart, pauseWhite12, playWhite12 } from '../../../../lib/icons';
import { setTrackLiked } from '../../../../lib/like-toggle';
import { useTrackPlay } from '../../../../lib/useTrackPlay';
import type { Track } from '../../../../stores/player';
import { usePlayerStore } from '../../../../stores/player';
import { ShelfAction, ShelfCard } from './ShelfCard';
import { ShelfScroll } from './ShelfScroll';

interface CardProps {
  track: Track;
  queue: Track[];
  onPlay?: () => void;
  removable: boolean;
}

function TrackShelfCard({ track, queue, onPlay, removable }: CardProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { isThisPlaying, isThis, togglePlay } = useTrackPlay(track, queue, onPlay);
  return (
    <ShelfCard
      scrollKey={track.urn}
      cover={art(track.artwork_url || track.user?.avatar_url, 't300x300')}
      title={track.title}
      subtitle={track.user?.username}
      active={isThis}
      coverLabel={track.title}
      onOpen={togglePlay}
      overlay={
        <span
          data-scheme="dark"
          className={`absolute inset-0 flex items-center justify-center bg-black/45 text-ink transition-opacity ${
            isThisPlaying
              ? 'opacity-100'
              : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'
          }`}
        >
          {isThisPlaying ? pauseWhite12 : playWhite12}
        </span>
      }
      action={
        removable && (
          <ShelfAction
            label={t('flowRedesign.removeLiked')}
            onClick={() => void setTrackLiked(qc, track, false)}
          >
            <Heart size={13} fill="currentColor" aria-hidden />
          </ShelfAction>
        )
      }
    />
  );
}

interface Props {
  tracks: Track[];
  removable?: boolean;
  onPlay?: () => void;
  onEnd?: () => void;
}

export function TrackPanel({ tracks, removable = false, onPlay, onEnd }: Props) {
  const currentUrn = usePlayerStore((s) => s.currentTrack?.urn);
  return (
    <ShelfScroll
      items={tracks}
      keyOf={(track) => track.urn}
      activeKey={currentUrn}
      onEnd={onEnd}
      renderItem={(track) => (
        <TrackShelfCard track={track} queue={tracks} onPlay={onPlay} removable={removable} />
      )}
    />
  );
}
