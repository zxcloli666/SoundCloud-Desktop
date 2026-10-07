import { create } from 'zustand';

export type ScrobbleService = 'lastfm' | 'listenbrainz';

export interface ScrobbleProfile {
  name: string;
  url: string | null;
  image: string | null;
  playcount: number | null;
  since: number | null;
}

export interface ScrobbleServiceStatus {
  available: boolean;
  profile: ScrobbleProfile | null;
  pending: number;
}

export interface ScrobbleStatus {
  lastfm: ScrobbleServiceStatus;
  listenbrainz: ScrobbleServiceStatus;
}

export type ScrobblePhase = 'idle' | 'listening' | 'scrobbled' | 'short' | 'preview';

export interface LiveScrobble {
  urn: string | null;
  phase: ScrobblePhase;
  played: number;
  threshold: number;
}

export type LastfmAuthPhase = 'idle' | 'waiting' | 'error';

interface ScrobbleStore {
  status: ScrobbleStatus | null;
  live: LiveScrobble;
  sent: number;
  lastfmAuth: LastfmAuthPhase;
}

export const IDLE_LIVE: LiveScrobble = { urn: null, phase: 'idle', played: 0, threshold: 0 };

export const useScrobbleStore = create<ScrobbleStore>(() => ({
  status: null,
  live: IDLE_LIVE,
  sent: 0,
  lastfmAuth: 'idle',
}));

export function hasScrobbleAccount(status: ScrobbleStatus | null): boolean {
  return Boolean(status?.lastfm.profile || status?.listenbrainz.profile);
}
