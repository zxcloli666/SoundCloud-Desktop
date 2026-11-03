import React, {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {useTranslation} from 'react-i18next';
import {usePlayingCopy} from '../../../lib/alt-upload';
import {art} from '../../../lib/formatters';
import {Eye, MicVocal, X} from '../../../lib/icons';
import {isPreviewOnly} from '../../../lib/track-access';
import {useArtistDisplay, useArtistLinkItems, useDisplayTitle} from '../../../lib/track-display';
import type {Track} from '../../../stores/player';
import {PlaybackRateSlider, ProgressSlider, ProgressTime} from '../../layout/NowPlayingBar';
import {ControlVolumeBtn, VolumeLabel, VolumeSlider} from '../../layout/VolumeControls';
import {AltUploadMark} from '../AltUploadMark';
import {ArtistNameLinks} from '../ArtistNameLinks';
import {Controls} from './LyricsControls';

const ArtworkViewModal = React.memo(
  ({
    src,
    title,
    subtitle,
    onClose,
  }: {
    src: string;
    title: string;
    subtitle: string;
    onClose: () => void;
  }) => {
    useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      };
      window.addEventListener('keydown', onKey, true);
      return () => window.removeEventListener('keydown', onKey, true);
    }, [onClose]);

    if (typeof document === 'undefined') return null;

    return createPortal(
      <div data-scheme="dark" className="fixed inset-0 z-[220] flex items-center justify-center bg-black/90 p-8 backdrop-blur-xl sm:p-12">
        <div className="absolute inset-0 cursor-pointer" onClick={onClose} />
        <button
          type="button"
          onClick={onClose}
          className="absolute right-6 top-6 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-ink/10 bg-ink/10 text-ink transition-all hover:bg-ink/20 cursor-pointer"
        >
          <X size={20} />
        </button>
        <div
          className="relative z-10 aspect-square w-[min(calc(100vw-4rem),calc(100vh-4rem))] max-w-full max-h-full sm:w-[min(calc(100vw-6rem),calc(100vh-6rem))]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="h-full w-full overflow-hidden rounded-[28px] border border-ink/10 bg-black/24 shadow-[0_32px_128px_rgb(var(--shade)/calc(0.8*var(--shade-alpha)))]">
            <img
              src={src}
              alt={title}
              loading="eager"
              decoding="async"
              className="h-full w-full animate-zoom-in rounded-[28px] object-cover"
            />
          </div>
        </div>
        <div className="pointer-events-none absolute bottom-8 left-1/2 z-10 w-[min(560px,calc(100vw-3rem))] -translate-x-1/2 px-3">
          <div className="mx-auto flex w-fit max-w-full flex-col items-center gap-0.5 rounded-2xl border border-ink/10 bg-black/40 px-4 py-3 text-center shadow-[0_18px_60px_rgb(var(--shade)/calc(0.42*var(--shade-alpha)))] backdrop-blur-xl">
            <p className="max-w-[min(480px,calc(100vw-6rem))] truncate text-lg font-bold text-ink-95">
              {title}
            </p>
            <p className="max-w-[min(440px,calc(100vw-6rem))] truncate text-sm text-ink-50">
              {subtitle}
            </p>
          </div>
        </div>
      </div>,
      document.body,
    );
  },
);

export const TrackColumn = React.memo(({ track, maxArt }: { track: Track; maxArt?: string }) => {
  const { t } = useTranslation();
  const artwork500 = art(track.artwork_url, 't500x500');
  const artwork200 = art(track.artwork_url, 't200x200');
  const artistDisplay = useArtistDisplay(track);
  const artistLinks = useArtistLinkItems(track);
  const displayTitle = useDisplayTitle(track);
  const copy = usePlayingCopy(track.urn);
  const [loaded, setLoaded] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [showFullArt, setShowFullArt] = useState(false);
  const switchTimerRef = useRef<number | null>(null);

  const prevUrlRef = useRef(track.artwork_url);
  if (prevUrlRef.current !== track.artwork_url) {
    prevUrlRef.current = track.artwork_url;
    setLoaded(false);
    setShowFullArt(false);
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
      <div
        className={`${widthClass} aspect-square rounded-2xl overflow-hidden shadow-2xl shadow-black/60 ring-1 ring-ink/[0.08] relative group/art`}
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
            <button
              type="button"
              onClick={() => setShowFullArt(true)}
              data-scheme="dark"
              className="absolute inset-0 bg-black/40 opacity-0 group-hover/art:opacity-100 transition-opacity duration-300 flex items-center justify-center text-ink-90 backdrop-blur-[2px] cursor-pointer outline-none"
            >
              <div className="flex flex-col items-center gap-2 scale-90 group-hover/art:scale-100 transition-transform duration-300">
                <div className="w-12 h-12 rounded-full bg-ink/20 flex items-center justify-center border border-ink/20">
                  <Eye size={24} />
                </div>
                <span className="text-[11px] font-bold tracking-wider uppercase opacity-70">
                  {t('track.viewArtwork')}
                </span>
              </div>
            </button>
          </>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-ink/[0.06] to-ink/[0.02] flex items-center justify-center">
            <MicVocal size={48} className="text-ink-10" />
          </div>
        )}
      </div>

      {showFullArt && artwork500 && (
        <ArtworkViewModal
          src={artwork500}
          title={displayTitle}
          subtitle={artistDisplay.primary}
          onClose={() => setShowFullArt(false)}
        />
      )}

      <div className={`${widthClass} text-center space-y-1`}>
        <div className="flex items-center justify-center gap-2 min-w-0">
          <p className="text-[18px] font-bold text-ink-95 truncate">{displayTitle}</p>
          <AltUploadMark urn={track.urn} size={14} />
          {isPreviewOnly(track) && !copy && (
            <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide bg-amber-500/20 text-amber-400/90 px-1.5 py-px rounded">
              {t('track.previewOnly')}
            </span>
          )}
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
