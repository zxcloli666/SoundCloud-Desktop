import { useEffect, useRef, useState } from 'react';
import { presetOf } from '../presets';
import type { ChoiceKey } from './choices';
import type { Focus } from './PickerPreview';

const PENDING_MS = 8_000;

export function initialFocus(key: ChoiceKey, imageSrc: string | null): Focus {
  const preset = presetOf(key);
  if (preset) return { kind: 'preset', preset };
  return key === 'photo' ? { kind: 'photo', src: imageSrc } : { kind: 'none' };
}

export function usePending(current: ChoiceKey) {
  const [pending, setPending] = useState<ChoiceKey | null>(null);
  const shown = useRef(current);

  useEffect(() => {
    if (shown.current === current) return;
    shown.current = current;
    setPending(null);
  }, [current]);

  useEffect(() => {
    if (pending === null) return;
    const timer = setTimeout(() => setPending(null), PENDING_MS);
    return () => clearTimeout(timer);
  }, [pending]);

  return [pending, setPending] as const;
}
