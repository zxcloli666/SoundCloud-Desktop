import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MicOff } from './icons';
import { useServerNow } from './useRoom';

const RING = 30;
const STROKE = 2.5;
const RADIUS = (RING - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function clock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}`
    : `${minutes}:${seconds}`;
}

function Ring({ share }: { share: number }) {
  return (
    <svg width={RING} height={RING} className="absolute inset-0 -rotate-90" aria-hidden>
      <circle
        cx={RING / 2}
        cy={RING / 2}
        r={RADIUS}
        fill="none"
        className="stroke-rose-300/20"
        strokeWidth={STROKE}
      />
      <circle
        cx={RING / 2}
        cy={RING / 2}
        r={RADIUS}
        fill="none"
        className="stroke-rose-300"
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={CIRCUMFERENCE * (1 - share)}
        style={{ transition: 'stroke-dashoffset 900ms linear' }}
      />
    </svg>
  );
}

export const MutedBar = memo(function MutedBar({ until }: { until: number }) {
  const { t } = useTranslation();
  const now = useServerNow(1_000, true);
  const [since] = useState(() => Math.min(now, until - 1));
  const left = until - now;
  const share = Math.max(0, Math.min(1, left / (until - since)));

  return (
    <div className="flex h-14 shrink-0 items-center gap-3 border-t border-rose-300/15 bg-gradient-to-r from-rose-400/[0.12] to-transparent px-4">
      <span className="relative flex size-[30px] shrink-0 items-center justify-center text-rose-200">
        <Ring share={share} />
        <MicOff size={13} />
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-rose-100/90">
        {t('chat.room.muted.title')}
      </span>
      <span className="shrink-0 text-[13px] font-semibold tabular-nums text-rose-200/80">
        {clock(left)}
      </span>
    </div>
  );
});
