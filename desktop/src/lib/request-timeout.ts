export class RequestTimeoutError extends Error {
  constructor(
    readonly label: string,
    readonly timeoutMs: number,
  ) {
    super(`${label} timed out after ${timeoutMs}ms`);
    this.name = 'RequestTimeoutError';
  }
}

/** Bound work that starts after HTTP headers arrive (body decode, IPC, etc.).
 * Fetch-level AbortControllers do not cover those phases consistently in Tauri. */
export function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  label: string,
  onTimeout?: () => void,
): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return operation;

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        onTimeout?.();
      } catch {
        // Timeout remains the primary failure even if best-effort cancellation
        // itself throws synchronously.
      }
      reject(new RequestTimeoutError(label, timeoutMs));
    }, timeoutMs);

    operation.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
