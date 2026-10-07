import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownToLine, Check, RefreshCw } from '../../lib/icons';
import { refreshOfflineCached, saveOffline, useOfflineSaves } from '../../stores/offline-saves';
import type { Track } from '../../stores/player';

const RING_RADIUS = 9;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

function ProgressRing({ progress, size }: { progress: number; size: number }) {
  const offset = RING_LENGTH * (1 - Math.max(progress, 0.04));
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className="-rotate-90 drop-shadow-[0_0_6px_var(--color-accent-glow)]"
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r={RING_RADIUS}
        fill="none"
        stroke="rgba(255,255,255,0.1)"
        strokeWidth="2.25"
      />
      <circle
        cx="12"
        cy="12"
        r={RING_RADIUS}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeDasharray={RING_LENGTH}
        strokeDashoffset={offset}
        className="transition-[stroke-dashoffset] duration-300 ease-[var(--ease-apple)]"
      />
    </svg>
  );
}

function useSaveState(urn: string) {
  const progress = useOfflineSaves((s) => s.progress[urn]);
  const cached = useOfflineSaves((s) => s.cached[urn] === true);
  return { progress, saving: progress !== undefined, cached };
}

function useLabel(saving: boolean, cached: boolean, progress: number | undefined) {
  const { t } = useTranslation();
  if (saving) return t('track.offlineSaving', { percent: Math.round((progress ?? 0) * 100) });
  return cached ? t('track.offlineRefetch') : t('track.offlineSave');
}

export const SaveOfflineAction = React.memo(function SaveOfflineAction({
  track,
}: {
  track: Track;
}) {
  const { progress, saving, cached } = useSaveState(track.urn);
  const label = useLabel(saving, cached, progress);

  useEffect(() => {
    void refreshOfflineCached(track.urn);
  }, [track.urn]);

  return (
    <button
      type="button"
      onClick={() => void saveOffline(track, cached)}
      disabled={saving}
      title={label}
      aria-label={label}
      className={`group/offline relative inline-flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 ease-[var(--ease-apple)] cursor-pointer disabled:cursor-default ${
        cached && !saving
          ? 'text-accent bg-accent/15 hover:bg-accent/20'
          : 'text-white/60 hover:text-white/95 hover:bg-white/[0.07]'
      }`}
    >
      {saving ? (
        <>
          <ProgressRing progress={progress ?? 0} size={26} />
          <ArrowDownToLine size={11} className="absolute text-white/80 animate-pulse" />
        </>
      ) : cached ? (
        <>
          <Check size={16} className="group-hover/offline:hidden" />
          <RefreshCw size={15} className="hidden group-hover/offline:block" />
        </>
      ) : (
        <ArrowDownToLine size={16} />
      )}
    </button>
  );
});

export const SaveOfflineRowButton = React.memo(function SaveOfflineRowButton({
  track,
}: {
  track: Track;
}) {
  const { progress, saving, cached } = useSaveState(track.urn);
  const label = useLabel(saving, cached, progress);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        void saveOffline(track, cached);
      }}
      disabled={saving}
      title={label}
      aria-label={label}
      className={`group/offline relative cursor-pointer disabled:cursor-default w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200 ${
        saving ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
      } ${cached ? 'text-accent' : 'text-white/30 hover:text-white/80 hover:bg-white/[0.06]'}`}
    >
      {saving ? (
        <ProgressRing progress={progress ?? 0} size={20} />
      ) : cached ? (
        <>
          <Check size={14} className="group-hover/offline:hidden" />
          <RefreshCw size={13} className="hidden group-hover/offline:block" />
        </>
      ) : (
        <ArrowDownToLine size={14} />
      )}
    </button>
  );
});
