import { useTranslation } from 'react-i18next';
import { art, formatTime } from '../../../../lib/formatters';
import { Check, Music } from '../../../../lib/icons';
import { getArtistDisplay, getDisplayTitle } from '../../../../lib/track-display';
import { usePlayerStore } from '../../../../stores/player';
import { IDLE_LIVE, type LiveScrobble, useScrobbleStore } from '../../../../stores/scrobble';

const RING = 30;
const STROKE = 3;
const CIRCUMFERENCE = 2 * Math.PI * (RING - STROKE);

function progressOf(live: LiveScrobble): number {
  if (live.phase === 'scrobbled') return 1;
  if (live.phase !== 'listening' || live.threshold <= 0) return 0;
  return Math.min(1, live.played / live.threshold);
}

function Ring({ live, artwork }: { live: LiveScrobble; artwork: string | null }) {
  const progress = progressOf(live);
  const done = live.phase === 'scrobbled';
  return (
    <div className="relative shrink-0" style={{ width: RING * 2, height: RING * 2 }}>
      <svg width={RING * 2} height={RING * 2} className="absolute inset-0 -rotate-90" aria-hidden>
        <circle
          cx={RING}
          cy={RING}
          r={RING - STROKE}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={STROKE}
        />
        <circle
          cx={RING}
          cy={RING}
          r={RING - STROKE}
          fill="none"
          stroke={done ? '#23a55a' : 'var(--color-accent)'}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
          style={{
            transition: 'stroke-dashoffset 900ms linear, stroke 400ms ease',
            filter: `drop-shadow(0 0 6px ${done ? 'rgba(35,165,90,0.6)' : 'var(--color-accent-glow)'})`,
          }}
        />
      </svg>
      <div className="absolute inset-[7px] overflow-hidden rounded-full bg-white/[0.04]">
        {artwork ? (
          <img src={artwork} alt="" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-white/25">
            <Music size={16} />
          </div>
        )}
      </div>
      {done && (
        <div className="absolute -bottom-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full bg-[#23a55a] text-white shadow-[0_0_10px_rgba(35,165,90,0.7)]">
          <Check size={12} strokeWidth={3} />
        </div>
      )}
    </div>
  );
}

function phaseText(
  live: LiveScrobble,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  switch (live.phase) {
    case 'scrobbled':
      return t('settings.scrobbleLiveScrobbled');
    case 'short':
      return t('settings.scrobbleLiveShort');
    case 'preview':
      return t('settings.scrobbleLivePreview');
    case 'listening':
      return t('settings.scrobbleLiveListening', {
        time: formatTime(Math.max(0, live.threshold - live.played)),
      });
    default:
      return t('settings.scrobbleLiveIdle');
  }
}

export function LivePanel({ paused }: { paused: boolean }) {
  const { t } = useTranslation();
  const live = useScrobbleStore((s) => s.live);
  const sent = useScrobbleStore((s) => s.sent);
  const track = usePlayerStore((s) => s.currentTrack);
  const shown = track && live.urn === track.urn ? live : null;
  const artist = track ? getArtistDisplay(track).primary || track.user?.username || '' : '';

  return (
    <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/35">
          {t('settings.scrobbleLiveTitle')}
        </p>
        {sent > 0 && (
          <p className="text-[11px] text-white/35 tabular-nums">
            {t('settings.scrobbleLiveSession', { count: sent })}
          </p>
        )}
      </div>
      {track && !paused ? (
        <div className="flex items-center gap-3.5">
          <Ring live={shown ?? IDLE_LIVE} artwork={art(track.artwork_url, 't200x200')} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] font-semibold text-white/85">
              {getDisplayTitle(track)}
            </p>
            <p className="truncate text-[12px] text-white/45">{artist}</p>
            <p
              className={`mt-1 truncate text-[11.5px] tabular-nums ${
                shown?.phase === 'scrobbled' ? 'text-[#3ddc84]' : 'text-white/35'
              }`}
            >
              {shown ? phaseText(shown, t) : t('settings.scrobbleLiveIdle')}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-[12px] text-white/35">
          {t(paused ? 'settings.scrobblePaused' : 'settings.scrobbleLiveIdle')}
        </p>
      )}
    </div>
  );
}
