import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Track } from '../stores/player';

const mocks = vi.hoisted(() => {
  const playerState = {
    appendToQueueAndPlayNext: vi.fn(),
    currentTrack: null as Track | null,
    pause: vi.fn(),
    queue: [] as Track[],
    queueIndex: -1,
    repeat: 'off' as const,
  };
  return {
    curate: vi.fn(),
    fallback: null as ((track: Track, reason?: string) => void) | null,
    fetchRelated: vi.fn(),
    fetchWave: vi.fn(),
    getSource: vi.fn(() => null as { kind: string; next: () => Promise<Track[]> } | null),
    isDisliked: vi.fn(() => false),
    isLiked: vi.fn(() => false),
    markWave: vi.fn(),
    playerState,
    resetHandler: null as (() => void) | null,
    resetWave: vi.fn(),
    setSource: vi.fn(),
    settings: {
      soundwaveHideLiked: true,
      soundwaveHideListened: true,
      soundwaveLanguages: ['ru', 'en'],
      soundwaveMode: 'similar' as const,
    },
    taste: {
      recentTracks: [] as Track[],
      tracks: {} as Record<
        string,
        {
          behaviorScore: number;
          completes: number;
          explicitPreference: 'liked' | 'disliked' | null;
        }
      >,
    },
  };
});

vi.mock('../stores/player', () => ({
  getPlayerQueueRevision: () => 0,
  setEndOfQueueFallback: (fallback: (track: Track, reason?: string) => void) => {
    mocks.fallback = fallback;
  },
  setPlaybackContextResetHandler: (handler: () => void) => {
    mocks.resetHandler = handler;
  },
  usePlayerStore: { getState: () => mocks.playerState },
}));
vi.mock('../stores/recommendation-taste', () => ({
  useRecommendationTasteStore: { getState: () => mocks.taste },
}));
vi.mock('../stores/settings', () => ({
  useSettingsStore: { getState: () => mocks.settings },
}));
vi.mock('./autopilot-wave-session', () => ({
  fetchAutopilotWave: mocks.fetchWave,
  markAutopilotWaveTracks: mocks.markWave,
  resetAutopilotWaveSession: mocks.resetWave,
}));
vi.mock('./dislikes', () => ({ isUrnDisliked: mocks.isDisliked }));
vi.mock('./home-recommendations', () => ({
  isRecommendationTrackPlayable: (track: Track) => track.duration > 0,
}));
vi.mock('./likes', () => ({ isUrnLiked: mocks.isLiked }));
vi.mock('./queue-continuation', () => ({
  getQueueContinuationSource: mocks.getSource,
  setQueueContinuationSource: mocks.setSource,
}));
vi.mock('./queue-recommendations', () => ({
  createQueueRecommendationContext: (tracks: Track[]) => ({
    blockedUrns: new Set(tracks.map((track) => track.urn)),
    recordingKeys: new Set(),
  }),
  curateQueueRecommendations: mocks.curate,
}));
vi.mock('./related', () => ({ fetchRelatedTracks: mocks.fetchRelated }));

import { autopilotContinueFromTrack } from './queue-autopilot';

function track(id: number): Track {
  return {
    id,
    urn: `soundcloud:tracks:${id}`,
    title: `Track ${id}`,
    duration: 180_000,
    artwork_url: null,
    user: {
      id,
      urn: `soundcloud:users:${id}`,
      username: `Artist ${id}`,
      avatar_url: '',
    },
  };
}

describe('queue autopilot', () => {
  beforeEach(() => {
    mocks.resetHandler?.();
    vi.clearAllMocks();
    const current = track(1);
    mocks.playerState.currentTrack = current;
    mocks.playerState.queue = [current];
    mocks.playerState.queueIndex = 0;
    mocks.playerState.repeat = 'off';
    mocks.getSource.mockReturnValue(null);
    mocks.isDisliked.mockReturnValue(false);
    mocks.isLiked.mockReturnValue(false);
    mocks.taste.recentTracks = [];
    mocks.taste.tracks = {};
  });

  it('curates SmartWave candidates with all player recommendation settings', async () => {
    const candidate = track(2);
    mocks.fetchWave.mockResolvedValue([candidate]);
    mocks.curate.mockReturnValue([candidate]);

    await autopilotContinueFromTrack(mocks.playerState.currentTrack!, 'ended');

    expect(mocks.fetchWave).toHaveBeenCalledWith(
      { kind: 'track', id: '1' },
      expect.objectContaining({
        hideListened: true,
        languages: ['en', 'ru'],
        limit: 40,
      }),
    );
    expect(mocks.curate).toHaveBeenCalledWith(
      [candidate],
      mocks.playerState.queue,
      expect.objectContaining({ hideLiked: true, mode: 'similar', limit: 20 }),
      expect.objectContaining({ blockedUrns: expect.any(Set), recordingKeys: expect.any(Set) }),
    );
    expect(mocks.playerState.appendToQueueAndPlayNext).toHaveBeenCalledWith([candidate]);
    expect(mocks.markWave).toHaveBeenCalledWith([candidate.urn]);
  });

  it('falls back to related when the wave has no eligible candidates', async () => {
    const rejected = track(2);
    const related = track(3);
    mocks.fetchWave.mockResolvedValue([rejected]);
    mocks.curate.mockReturnValueOnce([]).mockReturnValueOnce([related]);
    mocks.fetchRelated.mockResolvedValue({ collection: [related] });

    await autopilotContinueFromTrack(mocks.playerState.currentTrack!, 'ended');

    expect(mocks.fetchRelated).toHaveBeenCalledWith(
      mocks.playerState.currentTrack!.urn,
      40,
      0,
      expect.any(AbortSignal),
    );
    expect(mocks.playerState.appendToQueueAndPlayNext).toHaveBeenCalledWith([related]);
    expect(mocks.markWave).not.toHaveBeenCalled();
  });

  it('drops a stale response instead of contaminating a newly selected queue', async () => {
    const candidate = track(2);
    let resolveWave!: (tracks: Track[]) => void;
    mocks.fetchWave.mockReturnValue(
      new Promise<Track[]>((resolve) => {
        resolveWave = resolve;
      }),
    );
    mocks.curate.mockReturnValue([candidate]);

    const refill = autopilotContinueFromTrack(mocks.playerState.currentTrack!, 'ended');
    const replacement = track(50);
    mocks.playerState.currentTrack = replacement;
    mocks.playerState.queue = [replacement];
    mocks.playerState.queueIndex = 0;
    resolveWave([candidate]);
    await refill;

    expect(mocks.playerState.appendToQueueAndPlayNext).not.toHaveBeenCalled();
    expect(mocks.playerState.pause).not.toHaveBeenCalled();
  });

  it('coalesces duplicate end-of-queue refills', async () => {
    const candidate = track(2);
    let resolveWave!: (tracks: Track[]) => void;
    mocks.fetchWave.mockReturnValue(
      new Promise<Track[]>((resolve) => {
        resolveWave = resolve;
      }),
    );
    mocks.curate.mockReturnValue([candidate]);

    const first = autopilotContinueFromTrack(mocks.playerState.currentTrack!, 'ended');
    const duplicate = autopilotContinueFromTrack(mocks.playerState.currentTrack!, 'ended');
    await duplicate;
    await Promise.resolve();
    resolveWave([candidate]);
    await first;

    expect(mocks.fetchWave).toHaveBeenCalledOnce();
    expect(mocks.playerState.appendToQueueAndPlayNext).toHaveBeenCalledOnce();
  });

  it('continues the active queue source before switching to recommendations', async () => {
    const nextPage = [track(2), track(3)];
    const source = { kind: 'playlist', next: vi.fn().mockResolvedValue(nextPage) };
    mocks.getSource.mockReturnValue(source);

    await autopilotContinueFromTrack(mocks.playerState.currentTrack!, 'ended');

    expect(source.next).toHaveBeenCalledOnce();
    expect(mocks.playerState.appendToQueueAndPlayNext).toHaveBeenCalledWith(nextPage);
    expect(mocks.fetchWave).not.toHaveBeenCalled();
  });

  it('uses the user taste wave after a manual skip instead of the rejected track', async () => {
    const candidate = track(2);
    mocks.fetchWave.mockResolvedValue([candidate]);
    mocks.curate.mockReturnValue([candidate]);

    await autopilotContinueFromTrack(mocks.playerState.currentTrack!, 'manual');

    expect(mocks.fetchWave).toHaveBeenCalledWith(
      { kind: 'user' },
      expect.objectContaining({ limit: 40 }),
    );
  });

  it('does not use a manually rejected track for the related fallback', async () => {
    const rejected = track(2);
    mocks.fetchWave.mockResolvedValue([rejected]);
    mocks.curate.mockReturnValue([]);

    await autopilotContinueFromTrack(mocks.playerState.currentTrack!, 'dislike');

    expect(mocks.fetchRelated).not.toHaveBeenCalled();
    expect(mocks.playerState.appendToQueueAndPlayNext).not.toHaveBeenCalled();
    expect(mocks.playerState.pause).toHaveBeenCalledOnce();
  });
});
