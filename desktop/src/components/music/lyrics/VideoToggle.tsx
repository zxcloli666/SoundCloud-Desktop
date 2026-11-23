import React from 'react';
import { useTranslation } from 'react-i18next';
import { Film } from '../../../lib/icons';
import { isLocalUrn } from '../../../lib/local-library';
import { forgetVideoFails, useFailedKinds } from '../../../lib/video-cache';
import { canPlayH264 } from '../../../lib/video-element';
import { useVideoLoad } from '../../../lib/video-load';
import type { Track } from '../../../stores/player';
import { useSettingsStore } from '../../../stores/settings';
import { useTrackVideos } from './TrackVideo';
import { usePickedVideo, useVideoAllowed } from './useTrackVideo';
import { VideoLoadRing } from './VideoLoadRing';

const SIZE = 36;
const GLOW = {
  color: 'var(--color-accent)',
  borderColor: 'var(--color-accent-glow)',
  boxShadow: '0 0 14px var(--color-accent-glow)',
};

type VideoState = 'off' | 'none' | 'loading' | 'failed' | 'on';

const TITLE_KEY: Record<VideoState, string> = {
  off: 'settings.video',
  none: 'track.videoNone',
  loading: 'track.videoLoading',
  failed: 'track.videoFailed',
  on: 'settings.video',
};

export const VideoToggle = React.memo(function VideoToggle({
  track,
  className,
}: {
  track: Track;
  className: string;
}) {
  const { t } = useTranslation();
  const setOn = useSettingsStore((s) => s.setVideoEnabled);
  const state = useVideoState(track);
  if (!canPlayH264()) return null;

  const on = state !== 'off';
  const toggle = () => {
    if (!on) forgetVideoFails(track.urn);
    setOn(!on);
  };
  const title = t(TITLE_KEY[state]);

  return (
    <button
      type="button"
      data-ui="lyrics-video-toggle"
      data-state={state}
      aria-label={title}
      aria-pressed={on}
      aria-busy={state === 'loading'}
      onClick={toggle}
      title={title}
      className={`relative ${className}`}
      style={state === 'on' ? GLOW : on ? { color: 'var(--color-accent)' } : undefined}
    >
      {state === 'loading' && <VideoLoadRing size={SIZE} />}
      <Film size={17} className={state === 'none' || state === 'failed' ? 'opacity-50' : ''} />
      {state === 'failed' && (
        <span className="absolute right-0 top-0 size-2.5 rounded-full bg-rose-400 ring-2 ring-black/60" />
      )}
    </button>
  );
});

function useVideoState(track: Track): VideoState {
  const allowed = useVideoAllowed();
  const videos = useTrackVideos(track, allowed);
  const picked = usePickedVideo(track.urn, videos);
  const failed = useFailedKinds(track.urn);
  const loading = useVideoLoad((s) => s.host?.startsWith('player-') ?? false);
  if (!allowed) return 'off';
  if (loading) return 'loading';
  if (picked) return 'on';
  if (failed.size > 0) return 'failed';
  return videos === undefined && !isLocalUrn(track.urn) ? 'on' : 'none';
}
