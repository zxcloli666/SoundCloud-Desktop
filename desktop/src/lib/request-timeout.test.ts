import { afterEach, describe, expect, it, vi } from 'vitest';
import { RequestTimeoutError, withTimeout } from './request-timeout';

afterEach(() => {
  vi.useRealTimers();
});

describe('withTimeout', () => {
  it('returns a result that arrives inside the budget', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 100, 'fast request')).resolves.toBe('ok');
  });

  it('rejects stalled work with a typed timeout error', async () => {
    vi.useFakeTimers();
    const result = withTimeout(new Promise<never>(() => {}), 250, 'stalled request');
    const errorPromise = result.catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(250);
    const error = await errorPromise;
    expect(error).toBeInstanceOf(RequestTimeoutError);
    expect(error).toMatchObject({
      name: 'RequestTimeoutError',
      label: 'stalled request',
      timeoutMs: 250,
    });
  });

  it('keeps the original rejection', async () => {
    const failure = new Error('upstream failed');
    await expect(withTimeout(Promise.reject(failure), 100, 'request')).rejects.toBe(failure);
  });

  it('runs best-effort cancellation when the deadline expires', async () => {
    vi.useFakeTimers();
    const onTimeout = vi.fn();
    const result = withTimeout(new Promise<never>(() => {}), 10, 'request', onTimeout);
    const errorPromise = result.catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(10);
    await errorPromise;
    expect(onTimeout).toHaveBeenCalledOnce();
  });
});
