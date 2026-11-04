import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePerfMode } from '../../../lib/perf';
import { useFormatSize } from './bytes';
import { useReducedMotion } from './motion';
import { quotaShare, ringTone } from './ring-tone';

function RingLabel({ used, quota, size }: { used: number; quota: number; size: number }) {
  const { t } = useTranslation();
  const format = useFormatSize();
  if (size < 40) return null;
  if (size < 88) {
    return (
      <span
        className="font-semibold tabular-nums text-ink-80"
        style={{ fontSize: Math.round(size * 0.24) }}
      >
        {Math.round(quotaShare(used, quota) * 100)}%
      </span>
    );
  }
  return (
    <span className="flex flex-col items-center leading-none">
      <span
        className="font-bold tracking-tight tabular-nums text-ink-92"
        style={{ fontSize: Math.round(size * 0.15) }}
      >
        {format(used)}
      </span>
      <span
        className="mt-1.5 font-medium text-ink-45"
        style={{ fontSize: Math.max(10, Math.round(size * 0.085)) }}
      >
        {t('chat.storage.ring.of', { quota: format(quota) })}
      </span>
    </span>
  );
}

export const QuotaRing = memo(function QuotaRing({
  used,
  quota,
  size = 120,
}: {
  used: number;
  quota: number;
  size?: number;
}) {
  const { t } = useTranslation();
  const format = useFormatSize();
  const perf = usePerfMode();
  const reduced = useReducedMotion();
  const share = quotaShare(used, quota);
  const [drawn, setDrawn] = useState(reduced ? share : 0);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setDrawn(share));
    return () => cancelAnimationFrame(frame);
  }, [share]);

  const stroke = Math.max(3, Math.round(size * 0.075));
  const radius = (size - stroke) / 2;
  const length = 2 * Math.PI * radius;
  const center = size / 2;
  const visible = used > 0 ? Math.max(drawn, 0.012) : 0;
  const tone = ringTone(used, quota);
  const duration = perf.mode === 'light' ? 420 : 1100;

  return (
    <span
      role="meter"
      aria-valuemin={0}
      aria-valuemax={quota}
      aria-valuenow={Math.min(used, quota)}
      aria-valuetext={t('chat.storage.ring.value', { used: format(used), quota: format(quota) })}
      data-ui="chat-quota-ring"
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0 -rotate-90"
        aria-hidden
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="rgb(var(--ink) / 0.08)"
          strokeWidth={stroke}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={tone}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={length}
          strokeDashoffset={length * (1 - visible)}
          opacity={visible > 0 ? 1 : 0}
          style={{
            transition: reduced
              ? undefined
              : `stroke-dashoffset ${duration}ms var(--ease-apple), stroke 600ms ease`,
            filter:
              perf.glow && size >= 64
                ? `drop-shadow(0 0 ${Math.round(stroke * 1.4)}px color-mix(in srgb, ${tone} 45%, transparent))`
                : undefined,
          }}
        />
      </svg>
      <span className="relative">
        <RingLabel used={used} quota={quota} size={size} />
      </span>
    </span>
  );
});
