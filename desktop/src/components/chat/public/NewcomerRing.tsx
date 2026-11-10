import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { textBytes, textRoom } from '../../../lib/chat/post-body';

const SIZE = 22;
const STROKE = 2.5;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const NEAR = 0.8;

export const NewcomerRing = memo(function NewcomerRing({
  text,
  bodyMax,
}: {
  text: string;
  bodyMax: number;
}) {
  const { t } = useTranslation();
  const room = Math.max(1, textRoom(bodyMax));
  const left = room - textBytes(text);
  const share = Math.min(1, Math.max(0, 1 - left / room));
  const over = left < 0;
  const tone = over ? 'text-bad' : share >= NEAR ? 'text-accent' : 'text-ink-45';
  return (
    <span
      role="meter"
      data-ui="chat-newcomer"
      data-over={over ? '' : undefined}
      aria-label={t('chat.public.newcomer.title')}
      aria-valuemin={0}
      aria-valuemax={room}
      aria-valuenow={Math.min(room, room - left)}
      title={
        over ? t('chat.public.newcomer.over') : t('chat.public.newcomer.left', { count: left })
      }
      className={`mb-[7px] flex shrink-0 items-center gap-1.5 self-end transition-colors duration-200 ${tone}`}
    >
      {(over || share >= NEAR) && (
        <span className="text-[11.5px] font-bold tabular-nums">{left}</span>
      )}
      <svg width={SIZE} height={SIZE} className="-rotate-90" aria-hidden>
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          className="stroke-ink/10"
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - share)}
          className="transition-[stroke-dashoffset] duration-150 motion-reduce:transition-none"
        />
      </svg>
    </span>
  );
});
