import { type CSSProperties, type ReactNode, useLayoutEffect, useRef, useState } from 'react';
import { useReducedMotion } from '../../lib/reduced-motion';

interface Props {
  children: ReactNode;
  label: string;
  className?: string;
  durationSec?: number;
  delaySec?: number;
  gapPx?: number;
  hold?: boolean;
}

function useOverflow() {
  const rootRef = useRef<HTMLSpanElement>(null);
  const copyRef = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(false);
  useLayoutEffect(() => {
    const root = rootRef.current;
    const copy = copyRef.current;
    if (!root || !copy) return;
    const measure = () => setOverflow(copy.scrollWidth > root.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    observer.observe(copy);
    return () => observer.disconnect();
  }, []);
  return { rootRef, copyRef, overflow };
}

export function Marquee({
  children,
  label,
  className = '',
  durationSec = 8,
  delaySec = 0,
  gapPx = 32,
  hold = false,
}: Props) {
  const { rootRef, copyRef, overflow } = useOverflow();
  const reduced = useReducedMotion();
  const moving = overflow && !reduced;
  const style = {
    '--marquee-gap': `${gapPx}px`,
    '--marquee-duration': `${durationSec}s`,
    '--marquee-delay': `${delaySec}s`,
  } as CSSProperties;

  return (
    <span
      ref={rootRef}
      data-ui="marquee"
      data-overflow={overflow}
      data-moving={moving}
      title={overflow && !moving ? label : undefined}
      className={`block min-w-0 max-w-full overflow-hidden whitespace-nowrap ${className}`}
    >
      <span
        data-running={moving}
        data-hold={hold}
        style={style}
        className={moving ? 'marquee-track' : 'block'}
      >
        <span
          ref={copyRef}
          className={
            moving
              ? 'shrink-0'
              : 'inline-block max-w-full overflow-hidden text-ellipsis align-bottom'
          }
        >
          {children}
        </span>
        {moving && (
          <span aria-hidden inert className="shrink-0">
            {children}
          </span>
        )}
      </span>
    </span>
  );
}
