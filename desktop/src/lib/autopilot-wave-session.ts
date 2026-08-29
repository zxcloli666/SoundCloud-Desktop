import { subscribeSoundWaveOutcomes } from './events';
import { fetchSmartWave, sendWaveFeedback } from './soundwave';

export type AutopilotWaveSeed = { kind: 'track'; id: string } | { kind: 'user'; id?: undefined };

interface WaveSessionState {
  seed: AutopilotWaveSeed;
  cursor: string;
  ownedUrns: Set<string>;
  positives: number;
  negatives: number;
}

const OWNED_URN_CAP = 500;
let session: WaveSessionState | null = null;

function createSession(seed: AutopilotWaveSeed): WaveSessionState {
  return {
    seed,
    cursor: '',
    ownedUrns: new Set(),
    positives: 0,
    negatives: 0,
  };
}

subscribeSoundWaveOutcomes((outcome) => {
  const current = session;
  if (!current?.ownedUrns.has(outcome.scTrackId)) return;
  if (
    outcome.eventType === 'full_play' ||
    outcome.eventType === 'like' ||
    outcome.eventType === 'local_like' ||
    outcome.eventType === 'playlist_add'
  ) {
    current.positives += 1;
  } else if (outcome.eventType === 'skip' || outcome.eventType === 'dislike') {
    current.negatives += 1;
  }
});

/** Keep one cursor/seed for the whole autoplay run instead of random-walking from every 20th track. */
export async function fetchAutopilotWave(
  seed: AutopilotWaveSeed,
  options: {
    hideListened: boolean;
    languages: string[];
    limit: number;
    signal: AbortSignal;
  },
) {
  const current = session ?? createSession(seed);
  session = current;

  if (current.cursor && (current.positives > 0 || current.negatives > 0)) {
    // Outcomes can arrive while feedback is in flight. Subtract only the
    // submitted snapshot so newer signals stay queued for the next refill.
    const positives = current.positives;
    const negatives = current.negatives;
    const cursor = await sendWaveFeedback({
      cursor: current.cursor,
      negatives,
      positives,
      signal: options.signal,
    });
    if (options.signal.aborted || session !== current) return [];
    current.negatives = Math.max(0, current.negatives - negatives);
    current.positives = Math.max(0, current.positives - positives);
    if (cursor) current.cursor = cursor;
  }

  const batch = await fetchSmartWave({
    seedKind: current.seed.kind,
    seedId: current.seed.id,
    cursor: current.cursor || undefined,
    hideListened: options.hideListened,
    languages: options.languages,
    limit: options.limit,
    signal: options.signal,
  });
  if (options.signal.aborted || session !== current) return [];

  if (batch.cursor) current.cursor = batch.cursor;
  if (batch.tracks.length === 0) session = null;
  return batch.tracks;
}

export function markAutopilotWaveTracks(urns: readonly string[]): void {
  if (!session) return;
  for (const urn of urns) {
    if (!urn) continue;
    session.ownedUrns.add(urn);
    while (session.ownedUrns.size > OWNED_URN_CAP) {
      const oldest = session.ownedUrns.keys().next().value;
      if (typeof oldest !== 'string') break;
      session.ownedUrns.delete(oldest);
    }
  }
}

export function resetAutopilotWaveSession(): void {
  session = null;
}
