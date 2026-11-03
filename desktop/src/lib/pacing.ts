const RECOVERY_BASE_MS = 2_000;
const RECOVERY_PER_QUERY_MS = 250;
const RECOVERY_MAX_MS = 15_000;
const RETRY_AFTER_SPREAD = 0.5;
const RETRY_MAX_MS = 30_000;

export function recoveryDelayMs(activeQueries: number, random = Math.random): number {
  const spread = Math.min(
    RECOVERY_BASE_MS + activeQueries * RECOVERY_PER_QUERY_MS,
    RECOVERY_MAX_MS,
  );
  return Math.round(random() * spread);
}

export function retryAfterMs(seconds: number, random = Math.random): number {
  return Math.round(seconds * 1000 * (1 + random() * RETRY_AFTER_SPREAD));
}

export function shedSeconds(error: unknown): number | null {
  if (typeof error !== 'object' || error === null) return null;
  const { status, retryAfterSeconds } = error as { status?: unknown; retryAfterSeconds?: unknown };
  return status === 503 && typeof retryAfterSeconds === 'number' ? retryAfterSeconds : null;
}

export function queryRetryDelay(failureCount: number, error: unknown): number {
  const seconds = shedSeconds(error);
  return seconds ? retryAfterMs(seconds) : Math.min(1000 * 2 ** failureCount, RETRY_MAX_MS);
}
