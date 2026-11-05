import { memo } from 'react';
import {useTranslation} from 'react-i18next';
import type { TrackScdMeta } from '../../stores/player';

type Variant = 'inline' | 'overlay';

interface Props {
  meta?: TrackScdMeta;
  variant?: Variant;
  showIndex?: boolean;
}

/**
 * Сравнение полей меты, влияющих на бейдж. Для `React.memo`-компараторов
 * строк трека — чтобы бейдж переставал отставать, когда у того же урна
 * меняется статус анализа/кеша (например, трек дослушали → проиндексировали).
 */
export function sameScdMeta(a?: TrackScdMeta, b?: TrackScdMeta): boolean {
    return (
        a?.storage_state === b?.storage_state &&
        a?.storage_quality === b?.storage_quality &&
        a?.index_state === b?.index_state
    );
}

export type Tier = 'analyzed' | 'cached' | 'pending' | 'tooLong' | 'failed';

// letter + per-tier tone; second value is overlay tone (solid on artwork)
export const TIERS: Record<Tier, { letter: string; inline: string; overlay: string }> = {
    analyzed: {
        letter: 'A',
        inline: 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/25',
        overlay: 'bg-emerald-400/90 text-black ring-black/5',
    },
    cached: {
        letter: 'C',
        inline: 'bg-amber-500/15 text-amber-300 ring-amber-400/25',
        overlay: 'bg-amber-400/90 text-black ring-black/5',
    },
    pending: {
        letter: '·',
        inline: 'bg-ink/[0.06] text-ink-40 ring-ink/10',
        overlay: 'bg-ink/75 text-black/60 ring-black/5',
    },
    tooLong: {
        letter: 'F',
        inline: 'bg-shade-60 text-ink-70 ring-ink/15',
        overlay: 'bg-black/85 text-ink-80 ring-ink/15',
    },
    failed: {
        letter: '!',
        inline: 'bg-rose-500/15 text-rose-300 ring-rose-400/25',
        overlay: 'bg-rose-400/90 text-black ring-black/5',
    },
};

const glow = (c: string) => `shadow-[0_0_8px_color-mix(in_oklab,var(--color-${c})_55%,transparent)]`;

export const RATING_CHIPS: Record<Tier, { letter: string; chip: string; dot: string }> = {
    analyzed: {
        letter: TIERS.analyzed.letter,
        chip: 'border-mint/[0.16] bg-mint/[0.07] text-mint-ink/82',
        dot: 'bg-mint shadow-[0_0_8px_rgb(var(--mint)/0.55)]',
    },
    cached: {
        letter: TIERS.cached.letter,
        chip: 'border-amber-300/[0.18] bg-amber-300/[0.07] text-amber-300',
        dot: `bg-amber-300 ${glow('amber-300')}`,
    },
    pending: {
        letter: TIERS.pending.letter,
        chip: 'border-ink/[0.08] bg-ink/[0.04] text-ink-50',
        dot: 'bg-ink-40',
    },
    tooLong: {
        letter: TIERS.tooLong.letter,
        chip: 'border-ink/[0.12] bg-ink/[0.06] text-ink-68',
        dot: 'bg-ink-50',
    },
    failed: {
        letter: TIERS.failed.letter,
        chip: 'border-rose-300/[0.18] bg-rose-300/[0.07] text-rose-300',
        dot: `bg-rose-300 ${glow('rose-300')}`,
    },
};

export function tierOf(meta: TrackScdMeta, showIndex: boolean): Tier | null {
    const s = meta.storage_state;
    const i = meta.index_state;
    if (s === 'too_long' || i === 'too_long') return 'tooLong';
    if (s === 'failed' || s === 'missing' || i === 'failed') return 'failed';
    if (s === 'ok') return showIndex && i === 'indexed' ? 'analyzed' : 'cached';
    return showIndex ? 'pending' : null;
}

function storedQuality(meta: TrackScdMeta, tier: Tier) {
    return tier === 'analyzed' || tier === 'cached' ? meta.storage_quality : undefined;
}

export function tierTitleKey(tier: Tier, meta: TrackScdMeta): string {
    const stored = storedQuality(meta, tier);
    return `track.status.${tier}${stored === 'uq' ? 'Uq' : stored === 'hq' ? 'Hq' : ''}`;
}

function TrackStatusBadgesInner({ meta, variant = 'inline', showIndex = true }: Props) {
    const {t} = useTranslation();
  if (!meta) return null;
    const tier = tierOf(meta, showIndex);
    if (!tier) return null;

    const {letter, inline, overlay} = TIERS[tier];
    const tone = variant === 'overlay' ? overlay : inline;
    const stored = storedQuality(meta, tier);
    const hq = stored === 'hq' || stored === 'uq';

  return (
      <span
          data-scheme={variant === 'overlay' ? 'dark' : undefined}
          title={t(tierTitleKey(tier, meta))}
          className={`relative inline-flex items-center justify-center w-[18px] h-[18px] rounded-[6px] text-[10px] font-bold leading-none ring-1 ring-inset select-none ${tone}`}
      >
      {letter}
          {hq ? (
              <span
                  className="absolute -top-px -right-px w-[5px] h-[5px] rounded-full bg-current ring-1 ring-black/20"/>
          ) : null}
    </span>
  );
}

export const TrackStatusBadges = memo(TrackStatusBadgesInner);
