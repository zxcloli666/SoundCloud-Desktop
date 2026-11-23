import React from 'react';
import { useTranslation } from 'react-i18next';
import { Film } from '../../../lib/icons';
import type { VideoHost } from '../../../lib/video-element';
import { useVideoLoad } from '../../../lib/video-load';
import { VideoLoadRing } from './VideoLoadRing';

const SIZE = 34;

export const VideoLoadMark = React.memo(function VideoLoadMark({
  host,
  className,
}: {
  host: VideoHost;
  className: string;
}) {
  const { t } = useTranslation();
  const on = useVideoLoad((s) => s.host === host);
  return (
    <span
      role="progressbar"
      data-ui="video-load"
      data-scheme="dark"
      aria-hidden={!on}
      aria-label={t('track.videoLoading')}
      className={`pointer-events-none absolute z-10 flex items-center justify-center rounded-full bg-black/55 text-ink-80 transition-opacity duration-300 ${on ? 'opacity-100' : 'opacity-0'} ${className}`}
      style={{ width: SIZE, height: SIZE }}
    >
      {on && <VideoLoadRing size={SIZE} />}
      <Film size={14} />
    </span>
  );
});
