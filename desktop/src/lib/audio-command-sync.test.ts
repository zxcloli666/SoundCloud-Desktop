import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAudioCommandSync } from './audio-command-sync';

afterEach(() => {
  vi.useRealTimers();
});

describe('createAudioCommandSync', () => {
  it('coalesces rapid changes and reads only the latest value', async () => {
    vi.useFakeTimers();
    let value = 10;
    const send = vi.fn(async () => {});
    const sync = createAudioCommandSync({ delayMs: 40, read: () => value, send });

    sync.schedule();
    value = 20;
    sync.schedule();
    value = 30;
    await vi.advanceTimersByTimeAsync(40);

    expect(send).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith(30);
  });

  it('does not resend an unchanged value', async () => {
    vi.useFakeTimers();
    const send = vi.fn(async () => {});
    const sync = createAudioCommandSync({ delayMs: 10, read: () => 1, send });

    await sync.syncNow();
    sync.schedule();
    await vi.advanceTimersByTimeAsync(10);

    expect(send).toHaveBeenCalledOnce();
  });

  it('flushes immediately and cancels a scheduled duplicate', async () => {
    vi.useFakeTimers();
    const send = vi.fn(async () => {});
    const sync = createAudioCommandSync({ delayMs: 25, read: () => 2, send });

    sync.schedule();
    await sync.syncNow();
    await vi.advanceTimersByTimeAsync(25);

    expect(send).toHaveBeenCalledOnce();
  });

  it('retries a latest command that failed', async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(new Error('ipc failed'))
      .mockResolvedValue(undefined);
    const sync = createAudioCommandSync({ delayMs: 10, read: () => 3, send });

    await sync.syncNow();
    await sync.syncNow();

    expect(send).toHaveBeenCalledTimes(2);
  });

  it('serializes in-flight writes and applies only the newest queued value', async () => {
    let value = 1;
    let releaseFirst!: () => void;
    const send = vi.fn((sent: number) => {
      if (sent !== 1) return Promise.resolve();
      return new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
    });
    const sync = createAudioCommandSync({ delayMs: 0, read: () => value, send });

    const first = sync.syncNow();
    await Promise.resolve();
    expect(send).toHaveBeenCalledWith(1);

    value = 2;
    const second = sync.syncNow();
    value = 3;
    const third = sync.syncNow();
    expect(send).toHaveBeenCalledTimes(1);

    releaseFirst();
    await Promise.all([first, second, third]);

    expect(send.mock.calls.map(([sent]) => sent)).toEqual([1, 3]);
  });
});
