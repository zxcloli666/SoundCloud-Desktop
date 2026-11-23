import { usePlayerStore } from '../stores/player';
import type { SmartWaveSeedKind } from './soundwave';

export type QueueContextKind =
  | 'wave'
  | 'artistWave'
  | 'similar'
  | 'likes'
  | 'superlikes'
  | 'playlist';

export interface QueueContext {
  kind: QueueContextKind;
  id?: string;
}

export function setQueueContext(queueContext: QueueContext | null): void {
  usePlayerStore.setState({ queueContext });
}

const WAVE_CONTEXT: Record<SmartWaveSeedKind, QueueContextKind> = {
  user: 'wave',
  artist: 'artistWave',
  track: 'similar',
};

export function setWaveContext(seedKind: SmartWaveSeedKind): void {
  setQueueContext({ kind: WAVE_CONTEXT[seedKind] });
}
