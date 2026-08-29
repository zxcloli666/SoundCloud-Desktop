import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchWave: vi.fn(),
  listener: null as
    | ((outcome: { eventType: string; scTrackId: string; positionPct?: number }) => void)
    | null,
  sendFeedback: vi.fn(),
}));

vi.mock('./events', () => ({
  subscribeSoundWaveOutcomes: (
    listener: (outcome: { eventType: string; scTrackId: string; positionPct?: number }) => void,
  ) => {
    mocks.listener = listener;
    return () => {};
  },
}));
vi.mock('./soundwave', () => ({
  fetchSmartWave: mocks.fetchWave,
  sendWaveFeedback: mocks.sendFeedback,
}));

import {
  fetchAutopilotWave,
  markAutopilotWaveTracks,
  resetAutopilotWaveSession,
} from './autopilot-wave-session';

function options() {
  return {
    hideListened: true,
    languages: ['en'],
    limit: 40,
    signal: new AbortController().signal,
  };
}

describe('autopilot wave session', () => {
  beforeEach(() => {
    resetAutopilotWaveSession();
    mocks.fetchWave.mockReset();
    mocks.sendFeedback.mockReset();
  });

  it('keeps the original seed and cursor across queue refills', async () => {
    mocks.fetchWave
      .mockResolvedValueOnce({ tracks: [{ urn: 'soundcloud:tracks:10' }], cursor: 'cursor-1' })
      .mockResolvedValueOnce({ tracks: [{ urn: 'soundcloud:tracks:11' }], cursor: 'cursor-3' });
    mocks.sendFeedback.mockResolvedValue('cursor-2');

    await fetchAutopilotWave({ kind: 'track', id: '1' }, options());
    markAutopilotWaveTracks(['soundcloud:tracks:10']);
    mocks.listener?.({ eventType: 'full_play', scTrackId: 'soundcloud:tracks:10' });
    mocks.listener?.({ eventType: 'skip', scTrackId: 'soundcloud:tracks:10' });
    await fetchAutopilotWave({ kind: 'track', id: '999' }, options());

    expect(mocks.sendFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: 'cursor-1', positives: 1, negatives: 1 }),
    );
    expect(mocks.fetchWave).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        seedKind: 'track',
        seedId: '1',
        cursor: 'cursor-2',
      }),
    );
  });

  it('uses a new seed after an explicit playback reset', async () => {
    mocks.fetchWave
      .mockResolvedValueOnce({ tracks: [{ urn: 'soundcloud:tracks:10' }], cursor: 'cursor-1' })
      .mockResolvedValueOnce({ tracks: [{ urn: 'soundcloud:tracks:20' }], cursor: 'cursor-2' });

    await fetchAutopilotWave({ kind: 'track', id: '1' }, options());
    resetAutopilotWaveSession();
    await fetchAutopilotWave({ kind: 'track', id: '2' }, options());

    expect(mocks.fetchWave).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ seedKind: 'track', seedId: '2', cursor: undefined }),
    );
    expect(mocks.sendFeedback).not.toHaveBeenCalled();
  });

  it('keeps outcomes that arrive while feedback is in flight', async () => {
    mocks.fetchWave
      .mockResolvedValueOnce({ tracks: [{ urn: 'soundcloud:tracks:10' }], cursor: 'cursor-1' })
      .mockResolvedValueOnce({ tracks: [{ urn: 'soundcloud:tracks:11' }], cursor: 'cursor-3' })
      .mockResolvedValueOnce({ tracks: [{ urn: 'soundcloud:tracks:12' }], cursor: 'cursor-5' });
    let resolveFeedback!: (cursor: string) => void;
    mocks.sendFeedback
      .mockReturnValueOnce(
        new Promise<string>((resolve) => {
          resolveFeedback = resolve;
        }),
      )
      .mockResolvedValueOnce('cursor-4');

    await fetchAutopilotWave({ kind: 'track', id: '1' }, options());
    markAutopilotWaveTracks(['soundcloud:tracks:10']);
    mocks.listener?.({ eventType: 'full_play', scTrackId: 'soundcloud:tracks:10' });

    const refill = fetchAutopilotWave({ kind: 'track', id: '1' }, options());
    await vi.waitFor(() => expect(mocks.sendFeedback).toHaveBeenCalledOnce());
    mocks.listener?.({ eventType: 'skip', scTrackId: 'soundcloud:tracks:10' });
    resolveFeedback('cursor-2');
    await refill;
    await fetchAutopilotWave({ kind: 'track', id: '1' }, options());

    expect(mocks.sendFeedback).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ positives: 1, negatives: 0 }),
    );
    expect(mocks.sendFeedback).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ cursor: 'cursor-3', positives: 0, negatives: 1 }),
    );
  });
});
