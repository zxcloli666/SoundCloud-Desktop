import { getCurrentWebview } from '@tauri-apps/api/webview';
import { type RefObject, useEffect, useRef, useState } from 'react';

const mounted = new Set<symbol>();

export const LAB_DRAG = 'chat-lab-drag';

export interface DropHover {
  images: number;
  other: number;
}

function inside(area: HTMLElement | null, x: number, y: number): boolean {
  if (!area) return false;
  if (mounted.size === 1) return true;
  const rect = area.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const left = x / ratio;
  const top = y / ratio;
  return left >= rect.left && left <= rect.right && top >= rect.top && top <= rect.bottom;
}

export function useImageDrop(
  area: RefObject<HTMLElement | null>,
  isImage: (path: string) => boolean,
  onDrop: (paths: string[]) => void,
): DropHover | null {
  const [hover, setHover] = useState<DropHover | null>(null);
  const paths = useRef<string[]>([]);
  const dropped = useRef(onDrop);
  dropped.current = onDrop;

  useEffect(() => {
    const id = Symbol('thread-drop');
    mounted.add(id);
    let disposed = false;
    let unlisten: (() => void) | null = null;
    const show = (x: number, y: number) => {
      if (!inside(area.current, x, y) || paths.current.length === 0) {
        setHover(null);
        return;
      }
      const images = paths.current.filter(isImage).length;
      setHover((current) =>
        current && current.images === images
          ? current
          : { images, other: paths.current.length - images },
      );
    };
    void getCurrentWebview()
      .onDragDropEvent(({ payload }) => {
        if (payload.type === 'enter') {
          paths.current = payload.paths;
          show(payload.position.x, payload.position.y);
        } else if (payload.type === 'over') {
          show(payload.position.x, payload.position.y);
        } else if (payload.type === 'leave') {
          paths.current = [];
          setHover(null);
        } else if (payload.type === 'drop') {
          const hit = inside(area.current, payload.position.x, payload.position.y);
          paths.current = [];
          setHover(null);
          if (hit && payload.paths.length > 0) dropped.current(payload.paths);
        }
      })
      .then((stop) => {
        if (disposed) stop();
        else unlisten = stop;
      })
      .catch(() => undefined);
    const rehearse = (event: Event) => {
      const detail = (event as CustomEvent<{ paths: string[] | null }>).detail;
      paths.current = detail.paths ?? [];
      const rect = area.current?.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      if (detail.paths && rect)
        show((rect.left + rect.width / 2) * ratio, (rect.top + rect.height / 2) * ratio);
      else setHover(null);
    };
    if (import.meta.env.DEV) window.addEventListener(LAB_DRAG, rehearse);
    return () => {
      disposed = true;
      mounted.delete(id);
      unlisten?.();
      if (import.meta.env.DEV) window.removeEventListener(LAB_DRAG, rehearse);
    };
  }, [area, isImage]);

  return hover;
}
