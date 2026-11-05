import { useCallback, useEffect } from 'react';
import type { MediaId } from '../../../../lib/chat/media-types';
import { type ShownMedia, useChatMediaStore } from '../../../../stores/chat/media';
import { injectMediaKeyframes } from './keyframes';

export type GoneState = 'deleted' | 'lost';

function goneOf(shown: ShownMedia | undefined): GoneState | null {
  return shown === 'deleted' || shown === 'lost' ? shown : null;
}

export function useMediaView() {
  useEffect(injectMediaKeyframes, []);
}

export function useGone(mediaId: MediaId): GoneState | null {
  return useChatMediaStore((state) => goneOf(state.shown[mediaId]));
}

export function useRevive(mediaId: MediaId, retry: () => void): () => void {
  const reviveMedia = useChatMediaStore((state) => state.reviveMedia);
  return useCallback(() => {
    void reviveMedia(mediaId).then(retry);
  }, [reviveMedia, mediaId, retry]);
}
