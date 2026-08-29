export interface AudioCommandSync {
  cancel: () => void;
  schedule: () => void;
  syncNow: () => Promise<void>;
}

interface AudioCommandSyncOptions<T> {
  delayMs: number;
  equals?: (left: T, right: T) => boolean;
  onError?: (error: unknown) => void;
  read: () => T;
  send: (value: T) => Promise<unknown>;
}

/**
 * Coalesces rapid controls (volume/rate/EQ) and remembers the last command issued.
 * A failed latest command is invalidated so the next change/load can retry it.
 */
export function createAudioCommandSync<T>({
  delayMs,
  equals = Object.is,
  onError,
  read,
  send,
}: AudioCommandSyncOptions<T>): AudioCommandSync {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let hasLastValue = false;
  let lastValue: T;
  let lastCommand = Promise.resolve();

  const dispatch = (): Promise<void> => {
    // Keep commands for the same control ordered. Tauri invocations can finish on
    // different worker threads; serialising here guarantees an older volume/rate
    // write can never land after the newest one. Reading inside the chain also
    // collapses values that changed while the previous command was in flight.
    lastCommand = lastCommand.then(async () => {
      const value = read();
      if (hasLastValue && equals(lastValue, value)) return;

      hasLastValue = true;
      lastValue = value;
      try {
        await send(value);
      } catch (error) {
        hasLastValue = false;
        onError?.(error);
      }
    });
    return lastCommand;
  };

  return {
    cancel() {
      if (timer) clearTimeout(timer);
      timer = null;
    },
    schedule() {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        void dispatch();
      }, delayMs);
    },
    syncNow() {
      if (timer) clearTimeout(timer);
      timer = null;
      return dispatch();
    },
  };
}
