import { type Track, usePlayerStore } from '../../../stores/player';
import { clearDislike, dislikeTrack } from '../../dislike-actions';
import { isUrnDisliked } from '../../dislikes';
import { isLocalUrn } from '../../local-library';
import { requestSuperlike, toggleSuperlike } from '../../superlike-actions';
import { isUrnSuperliked } from '../../superlikes';
import type { Taste } from './ports';

function rated(): Track | 'nothing_playing' | 'local_track' {
  const track = usePlayerStore.getState().currentTrack;
  if (!track) return 'nothing_playing';
  if (isLocalUrn(track.urn)) return 'local_track';
  return track;
}

export async function dislike(on: boolean): Promise<Taste> {
  const track = rated();
  if (typeof track === 'string') return track;
  if (!on) {
    clearDislike(track.urn);
    return 'ok';
  }
  if (isUrnDisliked(track.urn)) return 'ok';
  await dislikeTrack(track);
  return isUrnDisliked(track.urn) ? 'ok' : 'failed';
}

export function superlike(on: boolean): Taste {
  const track = rated();
  if (typeof track === 'string') return track;
  if (isUrnSuperliked(track.urn) === on) return 'ok';
  if (!on) {
    toggleSuperlike(track);
    return 'ok';
  }
  return requestSuperlike(track) ? 'ok' : 'quota_full';
}

export function tasteNow(urn: string | undefined): { disliked: boolean; superliked: boolean } {
  if (!urn || isLocalUrn(urn)) return { disliked: false, superliked: false };
  return { disliked: isUrnDisliked(urn), superliked: isUrnSuperliked(urn) };
}
