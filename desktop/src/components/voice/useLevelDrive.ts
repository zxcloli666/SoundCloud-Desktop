import { type RefObject, useEffect } from 'react';
import { onLevel } from '../../lib/voice/levels';

const DECAY_MS = 140;

export function shapeLevel(rms: number): number {
  return Math.min(1, Math.sqrt(Math.max(0, rms)) * 1.25);
}

export function useLevelDrive(
  ref: RefObject<HTMLElement | null>,
  input: string | null,
  enabled = true,
) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    let level = 0;
    let decay: ReturnType<typeof setTimeout> | null = null;
    const write = (value: number) => {
      level = value;
      el.style.setProperty('--lvl', value.toFixed(3));
    };
    const off = onLevel((from, rms) => {
      if (input && from !== input) return;
      const target = shapeLevel(rms);
      write(target > level ? level + (target - level) * 0.65 : level * 0.55 + target * 0.45);
      if (decay) clearTimeout(decay);
      decay = setTimeout(() => write(0), DECAY_MS);
    });
    return () => {
      off();
      if (decay) clearTimeout(decay);
      el.style.setProperty('--lvl', '0');
    };
  }, [ref, input, enabled]);
}
