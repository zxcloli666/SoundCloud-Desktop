import { memo, useEffect, useRef } from 'react';
import { onLevel, SPEECH } from '../../lib/voice/levels';
import { shapeLevel } from './useLevelDrive';

const BAR = 3;
const GAP = 2;

function accentColor(): string {
  return (
    getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim() ||
    '#ff5500'
  );
}

export const Waveform = memo(function Waveform({
  width,
  height,
  input = null,
}: {
  width: number;
  height: number;
  input?: string | null;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.scale(dpr, dpr);
    const count = Math.floor(width / (BAR + GAP));
    const bars = new Float32Array(count);
    const color = accentColor();
    let last = 0;

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = color;
      const mid = height / 2;
      for (let i = 0; i < count; i++) {
        const value = bars[i];
        const h = Math.max(2, value * (height - 2));
        ctx.globalAlpha = 0.25 + 0.75 * (i / count);
        const x = i * (BAR + GAP);
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, mid - h / 2, BAR, h, BAR / 2);
        else ctx.rect(x, mid - h / 2, BAR, h);
        ctx.fill();
      }
    };

    const push = (value: number) => {
      bars.copyWithin(0, 1);
      bars[count - 1] = value;
      draw();
    };

    draw();
    const off = onLevel((from, rms) => {
      if (input ? from !== input : from === SPEECH) return;
      const now = performance.now();
      if (now - last < 28) return;
      last = now;
      push(shapeLevel(rms));
    });
    const idle = setInterval(() => {
      if (performance.now() - last > 200) push(0);
    }, 100);
    return () => {
      off();
      clearInterval(idle);
    };
  }, [width, height, input]);

  return <canvas ref={ref} aria-hidden style={{ width, height }} className="block" />;
});
