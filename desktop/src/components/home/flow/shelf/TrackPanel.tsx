import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { art } from '../../../../lib/formatters';
import { Heart, pauseWhite12, playWhite12 } from '../../../../lib/icons';
import { setTrackLiked } from '../../../../lib/like-toggle';
import { removeSuperlike } from '../../../../lib/superlike-actions';
import { useTrackPlay } from '../../../../lib/useTrackPlay';
import type { Track } from '../../../../stores/player';
import { usePlayerStore } from '../../../../stores/player';
import { SuperHeart } from '../../../music/superlike/SuperHeart';
import { TrackRating } from '../../../music/TrackRating';
import { ShelfAction, ShelfCard } from './ShelfCard';
import { ShelfScroll } from './ShelfScroll';

type Removes = 'like' | 'superlike';

interface CardProps {
  track: Track;
  queue: Track[];
  onPlay?: () => void;
  removes?: Removes;
}

function TrackShelfCard({ track, queue, onPlay, removes }: CardProps) {
  const { isThisPlaying, isThis, togglePlay, mark } = useTrackPlay(track, queue, onPlay);
  return (
    <ShelfCard
      scrollKey={track.urn}
      cover={art(track.artwork_url || track.user?.avatar_url, 't300x300')}
      title={track.title}
      subtitle={track.user?.username}
      active={isThis}
      coverLabel={track.title}
      onOpen={togglePlay}
      mark={mark}
      overlay={
        <>
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
          <span className="absolute bottom-1.5 left-1.5 flex">
            <TrackRating meta={track._scd_meta} videos={track.videos} onArt />
          </span>
        </>
      }
      action={removes && <RemoveAction track={track} removes={removes} />}
    />
  );
}

function RemoveAction({ track, removes }: { track: Track; removes: Removes }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  if (removes === 'superlike') {
    return (
      <ShelfAction label={t('superlike.remove')} onClick={() => void removeSuperlike(track)}>
        <SuperHeart size={13} />
      </ShelfAction>
    );
  }
  return (
    <ShelfAction
      label={t('flowRedesign.removeLiked')}
      onClick={() => void setTrackLiked(qc, track, false)}
    >
      <Heart size={13} fill="currentColor" aria-hidden />
    </ShelfAction>
  );
}

interface Props {
  tracks: Track[];
  removes?: Removes;
  onPlay?: () => void;
  onEnd?: () => void;
}

export function TrackPanel({ tracks, removes, onPlay, onEnd }: Props) {
  const currentUrn = usePlayerStore((s) => s.currentTrack?.urn);
  return (
    <ShelfScroll
      items={tracks}
      keyOf={(track) => track.urn}
      activeKey={currentUrn}
      onEnd={onEnd}
      renderItem={(track) => (
        <TrackShelfCard track={track} queue={tracks} onPlay={onPlay} removes={removes} />
      )}
    />
  );
}
