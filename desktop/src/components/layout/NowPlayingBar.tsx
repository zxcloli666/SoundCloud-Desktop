import * as Popover from '@radix-ui/react-popover';
import * as Slider from '@radix-ui/react-slider';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/shallow';
import { api } from '../../lib/api';
import {
  getCurrentTime,
  getDownloadProgress,
  getDuration,
  handlePrev,
  seek,
  subscribe,
} from '../../lib/audio';
import { designPreviewTracks, isDesignPreview } from '../../lib/design-preview';
import { toggleDislike, useDislikeStatus } from '../../lib/dislikes';
import { art, formatTime } from '../../lib/formatters';
import { invalidateAllLikesCache } from '../../lib/hooks';
import {
  audioLines16,
  Disc3,
  Heart,
  listMusic16,
  MicVocal,
  pauseBlack20,
  playBlack20,
  repeat1Icon16,
  repeatAbIcon16,
  repeatIcon16,
  shuffleIcon16,
  skipBack20,
  skipForward20,
  slidersHorizontal16,
  ThumbsDown,
  volume1Icon16,
  volume2Icon16,
  volumeXIcon16,
} from '../../lib/icons';
import { optimisticToggleLike } from '../../lib/likes';
import { useArtistDisplay, useArtistLinkItems, useDisplayTitle } from '../../lib/track-display';
import { useLyricsStore } from '../../stores/lyrics';
import {
  AB_MIN_GAP,
  getEffectivePitchSemitones,
  PITCH_SEMITONES_MAX,
  PITCH_SEMITONES_MIN,
  PITCH_SEMITONES_STEP,
  PLAYBACK_RATE_MAX,
  PLAYBACK_RATE_MIN,
  PLAYBACK_RATE_STEP,
  type Track,
  usePlayerStore,
} from '../../stores/player';
import { useSettingsStore } from '../../stores/settings';
import { ArtistNameLinks } from '../music/ArtistNameLinks';
import { EqualizerPanel } from '../music/EqualizerPanel';
import { UploadKindDot } from '../music/UploadKindDot';

/* ── Track loading progress (SC → SCD download) ──────────────── */

/** Smoothed download-progress value (0-1) for display, or null when not loading.
 *  Holds briefly after completion so a finished load doesn't flicker away. */
function useLoadProgress(): number | null {
  const downloadProgress = useSyncExternalStore(subscribe, getDownloadProgress);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastProgressRef = useRef<number | null>(null);
  const [visibleProgress, setVisibleProgress] = useState<number | null>(null);

  useEffect(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    if (downloadProgress === null) {
      if (lastProgressRef.current !== null && lastProgressRef.current >= 1) {
        hideTimerRef.current = setTimeout(() => {
          setVisibleProgress(null);
          hideTimerRef.current = null;
        }, 320);
      } else {
        setVisibleProgress(null);
      }
      return;
    }

    lastProgressRef.current = downloadProgress;
    setVisibleProgress(downloadProgress);

    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, [downloadProgress]);

  return visibleProgress;
}

/** Whole percentage (1-100) shown to the user while a track loads. */
const loadPercent = (progress: number) =>
  Math.max(1, Math.min(100, Math.round(Math.max(0, Math.min(1, progress)) * 100)));

/* ── A-B loop markers (overlay on the progress track) ────────── */

const clampPct = (v: number) => Math.max(0, Math.min(100, v));
const handleClass =
  'absolute top-1/2 z-[3] flex h-5 w-3.5 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none items-center justify-center';
const tipClass =
  'pointer-events-none absolute bottom-[calc(100%+7px)] z-[4] -translate-x-1/2 whitespace-nowrap rounded-md bg-black/80 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-white opacity-0 shadow-lg transition-opacity duration-100';

const AbLoopOverlay = React.memo(({ duration }: { duration: number }) => {
  const abLoop = usePlayerStore((s) => s.abLoop);
  const nudgeAbBound = usePlayerStore((s) => s.nudgeAbBound);
  const bandRef = useRef<HTMLSpanElement>(null);
  const aRef = useRef<HTMLSpanElement>(null);
  const bRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);

  if (!abLoop || duration <= 0) return null;

  const a = abLoop.a;
  const b = abLoop.b;
  const aPct = clampPct((a / duration) * 100);
  const bPct = b != null ? clampPct((b / duration) * 100) : null;

  const startDrag = (which: 'a' | 'b') => (e: React.PointerEvent<HTMLSpanElement>) => {
    // Keep Radix from treating this as a seek-on-the-track gesture.
    e.preventDefault();
    e.stopPropagation();
    const root = e.currentTarget.offsetParent as HTMLElement | null;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    if (rect.width <= 0) return;
    // Drive the overlay via direct DOM writes during the drag and commit to the store
    // (which pushes once to Rust) only on release — avoids per-frame JS↔Rust bridge spam.
    const lo = which === 'a' ? 0 : a + AB_MIN_GAP;
    const hi = which === 'a' ? (b ?? duration) - AB_MIN_GAP : duration;
    let latest = which === 'a' ? a : (b ?? a);
    // Time bubble above the dragged handle — driven by direct DOM writes like the
    // handle itself, so the per-frame drag stays React-render-free.
    const showTip = (timeSec: number, pct: number) => {
      const tip = tipRef.current;
      if (!tip) return;
      tip.textContent = formatTime(timeSec);
      tip.style.left = `${pct}%`;
      tip.style.opacity = '1';
    };
    showTip(latest, (latest / duration) * 100);
    const onMove = (ev: PointerEvent) => {
      const raw = ((ev.clientX - rect.left) / rect.width) * duration;
      latest = Math.max(lo, Math.min(hi, raw));
      const pct = (latest / duration) * 100;
      showTip(latest, pct);
      if (which === 'a') {
        if (aRef.current) aRef.current.style.left = `${pct}%`;
        if (bandRef.current && bPct != null) {
          bandRef.current.style.left = `${pct}%`;
          bandRef.current.style.width = `${Math.max(0, bPct - pct)}%`;
        }
      } else {
        if (bRef.current) bRef.current.style.left = `${pct}%`;
        if (bandRef.current) bandRef.current.style.width = `${Math.max(0, pct - aPct)}%`;
      }
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      if (tipRef.current) tipRef.current.style.opacity = '0';
      nudgeAbBound(which, latest);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  return (
    <>
      {bPct != null && (
        <span
          ref={bandRef}
          className="pointer-events-none absolute inset-y-0 z-[1] rounded-full bg-accent/25"
          style={{ left: `${aPct}%`, width: `${Math.max(0, bPct - aPct)}%` }}
        />
      )}
      <span
        ref={aRef}
        onPointerDown={startDrag('a')}
        className={handleClass}
        style={{ left: `${aPct}%` }}
      >
        <span className="h-3.5 w-[3px] rounded-full bg-accent shadow-[0_0_8px_var(--color-accent-glow)]" />
      </span>
      {bPct != null && (
        <span
          ref={bRef}
          onPointerDown={startDrag('b')}
          className={handleClass}
          style={{ left: `${bPct}%` }}
        >
          <span className="h-3.5 w-[3px] rounded-full bg-accent shadow-[0_0_8px_var(--color-accent-glow)]" />
        </span>
      )}
      <span ref={tipRef} className={tipClass} style={{ left: `${aPct}%` }} />
    </>
  );
});

/* ── Progress Slider ─────────────────────────────────────────── */

export const ProgressSlider = React.memo(() => {
  const duration = useSyncExternalStore(subscribe, getDuration);

  const [dragging, setDragging] = useState(false);
  const [dragValue, setDragValue] = useState(0);
  const [syncedValue, setSyncedValue] = useState(0);

  const draggingRef = useRef(false);
  const rangeRef = useRef<HTMLSpanElement>(null);
  const thumbRef = useRef<HTMLSpanElement>(null);

  // Direct DOM updates at 60fps — zero React re-renders
  useEffect(() => {
    return subscribe(() => {
      if (draggingRef.current) return;
      const t = getCurrentTime();
      const d = getDuration();
      const pct = d > 0 ? (t / d) * 100 : 0;
      if (rangeRef.current) rangeRef.current.style.right = `${100 - pct}%`;
      const thumbWrapper = thumbRef.current?.parentElement;
      if (thumbWrapper) thumbWrapper.style.left = `${pct}%`;
    });
  }, []);

  const displayValue = dragging ? dragValue : syncedValue;

  // Safety net: if Radix onValueCommit doesn't fire (pointer leaves window, fast flick),
  // reset dragging state on any pointerup so the progress bar doesn't freeze.
  const pendingCommitRef = useRef<number | null>(null);

  const onValueChange = useCallback(([v]: number[]) => {
    setDragValue(v);
    pendingCommitRef.current = v;
    if (!draggingRef.current) {
      draggingRef.current = true;
      setDragging(true);

      const resetDrag = () => {
        window.removeEventListener('pointerup', resetDrag);
        window.removeEventListener('pointercancel', resetDrag);
        // Give Radix a frame to fire onValueCommit first
        requestAnimationFrame(() => {
          if (draggingRef.current) {
            const val = pendingCommitRef.current;
            if (val != null) seek(val);
            draggingRef.current = false;
            setDragging(false);
            setSyncedValue(val ?? 0);
          }
        });
      };
      window.addEventListener('pointerup', resetDrag);
      window.addEventListener('pointercancel', resetDrag);
    }
  }, []);

  const onValueCommit = useCallback(([v]: number[]) => {
    seek(v);
    draggingRef.current = false;
    pendingCommitRef.current = null;
    setDragging(false);
    setSyncedValue(v);
  }, []);

  return (
    <Slider.Root
      className="relative flex items-center w-full h-5 cursor-pointer group select-none touch-none"
      value={[displayValue]}
      max={duration || 1}
      step={0.1}
      onValueChange={onValueChange}
      onValueCommit={onValueCommit}
    >
      <Slider.Track className="relative h-[3px] grow rounded-full bg-white/[0.08] group-hover:h-[5px] transition-all duration-150">
        <Slider.Range
          ref={rangeRef}
          className="absolute h-full rounded-full bg-accent will-change-transform"
        />
      </Slider.Track>
      <Slider.Thumb
        ref={thumbRef}
        className="block w-3 h-3 rounded-full bg-accent shadow-[0_0_10px_var(--color-accent-glow)] scale-0 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-150 outline-none will-change-transform"
      />
      <AbLoopOverlay duration={duration} />
    </Slider.Root>
  );
});

const DockProgress = React.memo(() => {
  return (
    <div className="npb-waveform">
      <ProgressSlider />
    </div>
  );
});

/* ── Volume Slider ───────────────────────────────────────────── */

export const VolumeSlider = React.memo(({ className = '' }: { className?: string }) => {
  const { volume, setVolume } = usePlayerStore(
    useShallow((s) => ({ volume: s.volume, setVolume: s.setVolume })),
  );
  const isOver100 = volume > 100;

  return (
    <div className={`relative ${className}`}>
      <Slider.Root
        className="relative flex items-center h-5 w-full cursor-pointer group select-none touch-none"
        value={[volume]}
        max={200}
        step={1}
        onValueChange={([v]) => setVolume(v)}
        onKeyDown={(e) => {
          // Prevent slider from handling arrows itself, otherwise it stacks with global hotkeys.
          if (
            e.key === 'ArrowLeft' ||
            e.key === 'ArrowRight' ||
            e.key === 'ArrowUp' ||
            e.key === 'ArrowDown'
          ) {
            e.preventDefault();
          }
        }}
        onWheel={(e) => {
          e.preventDefault();
          setVolume(Math.max(0, Math.min(200, volume + (e.deltaY < 0 ? 1 : -1))));
        }}
      >
        <Slider.Track className="relative h-[3px] grow rounded-full bg-white/[0.08] group-hover:h-[4px] transition-all duration-150">
          <Slider.Range
            className={`absolute h-full rounded-full ${isOver100 ? 'bg-amber-400/80' : 'bg-white/60'}`}
          />
        </Slider.Track>
        <Slider.Thumb
          className={`block w-2.5 h-2.5 rounded-full transition-all duration-150 outline-none scale-0 opacity-0 group-hover:scale-100 group-hover:opacity-100 ${isOver100 ? 'bg-amber-400' : 'bg-white'}`}
        />
      </Slider.Root>
      {/* 100% tick mark (visual only, outside Slider tree) */}
      <div
        className="absolute top-1/2 -translate-y-1/2 h-[3px] w-px bg-white/20 pointer-events-none"
        style={{ left: '50%' }}
      />
    </div>
  );
});

/* ── Volume button ───────────────────────────────────────────── */

export const ControlVolumeBtn = React.memo(({ size = 'default' }: { size?: 'default' | 'sm' }) => {
  const { volume, volumeBeforeMute, setVolume } = usePlayerStore(
    useShallow((s) => ({
      volume: s.volume,
      volumeBeforeMute: s.volumeBeforeMute,
      setVolume: s.setVolume,
    })),
  );
  const s = size === 'sm' ? 'w-9 h-9' : 'w-10 h-10';
  return (
    <button
      type="button"
      onClick={() => setVolume(volume > 0 ? 0 : volumeBeforeMute)}
      className={`${s} rounded-full flex items-center justify-center transition-all duration-150 ease-[var(--ease-apple)] cursor-pointer hover:bg-white/[0.04] ${
        volume === 0 ? 'text-accent' : 'text-white/40 hover:text-white/70'
      }`}
    >
      {volume === 0 ? volumeXIcon16 : volume < 50 ? volume1Icon16 : volume2Icon16}
    </button>
  );
});

/* ── Volume % label ──────────────────────────────────────────── */

export const VolumeLabel = React.memo(() => {
  const volume = usePlayerStore((s) => s.volume);
  return (
    <span
      className={`text-[10px] tabular-nums w-[34px] text-right shrink-0 ${volume > 100 ? 'text-amber-400/70' : 'text-white/30'}`}
    >
      {volume}%
    </span>
  );
});

/* ── Progress Time (updates once per second) ─────────────────── */

export const ProgressTime = React.memo(() => {
  const currentSecond = useSyncExternalStore(subscribe, () => Math.floor(getCurrentTime()));
  const duration = useSyncExternalStore(subscribe, getDuration);

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] text-white/50 tabular-nums font-medium">
        {formatTime(currentSecond)}
      </span>
      <span className="text-[11px] text-white/20">/</span>
      <span className="text-[11px] text-white/30 tabular-nums font-medium">
        {formatTime(duration)}
      </span>
    </div>
  );
});

/* ── Like / Dislike buttons ──────────────────────────────────── */

function useTrackReactions(trackUrn: string) {
  const { data: trackData } = useQuery({
    queryKey: ['track', trackUrn],
    queryFn: () => api<Track>(`/tracks/${encodeURIComponent(trackUrn)}`),
    enabled: !!trackUrn && !isDesignPreview(),
    staleTime: 30_000,
  });
  return trackData;
}

function LikeButton({
  trackUrn,
  trackData,
  disliked,
}: {
  trackUrn: string;
  trackData: Track | undefined;
  disliked: boolean;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [liked, setLiked] = useState<boolean | null>(null);
  const prevUrn = useRef(trackUrn);

  useEffect(() => {
    if (prevUrn.current === trackUrn) return;
    prevUrn.current = trackUrn;
    setLiked(null);
  }, [trackUrn]);

  const isLiked = liked ?? trackData?.user_favorite ?? false;

  const toggle = async () => {
    const next = !isLiked;
    setLiked(next);
    if (trackData) optimisticToggleLike(qc, trackData, next);
    invalidateAllLikesCache();

    if (next && disliked && trackData) {
      toggleDislike(qc, trackData, false);
    }

    try {
      await api(`/likes/tracks/${encodeURIComponent(trackUrn)}`, {
        method: next ? 'POST' : 'DELETE',
      });
      qc.invalidateQueries({ queryKey: ['track', trackUrn, 'favoriters'] });
    } catch {
      setLiked(!next);
      if (trackData) optimisticToggleLike(qc, trackData, !next);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      title={t('track.likes')}
      className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all duration-200 cursor-pointer hover:bg-white/[0.04] ${
        isLiked ? 'text-accent' : 'text-white/30 hover:text-white/60'
      }`}
    >
      <Heart size={16} fill={isLiked ? 'currentColor' : 'none'} />
    </button>
  );
}

export function NowBarDislikeButton({
  trackUrn,
  trackData,
  disliked,
}: {
  trackUrn: string;
  trackData: Track | undefined;
  disliked: boolean;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const toggle = async () => {
    if (!trackData) return;
    const next = !disliked;

    if (next && trackData.user_favorite) {
      optimisticToggleLike(qc, trackData, false);
      invalidateAllLikesCache();
      api(`/likes/tracks/${encodeURIComponent(trackUrn)}`, { method: 'DELETE' }).catch(() => {});
    }

    if (next) {
      const { currentTrack, next: skip } = usePlayerStore.getState();
      if (currentTrack?.urn === trackUrn) skip();
    }

    await toggleDislike(qc, trackData, next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      title={disliked ? t('track.removeDislike') : t('track.dislike')}
      className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all duration-200 cursor-pointer hover:bg-white/[0.04] ${
        disliked ? 'text-rose-400' : 'text-white/30 hover:text-white/60'
      }`}
    >
      <ThumbsDown size={16} fill={disliked ? 'currentColor' : 'none'} />
    </button>
  );
}

/* ── Isolated control buttons ────────────────────────────────── */

const btnClass = (active: boolean, size: 'default' | 'sm') =>
  `${size === 'sm' ? 'w-[30px] h-[30px]' : 'w-9 h-9'} rounded-full flex items-center justify-center transition-all duration-200 ease-[var(--ease-apple)] cursor-pointer hover:bg-white/[0.08] hover:-translate-y-px active:scale-90 ${
    active ? 'text-accent' : 'text-white/55 hover:text-white'
  }`;

const PlayPauseBtn = React.memo(() => {
  const { t } = useTranslation();
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  return (
    <button
      type="button"
      onClick={togglePlay}
      title={isPlaying ? t('track.pause') : t('track.play')}
      className="npb-play"
    >
      {isPlaying ? pauseBlack20 : playBlack20}
    </button>
  );
});

const ShuffleBtn = React.memo(() => {
  const shuffle = usePlayerStore((s) => s.shuffle);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  return (
    <button type="button" onClick={toggleShuffle} className={btnClass(shuffle, 'sm')}>
      {shuffleIcon16}
    </button>
  );
});

const RepeatBtn = React.memo(() => {
  const repeat = usePlayerStore((s) => s.repeat);
  const toggleRepeat = usePlayerStore((s) => s.toggleRepeat);
  return (
    <button type="button" onClick={toggleRepeat} className={btnClass(repeat !== 'off', 'sm')}>
      {repeat === 'one' ? repeat1Icon16 : repeatIcon16}
    </button>
  );
});

const AbLoopBtn = React.memo(() => {
  const { t } = useTranslation();
  const abLoop = usePlayerStore((s) => s.abLoop);
  const cycleAbPoint = usePlayerStore((s) => s.cycleAbPoint);
  const awaitingB = abLoop != null && abLoop.b == null;
  const title = !abLoop
    ? t('player.abLoopSetA')
    : abLoop.b == null
      ? t('player.abLoopSetB')
      : t('player.abLoopClear');

  const active = abLoop != null;
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={() => cycleAbPoint(getCurrentTime())}
      className={`relative w-[30px] h-[30px] rounded-full flex items-center justify-center transition-all duration-200 ease-[var(--ease-apple)] cursor-pointer active:scale-90 ${
        active
          ? 'text-accent bg-accent/15 shadow-[0_0_14px_-4px_var(--color-accent-glow)]'
          : 'text-white/55 hover:text-white hover:bg-white/[0.08] hover:-translate-y-px'
      }`}
    >
      {repeatAbIcon16}
      {awaitingB && (
        <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 animate-pulse rounded-full bg-accent shadow-[0_0_6px_var(--color-accent-glow)]" />
      )}
    </button>
  );
});

const PrevBtn = React.memo(() => (
  <button type="button" onClick={handlePrev} className={btnClass(false, 'default')}>
    {skipBack20}
  </button>
));

const NextBtn = React.memo(() => {
  const next = usePlayerStore((s) => s.next);
  return (
    <button type="button" onClick={next} className={btnClass(false, 'default')}>
      {skipForward20}
    </button>
  );
});

const QueueBtn = React.memo(({ onClick, active }: { onClick: () => void; active: boolean }) => {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${btnClass(active, 'sm')} npb-labeled-tool`}
    >
      {listMusic16}
      <span>{t('player.queue')}</span>
    </button>
  );
});

const ContextBtn = React.memo(({ onClick, active }: { onClick: () => void; active: boolean }) => {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      title={t('player.nowPlaying')}
      aria-label={t('player.nowPlaying')}
      aria-pressed={active}
      onClick={onClick}
      className={`${btnClass(active, 'sm')} npb-labeled-tool`}
    >
      <Disc3 size={16} />
      <span>{t('player.nowPlaying')}</span>
    </button>
  );
});

const LyricsBtn = React.memo(() => {
  const { t } = useTranslation();
  const open = useLyricsStore((s) => s.open);
  const closePanel = useLyricsStore((s) => s.close);
  const openPanel = useLyricsStore((s) => s.openPanel);
  return (
    <button
      type="button"
      onClick={() => {
        if (open) closePanel();
        else openPanel({ tab: 'lyrics', rightPanelOpen: true });
      }}
      className={`${btnClass(open, 'sm')} npb-labeled-tool`}
    >
      <MicVocal size={16} />
      <span>{t('track.lyrics')}</span>
    </button>
  );
});

const EqBtn = React.memo(() => {
  const eqEnabled = useSettingsStore((s) => s.eqEnabled);
  return (
    <EqualizerPanel>
      <button type="button" className={btnClass(eqEnabled, 'sm')}>
        {audioLines16}
      </button>
    </EqualizerPanel>
  );
});

/* ── Playback rate (speed) slider ─────────────────────────────── */

const formatPlaybackRate = (rate: number) =>
  `${rate
    .toFixed(2)
    .replace(/\.00$/, '')
    .replace(/(\.\d)0$/, '$1')}x`;

export const PlaybackRateSlider = React.memo(() => {
  const { t } = useTranslation();
  const playbackRate = usePlayerStore((s) => s.playbackRate);
  const setPlaybackRate = usePlayerStore((s) => s.setPlaybackRate);
  const resetPlaybackRate = usePlayerStore((s) => s.resetPlaybackRate);
  const isDefault = Math.abs(playbackRate - 1) < 0.001;

  return (
    <div className="rounded-[14px] border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/45">
          {t('player.playbackSpeed')}
        </span>
        <button
          type="button"
          title={isDefault ? t('player.playbackSpeed') : t('player.playbackSpeedReset')}
          onClick={() => {
            if (!isDefault) resetPlaybackRate();
          }}
          className={`min-w-[42px] text-right text-[11px] font-semibold tabular-nums transition-colors cursor-pointer ${
            isDefault ? 'text-white/45' : 'text-accent hover:text-accent/80'
          }`}
        >
          {formatPlaybackRate(playbackRate)}
        </button>
      </div>
      <Slider.Root
        className="group/rate relative flex h-5 w-full cursor-pointer select-none touch-none items-center"
        aria-label={t('player.playbackSpeed')}
        value={[playbackRate]}
        min={PLAYBACK_RATE_MIN}
        max={PLAYBACK_RATE_MAX}
        step={PLAYBACK_RATE_STEP}
        onValueChange={([v]) => setPlaybackRate(v)}
        onWheel={(e) => {
          if (e.cancelable) e.preventDefault();
          setPlaybackRate(playbackRate + (e.deltaY < 0 ? PLAYBACK_RATE_STEP : -PLAYBACK_RATE_STEP));
        }}
      >
        <Slider.Track className="relative h-[3px] grow rounded-full bg-white/[0.08] transition-all duration-150 group-hover/rate:h-[4px]">
          <Slider.Range className="absolute h-full rounded-full bg-accent" />
        </Slider.Track>
        <Slider.Thumb className="block h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_10px_var(--color-accent-glow)] outline-none transition-all duration-150 scale-0 opacity-0 group-hover/rate:scale-100 group-hover/rate:opacity-100" />
      </Slider.Root>
      {/* 1.00x tick mark */}
      <div className="relative mt-1 h-2 w-full pointer-events-none">
        <div
          className="absolute top-0 h-1.5 w-px bg-white/15"
          style={{
            left: `${((1 - PLAYBACK_RATE_MIN) / (PLAYBACK_RATE_MAX - PLAYBACK_RATE_MIN)) * 100}%`,
          }}
        />
      </div>
    </div>
  );
});

const formatPitchSemitones = (semi: number) => {
  if (Math.abs(semi) < 0.001) return '0';
  return `${semi > 0 ? '+' : ''}${semi.toFixed(1).replace(/\.0$/, '')}`;
};

export const PitchModeToggle = React.memo(() => {
  const { t } = useTranslation();
  const mode = usePlayerStore((s) => s.pitchControlMode);
  const setMode = usePlayerStore((s) => s.setPitchControlMode);
  return (
    <div className="grid grid-cols-2 gap-1 rounded-[14px] border border-white/[0.07] bg-white/[0.03] p-[3px]">
      <button
        type="button"
        title={t('player.pitchModeAuto')}
        onClick={() => setMode('auto')}
        className={`h-7 rounded-[10px] text-[10px] font-semibold uppercase tracking-[0.08em] transition-colors cursor-pointer ${
          mode === 'auto' ? 'bg-white text-black' : 'text-white/45 hover:text-white/75'
        }`}
      >
        {t('player.pitchModeAutoShort')}
      </button>
      <button
        type="button"
        title={t('player.pitchModeManual')}
        onClick={() => setMode('manual')}
        className={`h-7 rounded-[10px] text-[10px] font-semibold uppercase tracking-[0.08em] transition-colors cursor-pointer ${
          mode === 'manual' ? 'bg-white text-black' : 'text-white/45 hover:text-white/75'
        }`}
      >
        {t('player.pitchModeManualShort')}
      </button>
    </div>
  );
});

export const PitchSlider = React.memo(() => {
  const { t } = useTranslation();
  const playbackRate = usePlayerStore((s) => s.playbackRate);
  const pitchSemitones = usePlayerStore((s) => s.pitchSemitones);
  const mode = usePlayerStore((s) => s.pitchControlMode);
  const setPitch = usePlayerStore((s) => s.setPitchSemitones);
  const resetPitch = usePlayerStore((s) => s.resetPitchSemitones);
  const effective = getEffectivePitchSemitones(playbackRate, mode, pitchSemitones);
  const isManual = mode === 'manual';
  const canReset = isManual && Math.abs(pitchSemitones) >= 0.001;

  return (
    <div
      className={`rounded-[14px] border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 ${
        isManual ? '' : 'opacity-65'
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/45">
            {t('player.pitch')}
          </span>
          <span
            className={`rounded-full border px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.08em] ${
              isManual
                ? 'border-white/[0.12] bg-white/[0.05] text-white/55'
                : 'border-accent/30 bg-accent/[0.12] text-accent'
            }`}
          >
            {isManual ? t('player.pitchModeManualShort') : t('player.pitchModeAutoShort')}
          </span>
        </div>
        <button
          type="button"
          title={canReset ? t('player.pitchReset') : t('player.pitch')}
          onClick={() => {
            if (canReset) resetPitch();
          }}
          className={`min-w-[42px] text-right text-[11px] font-semibold tabular-nums transition-colors cursor-pointer ${
            canReset ? 'text-accent hover:text-accent/80' : 'text-white/45'
          }`}
        >
          {formatPitchSemitones(effective)}
        </button>
      </div>
      <Slider.Root
        className="group/pitch relative flex h-5 w-full cursor-pointer select-none touch-none items-center"
        aria-label={t('player.pitch')}
        value={[effective]}
        min={PITCH_SEMITONES_MIN}
        max={PITCH_SEMITONES_MAX}
        step={PITCH_SEMITONES_STEP}
        disabled={!isManual}
        onValueChange={([v]) => isManual && setPitch(v)}
        onWheel={(e) => {
          if (!isManual) return;
          if (e.cancelable) e.preventDefault();
          setPitch(pitchSemitones + (e.deltaY < 0 ? PITCH_SEMITONES_STEP : -PITCH_SEMITONES_STEP));
        }}
      >
        <Slider.Track className="relative h-[3px] grow rounded-full bg-white/[0.08] transition-all duration-150 group-hover/pitch:h-[4px]">
          <Slider.Range className="absolute h-full rounded-full bg-accent" />
        </Slider.Track>
        <Slider.Thumb className="block h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_10px_var(--color-accent-glow)] outline-none transition-all duration-150 scale-0 opacity-0 group-hover/pitch:scale-100 group-hover/pitch:opacity-100 disabled:scale-0 disabled:opacity-0" />
      </Slider.Root>
      {/* 0 semi tick */}
      <div className="relative mt-1 h-2 w-full pointer-events-none">
        <div className="absolute top-0 h-1.5 w-px bg-white/15" style={{ left: '50%' }} />
      </div>
    </div>
  );
});

const TuningBtn = React.memo(() => {
  const { t } = useTranslation();
  const playbackRate = usePlayerStore((s) => s.playbackRate);
  const pitchSemitones = usePlayerStore((s) => s.pitchSemitones);
  const pitchMode = usePlayerStore((s) => s.pitchControlMode);
  const isActive =
    Math.abs(playbackRate - 1) >= 0.001 ||
    (pitchMode === 'manual' && Math.abs(pitchSemitones) >= 0.001);

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button type="button" title={t('player.soundTuning')} className={btnClass(isActive, 'sm')}>
          {slidersHorizontal16}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="end"
          sideOffset={10}
          collisionPadding={12}
          className="z-[200] w-[300px] origin-bottom-right rounded-[18px] border border-white/[0.10] bg-[#101012]/96 p-3 shadow-[0_18px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl outline-none data-[state=open]:animate-fade-in-up"
        >
          <div className="absolute inset-x-0 top-0 h-12 rounded-t-[18px] bg-gradient-to-b from-white/[0.05] to-transparent pointer-events-none" />
          <div className="relative flex items-center gap-2 px-1 pb-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-white/55">
              {slidersHorizontal16}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/65">
                {t('player.soundTuning')}
              </p>
              <p className="text-[10px] text-white/30">
                {t('player.playbackSpeed')} · {t('player.pitch')}
              </p>
            </div>
          </div>
          <div className="relative space-y-2">
            <PitchModeToggle />
            <PlaybackRateSlider />
            <PitchSlider />
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
});

/* ── Track meta (art + title) for the pill ───────────────────── */

const PillTrack = React.memo(
  ({
    loadProgress,
    onContextToggle,
    contextOpen,
  }: {
    loadProgress: number | null;
    onContextToggle: () => void;
    contextOpen: boolean;
  }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const storeTrack = usePlayerStore((s) => s.currentTrack);
    const currentTrack = isDesignPreview() ? designPreviewTracks[0] : storeTrack;

    if (!currentTrack) {
      return (
        <div className="npb-meta">
          <div className="npb-art">
            <div className="npb-artfb" />
          </div>
          <div className="npb-txt">
            <span className="npb-sub">{t('player.notPlaying')}</span>
          </div>
        </div>
      );
    }

    return (
      <PillTrackBody
        track={currentTrack}
        navigate={navigate}
        loadProgress={loadProgress}
        onContextToggle={onContextToggle}
        contextOpen={contextOpen}
      />
    );
  },
);

const PillTrackBody = React.memo(function PillTrackBody({
  track,
  navigate,
  loadProgress,
  onContextToggle,
  contextOpen,
}: {
  track: Track;
  navigate: ReturnType<typeof useNavigate>;
  loadProgress: number | null;
  onContextToggle: () => void;
  contextOpen: boolean;
}) {
  const { t } = useTranslation();
  const artistDisplay = useArtistDisplay(track);
  const displayTitle = useDisplayTitle(track);
  const artistLinks = useArtistLinkItems(track);
  const artworkSmall = art(track.artwork_url, 't200x200');
  const hasArtistLink = artistLinks.some((it) => it.target);

  return (
    <div className="npb-meta">
      <button
        type="button"
        className="npb-art"
        onClick={onContextToggle}
        aria-label={t('player.nowPlaying')}
        aria-pressed={contextOpen}
      >
        {artworkSmall ? <img src={artworkSmall} alt="" /> : <div className="npb-artfb" />}
        {/* spinning vinyl ring + live "playing" equaliser — animated only while playing */}
        <span className="npb-ring" />
        <span className="npb-eq">
          <i />
          <i />
          <i />
          <i />
        </span>
        {loadProgress != null && <div className="npb-art-load">{loadPercent(loadProgress)}%</div>}
      </button>
      <div className="npb-txt">
        <span
          className="npb-ttl"
          onClick={() => navigate(`/track/${encodeURIComponent(track.urn)}`)}
        >
          {displayTitle}
        </span>
        <span className={`npb-sub${hasArtistLink ? ' is-link' : ''}`}>
          <UploadKindDot kind={artistDisplay.uploadKind} />
          <span>
            <ArtistNameLinks items={artistLinks} />
          </span>
        </span>
      </div>
    </div>
  );
});

/* ── Like / Dislike / quality cluster for the current track ──── */

const ReactCluster = React.memo(() => {
  const storeUrn = usePlayerStore((s) => s.currentTrack?.urn);
  const urn = isDesignPreview() ? designPreviewTracks[0].urn : storeUrn;
  if (!urn) return null;
  return <ReactClusterBody urn={urn} />;
});

// Single track-query + dislike observer shared by both reaction buttons.
const ReactClusterBody = React.memo(({ urn }: { urn: string }) => {
  const trackData = useTrackReactions(urn);
  const disliked = useDislikeStatus(isDesignPreview() ? undefined : urn);
  return (
    <div className="npb-reactions">
      <LikeButton trackUrn={urn} trackData={trackData} disliked={disliked} />
      <NowBarDislikeButton trackUrn={urn} trackData={trackData} disliked={disliked} />
    </div>
  );
});

/* ── Lane time readout (current · total), ~1fps ──────────────── */

const LaneTimes = React.memo(() => {
  const preview = isDesignPreview();
  const current = useSyncExternalStore(subscribe, () => Math.floor(getCurrentTime()));
  const duration = useSyncExternalStore(subscribe, getDuration);
  if (preview) {
    return (
      <div className="npb-times">
        <b>1:48</b>
        <DockProgress />
        <span>-2:24</span>
      </div>
    );
  }
  return (
    <div className="npb-times">
      <b>{formatTime(current)}</b>
      <DockProgress />
      <span>{formatTime(duration)}</span>
    </div>
  );
});

/* Pause looping animations while the window is hidden (WebView doesn't throttle). */
function useDocHidden(): boolean {
  const [hidden, setHidden] = useState(
    () => typeof document !== 'undefined' && document.visibilityState === 'hidden',
  );
  useEffect(() => {
    const onChange = () => setHidden(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);
  return hidden;
}

/* ── Background glow ─────────────────────────────────────────── */

/* ── NowPlayingBar ───────────────────────────────────────────── */

export const NowPlayingBar = React.memo(
  ({
    onQueueToggle,
    queueOpen,
    onContextToggle,
    contextOpen,
  }: {
    onQueueToggle: () => void;
    queueOpen: boolean;
    onContextToggle: () => void;
    contextOpen: boolean;
  }) => {
    const isPlaying = usePlayerStore((s) => s.isPlaying);
    const hidden = useDocHidden();
    const playingNow = isPlaying && !hidden;
    const loadProgress = useLoadProgress();

    return (
      <div className="npb">
        <div
          className={`npb-dock${loadProgress != null ? ' is-loading' : ''}`}
          data-playing={playingNow ? 'true' : 'false'}
        >
          {/* Opaque content layer keeps transport updates cheap. */}
          <div className="npb-content">
            <div className="npb-row">
              <div className="npb-left">
                <PillTrack
                  loadProgress={loadProgress}
                  onContextToggle={onContextToggle}
                  contextOpen={contextOpen}
                />
                <ReactCluster />
              </div>

              <div className="npb-center">
                <div className="npb-transport">
                  <ShuffleBtn />
                  <PrevBtn />
                  <PlayPauseBtn />
                  <NextBtn />
                  <RepeatBtn />
                  <AbLoopBtn />
                </div>
                <div className="npb-lane">
                  <LaneTimes />
                </div>
              </div>

              <div className="npb-tools">
                <div className="npb-secondary-tools">
                  <TuningBtn />
                  <EqBtn />
                </div>
                <ContextBtn onClick={onContextToggle} active={contextOpen} />
                <QueueBtn onClick={onQueueToggle} active={queueOpen} />
                <LyricsBtn />
                <ControlVolumeBtn size="sm" />
                <div className="npb-vol-slider flex items-center gap-2 pl-1">
                  <VolumeSlider className="w-[76px]" />
                  <VolumeLabel />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  },
);
