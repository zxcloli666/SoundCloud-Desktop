import { Cloud, CloudOff, Loader2, RefreshCw } from 'lucide-react';
import { memo, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePerfMode } from '../../lib/perf';
import type { WallLive } from './useSearchWall';

const ADDED_VISIBLE_MS = 3000;
const WAIT_FALLBACK_SEC = 10;

interface LiveStatusProps {
  live: WallLive;
  onRetry: () => void;
}

function useCountdown(seconds: number, onDone: () => void): number {
  const [left, setLeft] = useState(seconds);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    setLeft(seconds);
    if (seconds <= 0) return;
    const started = Date.now();
    const timer = window.setInterval(() => {
      const next = Math.max(0, seconds - Math.floor((Date.now() - started) / 1000));
      setLeft(next);
      if (next > 0) return;
      window.clearInterval(timer);
      doneRef.current();
    }, 1000);
    return () => window.clearInterval(timer);
  }, [seconds]);
  return left;
}

function useFlash(count: number): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setVisible(count > 0);
    if (count <= 0) return;
    const timer = window.setTimeout(() => setVisible(false), ADDED_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [count]);
  return visible;
}

export const LiveStatus = memo(function LiveStatus({ live, onRetry }: LiveStatusProps) {
  const { t } = useTranslation();
  const perf = usePerfMode();
  const autoRetried = useRef(false);
  const waiting = live.state === 'limited' || live.state === 'busy';
  const fresh = live.state === 'fresh' || live.state === 'stale';
  const left = useCountdown(waiting ? (live.retryAfter ?? WAIT_FALLBACK_SEC) : 0, () => {
    if (autoRetried.current) return;
    autoRetried.current = true;
    onRetry();
  });
  const addedVisible = useFlash(fresh ? live.added : 0);

  let icon: React.ReactNode = <CloudOff size={13} />;
  let label: string | null = null;
  let retry = false;
  if (live.state === 'searching') {
    icon = <Loader2 size={13} className="animate-spin" />;
    label = t('search.live.searching');
  } else if (fresh && live.added > 0) {
    icon = <Cloud size={13} />;
    label = t('search.live.added', { count: live.added });
  } else if (waiting) {
    label = left > 0 ? t('search.live.limited', { seconds: left }) : t('search.live.unavailable');
    retry = left === 0;
  } else if (live.state === 'unavailable' || live.state === 'timeout') {
    label = t('search.live.unavailable');
    retry = true;
  } else if (live.state === 'paused' || live.state === 'cooling') {
    label = t('search.live.paused');
  }
  if (!label) return null;

  const b = perf.blur(24);
  const hidden = fresh && !addedVisible;
  return (
    <div
      aria-live="polite"
      className="inline-flex items-center gap-1.5 h-8 pl-2.5 pr-1 rounded-full text-[12px] text-white/70 transition-opacity duration-700"
      style={{
        opacity: hidden ? 0 : 1,
        pointerEvents: hidden ? 'none' : undefined,
        background: b > 0 ? 'rgba(255,255,255,0.05)' : 'rgba(28,28,34,0.9)',
        border: '0.5px solid rgba(255,255,255,0.1)',
        backdropFilter: b > 0 ? `blur(${b}px) saturate(160%)` : undefined,
        WebkitBackdropFilter: b > 0 ? `blur(${b}px) saturate(160%)` : undefined,
      }}
    >
      <span className="text-accent/80">{icon}</span>
      <span className="pr-1.5">{label}</span>
      {retry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1 h-6 px-2 rounded-full text-[11px] text-white/85 cursor-pointer transition-colors hover:bg-white/[0.08]"
          style={{ border: '0.5px solid rgba(255,255,255,0.14)' }}
        >
          <RefreshCw size={11} />
          {t('search.live.retry')}
        </button>
      )}
    </div>
  );
});
