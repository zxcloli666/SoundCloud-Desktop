import * as Popover from '@radix-ui/react-popover';
import * as Slider from '@radix-ui/react-slider';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/shallow';
import { api } from '../../lib/api';
import { getCurrentTime, getDuration, handlePrev, seek, subscribe } from '../../lib/audio';
import { toggleDislike, useDislikeStatus } from '../../lib/dislikes';
import { art, formatTime } from '../../lib/formatters';
import { invalidateAllLikesCache } from '../../lib/hooks';
import {
  audioLines16,
  Heart,
  listMusic16,
  MicVocal,
  pauseBlack20,
  playBlack20,
  repeat1Icon16,
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
import { useLyricsStore } from '../../stores/lyrics';
import {
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
import { EqualizerPanel } from '../music/EqualizerPanel';

/* ── Download Progress Panel ────────────────────────────────── */

const DownloadProgressPanel = React.memo(() => {
  const downloadProgress = usePlayerStore((s) => s.downloadProgress);
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
        }, 260);
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

  if (visibleProgress === null) return null;

  const normalizedProgress = Math.max(0, Math.min(1, visibleProgress));
  const progressPercent =
    normalizedProgress >= 1 ? 100 : Math.max(1, Math.min(99, Math.round(normalizedProgress * 100)));

  return (
    <div className="pointer-events-none absolute left-1/2 top-0 z-30 -translate-x-1/2 -translate-y-[calc(100%+8px)]">
      <div
        className="liquid-control flex min-w-[148px] items-center gap-2.5 rounded-full px-3 py-2"
        style={{ contain: 'strict', transform: 'translateZ(0)' }}
      >
        <div className="relative h-1.5 w-20 overflow-hidden rounded-full bg-white/[0.09]">
          <div className="absolute inset-0 rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))]" />
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-150 ease-out"
            style={{
              width: `${progressPercent}%`,
              background:
                'linear-gradient(90deg, var(--color-accent) 0%, var(--color-accent-hover) 100%)',
              boxShadow: '0 0 12px var(--color-accent-glow)',
            }}
          />
        </div>
        <div className="min-w-[34px] text-right text-[11px] font-semibold tabular-nums text-white/72">
          {progressPercent}%
        </div>
      </div>
    </div>
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
      <Slider.Track className="relative h-[4px] grow rounded-full bg-white/[0.12] shadow-[inset_0_1px_2px_rgba(0,0,0,0.25)] transition-all duration-150 group-hover:h-[6px]">
        <Slider.Range
          ref={rangeRef}
          className="absolute h-full rounded-full bg-[linear-gradient(90deg,var(--color-accent),var(--color-accent-hover))] shadow-[0_0_14px_color-mix(in_srgb,var(--color-accent-glow)_100%,transparent)] will-change-transform"
        />
      </Slider.Track>
      <Slider.Thumb
        ref={thumbRef}
        className="block w-3 h-3 rounded-full bg-accent shadow-[0_0_10px_color-mix(in_srgb,var(--color-accent-glow)_100%,transparent)] scale-0 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-150 outline-none will-change-transform"
      />
    </Slider.Root>
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
        <Slider.Track className="relative h-[4px] grow rounded-full bg-white/[0.12] shadow-[inset_0_1px_2px_rgba(0,0,0,0.24)] transition-all duration-150 group-hover:h-[5px]">
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

const PlaybackQualityBadge = React.memo(() => {
  const { t } = useTranslation();
  const { playbackQuality, playbackSource } = usePlayerStore(
    useShallow((s) => ({
      playbackQuality: s.playbackQuality,
      playbackSource: s.playbackSource,
    })),
  );

  if (!playbackQuality) return null;

  const isHq = playbackQuality === 'hq';

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <span
        className={`inline-flex h-6 shrink-0 items-center rounded-md border px-2 text-[9px] font-semibold tracking-[0.14em] ${
          isHq
            ? 'border-white/[0.14] bg-white/[0.08] text-white/92'
            : 'border-white/[0.08] bg-white/[0.04] text-white/68'
        }`}
      >
        {isHq ? t('player.qualityHQ') : t('player.qualitySQ')}
      </span>
      {playbackSource === 'storage' && (
        <span className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-md border border-[#b7ffd8]/[0.16] bg-[#b7ffd8]/[0.07] px-2 text-[8px] font-medium tracking-[0.12em] text-[#dff7e9]/82">
          <span className="h-1.5 w-1.5 rounded-full bg-[#b7ffd8] shadow-[0_0_8px_rgba(183,255,216,0.55)]" />
          {t('player.qualityCDN')}
        </span>
      )}
    </div>
  );
});

/* ── Like / Dislike buttons ──────────────────────────────────── */

function useTrackReactions(trackUrn: string) {
  const { data: trackData } = useQuery({
    queryKey: ['track', trackUrn],
    queryFn: () => api<Track>(`/tracks/${encodeURIComponent(trackUrn)}`),
    enabled: !!trackUrn,
    staleTime: 30_000,
  });
  return trackData;
}

function LikeButton({ trackUrn }: { trackUrn: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const trackData = useTrackReactions(trackUrn);
  const disliked = useDislikeStatus(trackUrn);

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

export function NowBarDislikeButton({ trackUrn }: { trackUrn: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const trackData = useTrackReactions(trackUrn);
  const disliked = useDislikeStatus(trackUrn);

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
  `${size === 'sm' ? 'w-9 h-9' : 'w-10 h-10'} rounded-full flex items-center justify-center transition-all duration-150 ease-[var(--ease-apple)] cursor-pointer hover:bg-white/[0.10] hover:shadow-[inset_1px_1px_0_rgba(255,255,255,0.18)] ${
    active
      ? 'bg-white/[0.10] text-accent shadow-[0_0_16px_color-mix(in_srgb,var(--color-accent-glow)_100%,transparent)]'
      : 'text-white/48 hover:text-white/86'
  }`;

const PlayPauseBtn = React.memo(() => {
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  return (
    <button
      type="button"
      onClick={togglePlay}
      className="liquid-button-primary mx-1.5 flex h-12 w-12 cursor-pointer items-center justify-center rounded-full text-accent-contrast transition-all duration-200 ease-[var(--ease-apple)] hover:scale-105 active:scale-95"
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

const QueueBtn = React.memo(({ onClick, active }: { onClick: () => void; active: boolean }) => (
  <button type="button" onClick={onClick} className={btnClass(active, 'sm')}>
    {listMusic16}
  </button>
));

const LyricsBtn = React.memo(() => {
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
      className={btnClass(open, 'sm')}
    >
      <MicVocal size={16} />
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
        <Slider.Thumb className="block h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_10px_color-mix(in_srgb,var(--color-accent-glow)_100%,transparent)] outline-none transition-all duration-150 scale-0 opacity-0 group-hover/rate:scale-100 group-hover/rate:opacity-100" />
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
        <Slider.Thumb className="block h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_10px_color-mix(in_srgb,var(--color-accent-glow)_100%,transparent)] outline-none transition-all duration-150 scale-0 opacity-0 group-hover/pitch:scale-100 group-hover/pitch:opacity-100 disabled:scale-0 disabled:opacity-0" />
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

/* ── Track Info (left section) ───────────────────────────────── */

const TrackInfo = React.memo(() => {
  const navigate = useNavigate();
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const openLyricsPanel = useLyricsStore((s) => s.openPanel);
  const artworkSmall = art(currentTrack?.artwork_url, 't200x200');

  if (!currentTrack) {
    return (
      <div className="flex items-center gap-3.5 w-[340px] min-w-0">
        <p className="text-[13px] text-white/15">Not playing</p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3.5 w-[340px] min-w-0">
      <div
        className="relative w-14 h-14 rounded-[10px] shrink-0 overflow-hidden cursor-pointer shadow-xl shadow-black/40 ring-1 ring-white/[0.06] hover:ring-white/[0.12] transition-all duration-200 group/art"
        onClick={() => openLyricsPanel({ rightPanelOpen: false })}
      >
        {artworkSmall ? (
          <img src={artworkSmall} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-white/[0.04]" />
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 group-hover/art:bg-black/40 group-hover/art:opacity-100 transition-all duration-200">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="text-white">
            <path
              d="M3 7V3h4M11 3h4v4M15 11v4h-4M7 15H3v-4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <p
            className="text-[13px] text-white/90 truncate font-medium cursor-pointer hover:text-white leading-tight transition-colors"
            onClick={() => navigate(`/track/${encodeURIComponent(currentTrack.urn)}`)}
          >
            {currentTrack.title}
          </p>
        </div>
        <p
          className="text-[11px] text-white/35 truncate mt-1 cursor-pointer hover:text-white/55 transition-colors"
          onClick={() => navigate(`/user/${encodeURIComponent(currentTrack.user.urn)}`)}
        >
          {currentTrack.user.username}
        </p>
      </div>
      <LikeButton trackUrn={currentTrack.urn} />
      <NowBarDislikeButton trackUrn={currentTrack.urn} />
      <PlaybackQualityBadge />
    </div>
  );
});

/* ── Background glow ─────────────────────────────────────────── */

const BackgroundGlow = React.memo(() => {
  const artworkUrl = usePlayerStore((s) => s.currentTrack?.artwork_url);
  const artwork = art(artworkUrl, 't200x200');

  if (!artwork) return null;
  return (
    <div
      className="absolute inset-0 opacity-[0.05] blur-3xl pointer-events-none"
      style={{
        backgroundImage: `url(${artwork})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        contain: 'strict',
        transform: 'translateZ(0)',
      }}
    />
  );
});

/* ── NowPlayingBar ───────────────────────────────────────────── */

export const NowPlayingBar = React.memo(
  ({ onQueueToggle, queueOpen }: { onQueueToggle: () => void; queueOpen: boolean }) => {
    return (
      <div className="relative z-[50] mx-3 mb-3 shrink-0">
        <BackgroundGlow />
        {/* Isolated layer — repaints here won't cascade to blur background */}
        <div
          className="liquid-panel relative overflow-visible rounded-[30px]"
          style={{ isolation: 'isolate' }}
        >
          <DownloadProgressPanel />
          <ProgressSlider />

          <div className="relative flex h-[82px] items-center gap-3 px-5">
            {/* Left: track info */}
            <TrackInfo />

            {/* Center: controls */}
            <div className="flex-1 flex flex-col items-center gap-0.5">
              <div className="flex items-center gap-0.5">
                <ShuffleBtn />
                <PrevBtn />
                <PlayPauseBtn />
                <NextBtn />
                <RepeatBtn />
              </div>
              <ProgressTime />
            </div>

            {/* Right: volume + queue */}
            <div className="flex items-center gap-0.5 w-[280px] justify-end">
              <TuningBtn />
              <EqBtn />
              <LyricsBtn />
              <QueueBtn onClick={onQueueToggle} active={queueOpen} />
              <ControlVolumeBtn size="sm" />
              <VolumeSlider className="w-[100px]" />
              <VolumeLabel />
            </div>
          </div>
        </div>
      </div>
    );
  },
);
