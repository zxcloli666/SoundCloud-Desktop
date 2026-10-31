import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

interface Remaining {
  d: number;
  h: number;
  m: number;
  s: number;
  total: number;
}

function getRemaining(target: number): Remaining {
  const total = Math.max(0, Math.floor((target - Date.now()) / 1000));
  return {
    d: Math.floor(total / 86400),
    h: Math.floor((total % 86400) / 3600),
    m: Math.floor((total % 3600) / 60),
    s: total % 60,
    total,
  };
}

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

const TimeBlock = React.memo(function TimeBlock({
  valueRef,
  initial,
  label,
}: {
  valueRef: React.Ref<HTMLSpanElement>;
  initial: number;
  label: string;
}) {
  return (
    <div
      className="relative flex flex-col items-center justify-center min-w-[64px] px-3 py-2.5 rounded-xl"
      style={{
        background: 'linear-gradient(160deg, rgb(var(--ink) / 0.08), rgb(var(--ink) / 0.02))',
        border: '0.5px solid rgb(var(--ink) / 0.12)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -1px 0 rgb(var(--shade) / calc(0.2 * var(--shade-alpha))), 0 4px 16px rgb(var(--shade) / calc(0.25 * var(--shade-alpha)))',
        contain: 'layout style paint',
      }}
    >
      <span
        ref={valueRef}
        className="text-[24px] font-bold leading-none text-ink-95"
        style={{
          fontVariantNumeric: 'tabular-nums',
          fontFeatureSettings: '"tnum" 1',
          fontKerning: 'none',
          letterSpacing: 0,
          display: 'inline-block',
          width: '2ch',
          textAlign: 'center',
          textShadow: '0 1px 2px rgba(0,0,0,0.3)',
        }}
      >
        {pad2(initial)}
      </span>
      <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-purple-200/55 mt-1">
        {label}
      </span>
    </div>
  );
});

const Separator = React.memo(() => (
  <span className="text-[20px] font-light text-ink-25 leading-none -mt-3">:</span>
));

interface CountdownProps {
  /** Unlock target as a unix-ms timestamp. */
  target: number;
  /** Called once when the countdown reaches zero. */
  onExpire: () => void;
}

/**
 * Tick happens via direct DOM mutation — no React re-renders per second.
 * Only this small component owns the interval; the surrounding overlay stays static.
 */
export const Countdown = React.memo(function Countdown({ target, onExpire }: CountdownProps) {
  const { t } = useTranslation();
  const dRef = useRef<HTMLSpanElement>(null);
  const hRef = useRef<HTMLSpanElement>(null);
  const mRef = useRef<HTMLSpanElement>(null);
  const sRef = useRef<HTMLSpanElement>(null);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  const initial = useRef(getRemaining(target)).current;

  useEffect(() => {
    let id: number | null = null;

    const tick = () => {
      const r = getRemaining(target);
      if (dRef.current) dRef.current.textContent = pad2(r.d);
      if (hRef.current) hRef.current.textContent = pad2(r.h);
      if (mRef.current) mRef.current.textContent = pad2(r.m);
      if (sRef.current) sRef.current.textContent = pad2(r.s);
      if (r.total <= 0) {
        if (id != null) window.clearInterval(id);
        id = null;
        onExpireRef.current();
      }
    };

    const start = () => {
      if (id != null) return;
      tick();
      id = window.setInterval(tick, 1000);
    };

    const stop = () => {
      if (id != null) {
        window.clearInterval(id);
        id = null;
      }
    };

    const onVis = () => {
      if (document.visibilityState === 'hidden') stop();
      else start();
    };

    if (document.visibilityState !== 'hidden') start();
    document.addEventListener('visibilitychange', onVis);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [target]);

  return (
    <div className="flex items-center gap-2 mt-4">
      <TimeBlock valueRef={dRef} initial={initial.d} label={t('soundwaveLock.days')} />
      <Separator />
      <TimeBlock valueRef={hRef} initial={initial.h} label={t('soundwaveLock.hours')} />
      <Separator />
      <TimeBlock valueRef={mRef} initial={initial.m} label={t('soundwaveLock.minutes')} />
      <Separator />
      <TimeBlock valueRef={sRef} initial={initial.s} label={t('soundwaveLock.seconds')} />
    </div>
  );
});

export function isExpired(target: number) {
  return target - Date.now() <= 0;
}
