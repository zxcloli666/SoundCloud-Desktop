import { type RefObject, useEffect, useState } from 'react';
import { useAppIdle, usePerfMode } from '../../../../lib/perf';
import { useReducedMotion } from '../../../../lib/reduced-motion';
import { useSettingsStore } from '../../../../stores/settings';

const SCROLL_SETTLE_MS = 110;

function useScrolling(ref: RefObject<HTMLElement | null>): boolean {
  const [scrolling, setScrolling] = useState(false);
  useEffect(() => {
    const root = ref.current?.closest<HTMLElement>('[data-ui="main"]');
    if (!root) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      setScrolling(true);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setScrolling(false), SCROLL_SETTLE_MS);
    };
    root.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      root.removeEventListener('scroll', onScroll);
      if (timer) clearTimeout(timer);
    };
  }, [ref]);
  return scrolling;
}

export function useSceneMotion(ref: RefObject<HTMLElement | null>, playing: boolean) {
  const enabled = useSettingsStore((s) => s.liveBackground);
  const perf = usePerfMode();
  const reduced = useReducedMotion();
  const idle = useAppIdle();
  const scrolling = useScrolling(ref);
  return {
    live: enabled && perf.mode !== 'light' && !reduced,
    running: playing && !idle && !scrolling,
  };
}
