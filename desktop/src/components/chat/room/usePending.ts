import { useEffect, useState } from 'react';

const PENDING_MS = 5_000;

export function usePending<T>(
  actual: T,
  same: (a: T, b: T) => boolean = Object.is,
): [T, (next: T, run: () => Promise<boolean>) => void, boolean] {
  const [pending, setPending] = useState<{ value: T } | null>(null);

  useEffect(() => {
    if (pending && same(pending.value, actual)) setPending(null);
  }, [actual, pending, same]);

  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => setPending(null), PENDING_MS);
    return () => clearTimeout(timer);
  }, [pending]);

  const change = (next: T, run: () => Promise<boolean>) => {
    setPending({ value: next });
    void run().then((ok) => ok || setPending(null));
  };

  return [pending ? pending.value : actual, change, pending !== null];
}
