import { useEffect, useMemo, useRef, useState } from 'react';

const SETTLE_MS = 1200;
const INTERACTIONS = ['pointerdown', 'wheel', 'scroll', 'keydown'] as const;

export function useStableOrder<T>(items: T[], keyOf: (item: T) => string, resetKey: string): T[] {
  const [lockedKey, setLockedKey] = useState<string | null>(null);
  const shownRef = useRef<{ key: string; list: T[] }>({ key: resetKey, list: [] });
  const locked = lockedKey === resetKey;
  const hasItems = items.length > 0;

  useEffect(() => {
    if (locked || !hasItems) return;
    const lock = () => setLockedKey(resetKey);
    const timer = window.setTimeout(lock, SETTLE_MS);
    for (const type of INTERACTIONS) {
      window.addEventListener(type, lock, { capture: true, passive: true });
    }
    return () => {
      window.clearTimeout(timer);
      for (const type of INTERACTIONS) window.removeEventListener(type, lock, { capture: true });
    };
  }, [locked, hasItems, resetKey]);

  const list = useMemo(() => {
    const shown = shownRef.current;
    if (!locked || shown.key !== resetKey) return items;
    const latest = new Map(items.map((item) => [keyOf(item), item]));
    const kept = shown.list.map((item) => latest.get(keyOf(item)) ?? item);
    const seen = new Set(kept.map(keyOf));
    return [...kept, ...items.filter((item) => !seen.has(keyOf(item)))];
  }, [items, keyOf, locked, resetKey]);

  useEffect(() => {
    shownRef.current = { key: resetKey, list };
  }, [resetKey, list]);

  return list;
}
