import type { TrackScdMeta, TrackVideo } from '../stores/player';

export type RatingTier = 'analyzed' | 'cached' | 'pending' | 'tooLong' | 'failed';

export const RATING_LETTERS: Record<RatingTier, string> = {
  analyzed: 'A',
  cached: 'C',
  pending: '·',
  tooLong: 'F',
  failed: '!',
};

export function sameScdMeta(a?: TrackScdMeta, b?: TrackScdMeta): boolean {
  return (
    a?.storage_state === b?.storage_state &&
    a?.storage_quality === b?.storage_quality &&
    a?.index_state === b?.index_state
  );
}

export function sameVideos(a?: TrackVideo[], b?: TrackVideo[]): boolean {
  return a === b || (a ?? []).map((v) => v.kind).join() === (b ?? []).map((v) => v.kind).join();
}

export function ratingTier({ storage_state, index_state }: TrackScdMeta): RatingTier {
  if (storage_state === 'too_long' || index_state === 'too_long') return 'tooLong';
  if (storage_state === 'failed' || storage_state === 'missing' || index_state === 'failed') {
    return 'failed';
  }
  if (storage_state === 'ok') return index_state === 'indexed' ? 'analyzed' : 'cached';
  return 'pending';
}

export function ratingQuality(tier: RatingTier, meta: TrackScdMeta): 'hq' | 'uq' | null {
  if (tier !== 'analyzed' && tier !== 'cached') return null;
  const stored = meta.storage_quality;
  return stored === 'hq' || stored === 'uq' ? stored : null;
}

export function ratingTitleKey(tier: RatingTier, meta: TrackScdMeta): string {
  const quality = ratingQuality(tier, meta);
  return `track.status.${tier}${quality === 'uq' ? 'Uq' : quality === 'hq' ? 'Hq' : ''}`;
}
