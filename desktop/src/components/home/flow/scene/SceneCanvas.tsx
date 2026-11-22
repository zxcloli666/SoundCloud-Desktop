import { useEffect, useRef } from 'react';
import {
  type AmbientMatter,
  createAmbientMatter,
  type SceneColors,
  stillReaction,
} from './ambient-matter';
import { type SceneClock, startSceneLoop } from './scene-loop';

const LONG_SIDE = 420;

export function SceneCanvas({ colors, running }: { colors: SceneColors; running: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<AmbientMatter | null>(null);
  const clockRef = useRef<SceneClock>({ phase: 0 });
  const colorsRef = useRef(colors);
  colorsRef.current = colors;

  useEffect(() => {
    const canvas = canvasRef.current;
    const field = canvas?.parentElement;
    if (!canvas || !field) return;
    const redraw = () => rendererRef.current?.draw(clockRef.current.phase, stillReaction, 0);
    const resize = (width: number, height: number) => {
      if (!width || !height) return;
      const scale = Math.min(1, LONG_SIDE / Math.max(width, height));
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      redraw();
    };
    const create = () => {
      rendererRef.current = createAmbientMatter(canvas);
      rendererRef.current?.setColors(colorsRef.current);
      resize(field.clientWidth, field.clientHeight);
    };
    const lose = (event: Event) => {
      event.preventDefault();
      rendererRef.current = null;
    };
    create();
    const observer = new ResizeObserver(([entry]) => {
      if (entry) resize(entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(field);
    canvas.addEventListener('webglcontextlost', lose);
    canvas.addEventListener('webglcontextrestored', create);
    return () => {
      observer.disconnect();
      canvas.removeEventListener('webglcontextlost', lose);
      canvas.removeEventListener('webglcontextrestored', create);
      rendererRef.current?.destroy();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    rendererRef.current?.setColors(colors);
    rendererRef.current?.draw(clockRef.current.phase, stillReaction, 0);
  }, [colors]);

  useEffect(() => {
    if (!running) return;
    return startSceneLoop(() => rendererRef.current, clockRef.current);
  }, [running]);

  return <canvas ref={canvasRef} className="absolute inset-0 size-full" width={420} height={333} />;
}
