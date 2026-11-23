import { useTranslation } from 'react-i18next';
import { ago, art } from '../../../../lib/formatters';
import { Check, pauseWhite12, playWhite12 } from '../../../../lib/icons';
import { useReleaseFeed } from '../../../../lib/new-releases-api';
import { usePremium } from '../../../../lib/premium-cache';
import { useTrackPlay } from '../../../../lib/useTrackPlay';
import { type Track, usePlayerStore } from '../../../../stores/player';
import { ReleaseTeaser } from './ReleaseTeaser';
import { ShelfCard } from './ShelfCard';
import { feedOf, ShelfPlaceholder } from './ShelfPlaceholder';
import { ShelfScroll } from './ShelfScroll';

function Mark({ heard }: { heard: boolean }) {
  const { t } = useTranslation();
  if (heard) {
    return (
      <span
        data-scheme="dark"
        title={t('releases.heard')}
        className="absolute left-1.5 top-1.5 flex size-[18px] items-center justify-center rounded-full bg-black/55 text-ink-90"
      >
        <Check size={10} strokeWidth={3} aria-hidden />
      </span>
    );
  }
  return (
    <span
      role="img"
      aria-label={t('releases.new')}
      title={t('releases.new')}
      className="absolute left-2 top-2 size-2 rounded-full bg-accent ring-2 ring-black/40"
    />
  );
}

function ReleaseShelfCard({
  track,
  queue,
  heard,
}: {
  track: Track;
  queue: Track[];
  heard: boolean;
}) {
  const { isThisPlaying, isThis, togglePlay } = useTrackPlay(track, queue);
  const age = ago(track.created_at || track.release_date);
  return (
    <ShelfCard
      scrollKey={track.urn}
      cover={art(track.artwork_url || track.user?.avatar_url, 't300x300')}
      title={track.title}
      subtitle={track.user?.username}
      active={isThis}
      dimmed={heard && !isThis}
      coverLabel={track.title}
      onOpen={togglePlay}
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
          <Mark heard={heard} />
          {age && (
            <span
              data-scheme="dark"
              className="absolute bottom-1.5 left-1.5 rounded-full bg-black/55 px-1.5 text-[9.5px] font-semibold leading-[15px] tabular-nums text-ink-90"
            >
              {age}
            </span>
          )}
        </>
      }
    />
  );
}

function ReleaseCards({ tracks, heard }: { tracks: Track[]; heard: ReadonlySet<string> }) {
  const currentUrn = usePlayerStore((s) => s.currentTrack?.urn);
  return (
    <ShelfScroll
      items={tracks}
      keyOf={(track) => track.urn}
      activeKey={currentUrn}
      renderItem={(track) => (
        <ReleaseShelfCard track={track} queue={tracks} heard={heard.has(track.urn)} />
      )}
    />
  );
}

export function ReleasePanel() {
  const { t } = useTranslation();
  const premium = usePremium();
  const { tracks, heard, query } = useReleaseFeed();
  if (!premium) return <ReleaseTeaser />;
  if (tracks.length > 0) return <ReleaseCards tracks={tracks} heard={heard} />;
  return (
    <ShelfPlaceholder feed={feedOf(query, tracks.length)} hint={t('flowRedesign.emptyReleases')} />
  );
}
