import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useScheme } from '../../../../lib/scheme';
import type { Luminance } from '../presets/types';
import { useMotion } from './gate';
import { fitCanvas, type MotionTarget, paintStill, runMotion, type Tone } from './motion';
import { scrimAlpha } from './scrim';

const CANVAS_SCALE = 0.5;

export interface StageProps {
  src: string;
  light: Luminance;
  motion: Tone | null;
  onFail?: () => void;
}

function useScrimAlpha(light: Luminance) {
  const scheme = useScheme();
  return useMemo(() => scrimAlpha(light, scheme), [light, scheme]);
}

function Scrim({ light }: { light: Luminance }) {
  const alpha = useScrimAlpha(light);
  const top = Math.min(0.96, alpha + 0.1);
  return (
    <>
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, rgb(var(--paper) / ${top}) 0%, rgb(var(--paper) / ${alpha}) 34%, rgb(var(--paper) / ${alpha}) 100%)`,
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(160deg, color-mix(in srgb, var(--room-accent, var(--color-accent)) 16%, transparent), transparent 62%)',
        }}
      />
    </>
  );
}

function Motion({ image, tone }: { image: HTMLImageElement; tone: Tone }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const motion = useMotion(canvas, true);
  const mode = motion.kind;
  const fps = motion.kind === 'live' ? motion.fps : 0;

  useEffect(() => {
    const node = canvas.current;
    if (!node || mode === 'paused') return;
    const target: MotionTarget = { canvas: node, image, tone, scale: CANVAS_SCALE };
    fitCanvas(target);
    if (mode === 'still') paintStill(target);
    const observer = new ResizeObserver(() => {
      if (fitCanvas(target) && mode === 'still') paintStill(target);
    });
    observer.observe(node);
    const stop = mode === 'live' ? runMotion(target, fps) : undefined;
    return () => {
      observer.disconnect();
      stop?.();
    };
  }, [image, tone, mode, fps]);

  return <canvas ref={canvas} className="absolute inset-0 h-full w-full" />;
}

export const BackdropStage = memo(function BackdropStage({
  src,
  light,
  motion,
  onFail,
}: StageProps) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [ready, setReady] = useState(false);

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      style={{ contain: 'strict' }}
    >
      <img
        ref={setImage}
        src={src}
        alt=""
        decoding="async"
        draggable={false}
        onLoad={() => setReady(true)}
        onError={onFail}
        className="absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ease-[var(--ease-apple)] motion-reduce:transition-none"
        style={{
          opacity: ready ? 1 : 0,
          transform: motion ? 'scale(1.07)' : undefined,
          willChange: motion ? 'transform' : undefined,
        }}
      />
      {motion && ready && image && <Motion image={image} tone={motion} />}
      <Scrim light={light} />
    </div>
  );
});
