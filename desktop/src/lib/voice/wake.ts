import { useVoiceStore } from './store';

const CONFIRM_MS = 10_000;

let pending: { at: number; timer: ReturnType<typeof setTimeout> } | null = null;

export function wakeHeard() {
  if (pending) clearTimeout(pending.timer);
  const at = Date.now();
  pending = {
    at,
    timer: setTimeout(() => {
      pending = null;
      useVoiceStore.getState().markWake({ at, ok: false });
    }, CONFIRM_MS),
  };
}

export function wakeConfirmed() {
  if (!pending) return;
  clearTimeout(pending.timer);
  useVoiceStore.getState().markWake({ at: pending.at, ok: true });
  pending = null;
}
