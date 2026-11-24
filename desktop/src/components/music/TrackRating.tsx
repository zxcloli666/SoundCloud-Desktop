import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  RATING_LETTERS,
  ratingQuality,
  ratingTier,
  ratingTitleKey,
  sameScdMeta,
  sameVideos,
} from '../../lib/track-rating';
import { pickVideo } from '../../lib/video-pick';
import type { TrackScdMeta, TrackVideo } from '../../stores/player';
import { useSettingsStore } from '../../stores/settings';

interface Props {
  meta?: TrackScdMeta;
  videos?: TrackVideo[];
  onArt?: boolean;
  ui?: string;
}

const VIDEO_TITLE_KEYS = {
  clip: 'track.status.videoClip',
  loop: 'track.status.videoLoop',
  generated: 'track.status.videoGenerated',
} as const;

function TrackRatingInner({ meta, videos, onArt = false, ui = 'track-rating' }: Props) {
  const { t } = useTranslation();
  const videoEnabled = useSettingsStore((s) => s.videoEnabled);
  const order = useSettingsStore((s) => s.videoOrder);
  const off = useSettingsStore((s) => s.videoOff);
  if (!meta) return null;
  const tier = ratingTier(meta);
  const video = videoEnabled ? pickVideo(videos, { order, off }, new Set()) : null;
  const base = t(ratingTitleKey(tier, meta));
  const title = video
    ? `${base} · ${t('track.status.video', { kind: t(VIDEO_TITLE_KEYS[video.kind]) })}`
    : base;
  return (
    <span
      data-ui={ui}
      data-tier={tier}
      data-scheme={onArt ? 'dark' : undefined}
      data-art={onArt || undefined}
      data-video={video ? '' : undefined}
      data-hq={ratingQuality(tier, meta) ? '' : undefined}
      role="img"
      aria-label={title}
      title={title}
      className="rating"
    >
      {RATING_LETTERS[tier]}
    </span>
  );
}

export const TrackRating = memo(
  TrackRatingInner,
  (prev, next) =>
    prev.onArt === next.onArt &&
    prev.ui === next.ui &&
    sameScdMeta(prev.meta, next.meta) &&
    sameVideos(prev.videos, next.videos),
);
