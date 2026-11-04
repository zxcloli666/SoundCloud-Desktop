import { useEffect, useState } from 'react';

const PENDING_MS = 5_000;

export function usePending<T>(actual: T): [T, (next: T, run: () => Promise<boolean>) => void] {
  const [pending, setPending] = useState<{ value: T } | null>(null);

  useEffect(() => {
    if (pending && Object.is(pending.value, actual)) setPending(null);
  }, [actual, pending]);

  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => setPending(null), PENDING_MS);
    return () => clearTimeout(timer);
  }, [pending]);

  const change = (next: T, run: () => Promise<boolean>) => {
    setPending({ value: next });
    void run().then((ok) => ok || setPending(null));
  };

  return [pending ? pending.value : actual, change];
}
