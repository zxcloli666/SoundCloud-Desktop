import { memo, useEffect, useRef } from 'react';
import { usePerfMode } from '../../../lib/perf';
import { paintStill, watchFrames } from './clock';
import { drawScene, type Scene } from './scene';

const MAX_DPR = 2;

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const EffectCanvas = memo(function EffectCanvas({
  scene,
  className,
}: {
  scene: Scene;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const animated = usePerfMode().idleAnim;

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let width = 0;
    let height = 0;

    const paint = (frame: Parameters<typeof drawScene>[3]) => {
      if (width === 0) return;
      drawScene(ctx, width, height, frame, sceneRef.current);
    };
    const resize = () => {
      const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paintStill(paint);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    const stop = animated && !reducedMotion() ? watchFrames(paint) : undefined;
    return () => {
      observer.disconnect();
      stop?.();
    };
  }, [animated]);

  useEffect(() => {
    const canvas = ref.current;
    if (canvas && (!animated || reducedMotion())) {
      const ctx = canvas.getContext('2d');
      if (ctx)
        paintStill((frame) =>
          drawScene(ctx, canvas.clientWidth, canvas.clientHeight, frame, scene),
        );
    }
  }, [scene, animated]);

  return <canvas ref={ref} aria-hidden="true" className={className} />;
});
