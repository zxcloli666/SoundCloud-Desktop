import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { art } from '../../../lib/formatters';
import { Eye, MicVocal } from '../../../lib/icons';
import { useArtistDisplay, useArtistLinkItems, useDisplayTitle } from '../../../lib/track-display';
import { useVideoOpaque } from '../../../lib/video-element';
import type { Track } from '../../../stores/player';
import { useSettingsStore } from '../../../stores/settings';
import { ProgressSlider, ProgressTime } from '../../layout/player/ProgressSlider';
import { PlaybackRateSlider } from '../../layout/player/tuning';
import { ControlVolumeBtn, VolumeLabel, VolumeSlider } from '../../layout/VolumeControls';
import { CoverFade } from '../../ui/CoverFade';
import { AltUploadMark } from '../AltUploadMark';
import { ArtistNameLinks } from '../ArtistNameLinks';
import { Controls } from './LyricsControls';
import { MediaView } from './MediaView';
import { PlayerVideo } from './TrackVideo';
import { VideoLoadMark } from './VideoLoadMark';

export const TrackColumn = React.memo(({ track, maxArt }: { track: Track; maxArt?: string }) => {
  const { t } = useTranslation();
  const artwork500 = art(track.artwork_url, 't500x500');
  const artwork200 = art(track.artwork_url, 't200x200');
  const artistDisplay = useArtistDisplay(track);
  const artistLinks = useArtistLinkItems(track);
  const displayTitle = useDisplayTitle(track);
  const [loaded, setLoaded] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [view, setView] = useState<'art' | 'video' | null>(null);
  const inCover = useSettingsStore((s) => s.videoPlace) === 'cover';
  const opaque = useVideoOpaque();
  const videoOver = opaque === 'player-cover';
  const behind = opaque === 'player-background';
  const coverOpacity = useSettingsStore((s) => s.videoCoverOpacity);
  const setCoverOpacity = useSettingsStore((s) => s.setVideoCoverOpacity);
  const switchTimerRef = useRef<number | null>(null);

  const prevUrlRef = useRef(track.artwork_url);
  if (prevUrlRef.current !== track.artwork_url) {
    prevUrlRef.current = track.artwork_url;
    setLoaded(false);
    setView(null);
    if (artwork200 && artwork500 && artwork200 !== artwork500) {
      setIsSwitching(true);
    }
  }

  useEffect(() => {
    if (!isSwitching) return;
    if (switchTimerRef.current !== null) window.clearTimeout(switchTimerRef.current);
    switchTimerRef.current = window.setTimeout(() => {
      setIsSwitching(false);
      switchTimerRef.current = null;
    }, 900);
    return () => {
      if (switchTimerRef.current !== null) {
        window.clearTimeout(switchTimerRef.current);
        switchTimerRef.current = null;
      }
    };
  }, [isSwitching]);

  const widthClass = `w-full ${maxArt ?? 'max-w-[360px]'}`;

  return (
    <div className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-[clamp(8px,1.4vh,22px)] overflow-y-auto scrollbar-hide px-12 py-6">
      <div className={`${widthClass} aspect-square relative group/art`}>
        <div
          className="size-full rounded-2xl overflow-hidden shadow-2xl shadow-black/60 ring-1 ring-ink/[0.08] relative transition-opacity duration-200"
          style={{ opacity: behind ? coverOpacity : 1 }}
        >
          {artwork500 ? (
            <>
              <img
                src={artwork200 || artwork500}
                alt=""
                decoding="async"
                className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ease-[var(--ease-apple)] ${
                  isSwitching ? 'blur-2xl scale-125' : 'scale-110'
                } ${loaded ? 'opacity-0' : 'opacity-100'}`}
              />
              <img
                src={artwork500}
                alt=""
                decoding="async"
                onLoad={() => {
                  setLoaded(true);
                  setIsSwitching(false);
                }}
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-[var(--ease-apple)] ${loaded ? 'opacity-100' : 'opacity-0'}`}
              />
              {inCover && <PlayerVideo track={track} host="player-cover" />}
              <OpenButton
                label={t('track.viewArtwork')}
                plain={videoOver}
                onClick={() => setView(videoOver ? 'video' : 'art')}
              />
            </>
          ) : (
            <>
              <div className="w-full h-full bg-gradient-to-br from-ink/[0.06] to-ink/[0.02] flex items-center justify-center">
                <MicVocal size={48} className="text-ink-10" />
              </div>
              {inCover && <PlayerVideo track={track} host="player-cover" />}
              {videoOver && (
                <OpenButton label={t('track.viewArtwork')} plain onClick={() => setView('video')} />
              )}
            </>
          )}
        </div>
        <VideoLoadMark host="player-cover" className="right-3 top-3" />
        {behind && (
          <CoverFade
            value={coverOpacity}
            onChange={setCoverOpacity}
            label={t('settings.videoCoverOpacity')}
            data-ui="lyrics-cover-fade"
          />
        )}
      </div>

      {view === 'art' && artwork500 && (
        <MediaView
          title={displayTitle}
          subtitle={artistDisplay.primary}
          onClose={() => setView(null)}
        >
          <img
            src={artwork500}
            alt={displayTitle}
            loading="eager"
            decoding="async"
            className="h-full w-full animate-zoom-in rounded-[28px] object-cover"
          />
        </MediaView>
      )}
      {view === 'video' && (
        <MediaView
          wide
          title={displayTitle}
          subtitle={artistDisplay.primary}
          onClose={() => setView(null)}
        >
          <PlayerVideo track={track} host="player-view" />
        </MediaView>
      )}

      <div className={`${widthClass} text-center space-y-1`}>
        <div className="flex items-center justify-center gap-2 min-w-0">
          <p className="text-[18px] font-bold text-ink-95 truncate">{displayTitle}</p>
          <AltUploadMark urn={track.urn} size={14} />
        </div>
        <p className="text-[14px] text-ink-40 truncate">
          <ArtistNameLinks
            items={artistLinks}
            linkClassName="cursor-pointer transition-colors hover:text-ink-70"
          />
        </p>
      </div>

      <div className={widthClass}>
        <ProgressSlider />
        <div className="flex justify-center mt-1">
          <ProgressTime />
        </div>
      </div>

      <Controls track={track} />

      <div
        className={`${widthClass} flex flex-col gap-2 rounded-[22px] border border-ink/[0.07] bg-black/30 p-3 shadow-[0_18px_60px_rgb(var(--shade)/calc(0.30*var(--shade-alpha)))] backdrop-blur-xl`}
      >
        <div className="flex items-center gap-2">
          <ControlVolumeBtn size="sm" />
          <VolumeSlider className="flex-1" />
          <VolumeLabel />
        </div>
        <PlaybackRateSlider />
      </div>
    </div>
  );
});

function OpenButton({
  label,
  plain,
  onClick,
}: {
  label: string;
  plain: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-scheme="dark"
      className={`absolute inset-0 bg-black/40 opacity-0 group-hover/art:opacity-100 transition-opacity duration-300 flex items-center justify-center text-ink-90 cursor-pointer outline-none ${plain ? '' : 'backdrop-blur-[2px]'}`}
    >
      <div className="flex flex-col items-center gap-2 scale-90 group-hover/art:scale-100 transition-transform duration-300">
        <div className="w-12 h-12 rounded-full bg-ink/20 flex items-center justify-center border border-ink/20">
          <Eye size={24} />
        </div>
        <span className="text-[11px] font-bold tracking-wider uppercase opacity-70">{label}</span>
      </div>
    </button>
  );
}
