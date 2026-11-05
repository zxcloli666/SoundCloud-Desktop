export const RETRY_MS = 30_000;

export type BackdropFace = 'image' | 'cover' | 'waiting';

export function backdropFace(shown: string | undefined, failed: boolean): BackdropFace {
  if (shown === 'deleted') return 'cover';
  return failed ? 'waiting' : 'image';
}

export function retriesAfter(face: BackdropFace): number | null {
  return face === 'waiting' ? RETRY_MS : null;
}
