import { memo, useEffect, useRef } from 'react';
import { usePerfMode } from '../../lib/perf';
import { useReducedMotion } from '../../lib/reduced-motion';
import { watchFrames } from '../music/effects/clock';

const BARS = 40;
const GAP = 2;
const MAX_DPR = 2;
const REACH = 0.82;

export const EqSpectrum = memo(function EqSpectrum({ className }: { className: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const animated = usePerfMode().idleAnim;
  const still = useReducedMotion();

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !animated || still) return;
    const heights = new Float32Array(BARS);
    const fit = () => {
      const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const observer = new ResizeObserver(fit);
    observer.observe(canvas);
    const stop = watchFrames(({ bins, ink }) => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const step = w / BARS;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = `rgba(${ink},0.09)`;
      for (let i = 0; i < BARS; i++) {
        const level = bins[Math.floor((i / BARS) * bins.length)] ?? 0;
        heights[i] += (Math.min(1, level) - heights[i]) * 0.3;
        const tall = Math.max(1, heights[i] * h * REACH);
        ctx.fillRect(i * step + GAP / 2, h - tall, step - GAP, tall);
      }
    });
    return () => {
      observer.disconnect();
      stop();
    };
  }, [animated, still]);

  return <canvas ref={ref} aria-hidden className={className} />;
});
