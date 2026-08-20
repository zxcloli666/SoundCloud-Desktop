export type QueueRepeatMode = 'off' | 'one' | 'all';

/** Resolve an explicit Next action. Repeat-one applies only to natural track
 * completion, so a user pressing Next still advances. */
export function nextQueueIndex(
  queueLength: number,
  currentIndex: number,
  repeat: QueueRepeatMode,
): number | null {
  if (queueLength <= 0) return null;
  const next = Math.max(0, currentIndex + 1);
  if (next < queueLength) return next;
  return repeat === 'all' ? 0 : null;
}

export function previousQueueIndex(queueLength: number, currentIndex: number): number | null {
  if (queueLength <= 0) return null;
  return Math.max(0, Math.min(queueLength - 1, currentIndex - 1));
}
