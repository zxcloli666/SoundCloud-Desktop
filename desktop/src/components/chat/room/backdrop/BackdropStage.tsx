import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { BlurImage } from '../../media/BlurImage';
import type { Luminance } from '../presets/types';
import { useMotion } from './gate';
import { measureImage } from './luminance';
import { fitCanvas, type MotionTarget, paintStill, runMotion, type Tone } from './motion';
import { scrimAlpha, UNKNOWN_LIGHT } from './scrim';
import { useSchemeTokens } from './tokens';

const CANVAS_SCALE = 0.5;
const FADE_MS = 500;

export interface StageProps {
  src: string;
  placeholder?: string;
  light?: Luminance;
  motion: Tone | null;
  held?: boolean;
  onFail?: () => void;
}

function Scrim({ light }: { light: Luminance }) {
  const tokens = useSchemeTokens();
  const alpha = useMemo(() => scrimAlpha(light, tokens), [light, tokens]);
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

function Motion({ image, tone, held }: { image: HTMLImageElement; tone: Tone; held: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const motion = useMotion(canvas, held);
  const mode = motion.kind;
  const fps = motion.kind === 'live' ? motion.fps : 0;

  useEffect(() => {
    const node = canvas.current;
    if (!node || mode === 'paused') return;
    const target: MotionTarget = { canvas: node, image, tone, scale: CANVAS_SCALE, pattern: null };
    fitCanvas(target);
    if (mode === 'still') paintStill(target);
    const observer = new ResizeObserver(() => {
      if (fitCanvas(target) && mode === 'still') paintStill(target);
    });
    observer.observe(node);
    const stop = mode === 'live' ? runMotion(target, fps) : undefined;
    if (mode === 'live') image.style.willChange = 'transform';
    return () => {
      observer.disconnect();
      stop?.();
      image.style.willChange = '';
    };
  }, [image, tone, mode, fps]);

  return <canvas ref={canvas} className="absolute inset-0 h-full w-full" />;
}

export const BackdropStage = memo(function BackdropStage({
  src,
  placeholder,
  light,
  motion,
  held = false,
  onFail,
}: StageProps) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [ready, setReady] = useState(false);
  const [measured, setMeasured] = useState<Luminance>(UNKNOWN_LIGHT);
  const measuring = light === undefined;

  const loaded = (node: HTMLImageElement) => {
    if (measuring) setMeasured(measureImage(node));
    setReady(true);
  };

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      style={{ contain: 'strict' }}
    >
      {placeholder && <BlurImage src={placeholder} covered={ready} holdMs={FADE_MS} />}
      <img
        ref={setImage}
        src={src}
        alt=""
        crossOrigin={measuring ? 'anonymous' : undefined}
        decoding="async"
        draggable={false}
        onLoad={(event) => loaded(event.currentTarget)}
        onError={onFail}
        className="absolute inset-0 h-full w-full object-cover transition-opacity ease-[var(--ease-apple)] motion-reduce:transition-none"
        style={{
          opacity: ready ? 1 : 0,
          transform: motion ? 'scale(1.07)' : undefined,
          transitionDuration: `${FADE_MS}ms`,
        }}
      />
      {motion && ready && image && <Motion image={image} tone={motion} held={held} />}
      <Scrim light={light ?? measured} />
    </div>
  );
});
