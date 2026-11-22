import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { clearDislike, dislikeTrack } from '../../../lib/dislike-actions';
import { useDislikeStatus } from '../../../lib/dislikes';
import { Disc3, HardDrive, ListPlus, ThumbsDown } from '../../../lib/icons';
import { QUALITY_LABEL_KEYS } from '../../../lib/playback-quality';
import { getAlbumTarget } from '../../../lib/track-display';
import { useAddToPlaylistRequest } from '../../../stores/add-to-playlist';
import { usePlayerStore } from '../../../stores/player';
import { PlayerBlockButton } from '../../music/blocklist/PlayerBlockButton';
import { RATING_CHIPS, tierOf, tierTitleKey } from '../../music/TrackStatusBadges';
import { playerBtn } from './button-class';
import { useCurrentTrackData } from './useTrackData';

export const DislikeBtn = React.memo(() => {
  const { t } = useTranslation();
  const { urn, usable, trackData } = useCurrentTrackData();
  const disliked = useDislikeStatus(urn);
  const title = disliked ? t('track.removeDislike') : t('track.dislike');
  const toggle = () => {
    if (disliked) clearDislike(urn);
    else if (trackData) void dislikeTrack(trackData);
  };
  return (
    <button
      type="button"
      disabled={!usable}
      onClick={toggle}
      title={title}
      aria-label={title}
      aria-pressed={disliked}
      data-ui="player-dislike"
      className={playerBtn(disliked, true)}
    >
      <ThumbsDown size={16} fill={disliked ? 'currentColor' : 'none'} />
    </button>
  );
});

export const AddToPlaylistBtn = React.memo(() => {
  const { t } = useTranslation();
  const request = useAddToPlaylistRequest((s) => s.request);
  const { urn, usable } = useCurrentTrackData();
  return (
    <button
      type="button"
      disabled={!usable}
      onClick={() => request([urn])}
      title={t('playlist.addToPlaylist')}
      aria-label={t('playlist.addToPlaylist')}
      data-ui="player-playlist"
      className={playerBtn(false)}
    >
      <ListPlus size={16} />
    </button>
  );
});

export const AlbumBtn = React.memo(() => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { trackData } = useCurrentTrackData();
  const target = trackData ? getAlbumTarget(trackData) : null;
  const title = trackData?.enrichment?.album?.title;
  const label = title ? t('track.openAlbum', { title }) : t('track.album');
  return (
    <button
      type="button"
      disabled={!target}
      onClick={() => target && navigate(target)}
      title={label}
      aria-label={label}
      data-ui="player-album"
      className={playerBtn(false)}
    >
      <Disc3 size={16} />
    </button>
  );
});

export const BlockBtn = React.memo(() => {
  const { trackData } = useCurrentTrackData();
  const track = usePlayerStore((s) => s.currentTrack);
  return <PlayerBlockButton keepSlot track={trackData ?? track} className={playerBtn(false)} />;
});

function RatingChip() {
  const { t } = useTranslation();
  const meta = usePlayerStore((s) => s.currentTrack?._scd_meta);
  const tier = meta ? tierOf(meta, true) : null;
  if (!meta || !tier) return null;
  const { letter, chip } = RATING_CHIPS[tier];
  return (
    <span
      data-ui="player-rating"
      title={t(tierTitleKey(tier, meta))}
      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border pl-[0.14em] text-[10px] font-semibold tracking-[0.14em] ${chip}`}
    >
      {letter}
    </span>
  );
}

export const QualityBadge = React.memo(() => {
  const { t } = useTranslation();
  const quality = usePlayerStore((s) => s.playbackQuality);
  const local = useCurrentTrackData().local;
  return (
    <div
      data-ui="player-quality"
      className="flex h-[34px] w-[72px] shrink-0 items-center justify-center gap-1.5"
    >
      {local ? (
        <span
          title={t('local.badge')}
          className="flex h-6 items-center gap-1 rounded-md border border-ink/[0.08] bg-ink/[0.04] px-2 text-ink-50"
        >
          <HardDrive size={12} />
        </span>
      ) : (
        quality && (
          <>
            <span
              className={`inline-flex h-6 items-center rounded-md border px-2 text-[9px] font-semibold tracking-[0.14em] ${
                quality !== 'sq'
                  ? 'border-ink/[0.14] bg-ink/[0.08] text-ink-92'
                  : 'border-ink/[0.08] bg-ink/[0.04] text-ink-68'
              }`}
            >
              {t(QUALITY_LABEL_KEYS[quality])}
            </span>
            <RatingChip />
          </>
        )
      )}
    </div>
  );
});
