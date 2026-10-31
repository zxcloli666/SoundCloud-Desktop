import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { art, formatTime } from '../../lib/formatters';
import { Lock } from '../../lib/icons';
import { usePremium } from '../../lib/premium-cache';
import { getArtistDisplay, getDisplayTitle } from '../../lib/track-display';
import type { Track } from '../../stores/player';
import { usePreviewEnd } from '../../stores/preview-end';
import { MomentCard } from './MomentCard';
import { StarCta } from './StarCta';

const VISIBLE_MS = 12_000;

/** A Go+ snippet just ran out: show how much of the track stayed locked, and the key to it. */
export const PreviewEndCard = memo(function PreviewEndCard() {
  const track = usePreviewEnd((s) => s.track);
  const clear = usePreviewEnd((s) => s.clear);
  const premium = usePremium();
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (!track || hovered) return;
    const id = setTimeout(clear, VISIBLE_MS);
    return () => clearTimeout(id);
  }, [track, hovered, clear]);

  if (!track || premium) return null;
  return (
    <MomentCard onClose={clear} onHover={setHovered}>
      <PreviewBody track={track} onOpen={clear} />
    </MomentCard>
  );
});

const PreviewBody = memo(function PreviewBody({
  track,
  onOpen,
}: {
  track: Track;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const full = track.full_duration ?? track.duration;
  const played = Math.min(track.duration, full);
  const share = full > 0 ? played / full : 1;
  const cover = art(track.artwork_url, 't200x200');

  return (
    <div>
      <div className="flex items-center gap-3 pr-6">
        <div className="size-12 shrink-0 overflow-hidden rounded-[10px] bg-ink/[0.06]">
          {cover && <img src={cover} alt="" className="size-full object-cover" draggable={false} />}
        </div>
        <div className="min-w-0">
          <div className="truncate text-[13.5px] font-semibold text-ink-90">
            {getDisplayTitle(track)}
          </div>
          <div className="truncate text-[12px] text-ink-40">
            {getArtistDisplay(track).primary || track.user?.username}
          </div>
        </div>
      </div>

      <div className="mt-3.5">
        <div className="relative flex h-2 overflow-hidden rounded-full bg-ink/[0.06]">
          <span
            className="h-full rounded-full"
            style={{
              width: `${share * 100}%`,
              background: 'var(--color-accent)',
              boxShadow: '0 0 10px var(--color-accent-glow)',
            }}
          />
          <span
            className="h-full flex-1"
            style={{
              background:
                'repeating-linear-gradient(135deg, rgb(var(--ink) / 0.10) 0 4px, transparent 4px 8px)',
            }}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between font-mono text-[10.5px] text-ink-40">
          <span className="text-accent">{formatTime(played / 1000)}</span>
          <span className="inline-flex items-center gap-1">
            <Lock size={10} />
            {formatTime(full / 1000)}
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-35">
          {t('starMoments.preview.label')}
        </span>
        <StarCta onOpen={onOpen} />
      </div>
    </div>
  );
});
