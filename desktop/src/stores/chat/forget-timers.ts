export interface ForgetTimers<K> {
  schedule(id: K, ms: number | null | undefined): void;
  cancel(id: K): void;
  clear(): void;
}

export function forgetTimers<K>(forget: (id: K) => void): ForgetTimers<K> {
  const timers = new Map<K, ReturnType<typeof setTimeout>>();
  const cancel = (id: K) => {
    const timer = timers.get(id);
    if (timer === undefined) return;
    clearTimeout(timer);
    timers.delete(id);
  };
  return {
    cancel,
    schedule: (id, ms) => {
      cancel(id);
      if (ms == null) return;
      timers.set(
        id,
        setTimeout(() => {
          timers.delete(id);
          forget(id);
        }, ms),
      );
    },
    clear: () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    },
  };
}
