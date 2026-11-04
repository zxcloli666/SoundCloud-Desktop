import { memo } from 'react';
import { lifeLeft, timeLeft } from '../../../lib/chat/time';
import { useThread } from '../thread/context';
import { useMinuteNow } from './useMinuteNow';

const RADIUS = 4.5;
const CIRCLE = 2 * Math.PI * RADIUS;
const LOW = 0.1;

export const ExpiryBadge = memo(function ExpiryBadge({
  sentAt,
  expiresAt,
}: {
  sentAt: number;
  expiresAt: number;
}) {
  const { t, language } = useThread();
  const now = useMinuteNow();
  const left = lifeLeft(sentAt, expiresAt, now);
  const label = timeLeft(expiresAt, now, language);
  const low = left < LOW;

  return (
    <span
      title={t('chat.thread.bubble.expiresIn', { time: label })}
      className={`inline-flex items-center gap-[3px] tabular-nums ${low ? 'text-rose-300' : ''}`}
    >
      <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden className="shrink-0">
        <circle
          cx="6"
          cy="6"
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.25"
          strokeWidth="1.6"
        />
        <circle
          cx="6"
          cy="6"
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeDasharray={CIRCLE}
          strokeDashoffset={CIRCLE * (1 - left)}
          transform="rotate(-90 6 6)"
        />
      </svg>
      {low && label}
    </span>
  );
});
