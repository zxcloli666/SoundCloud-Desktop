import { listen } from '@tauri-apps/api/event';
import { useEffect } from 'react';
import { create } from 'zustand';
import type { MediaId } from '../../../../lib/chat/media-types';
import type { ChatError, ChatErrorCode, ConvId } from '../../../../lib/chat/types';
import { injectMediaKeyframes } from './keyframes';

export type GoneState = 'deleted' | 'lost';

interface MediaStateEvent {
  conversationId: ConvId;
  mediaId: MediaId;
  state: string;
}

interface UploadErrorEvent {
  id: string;
  error: ChatError;
}

interface MediaViewState {
  gone: Record<MediaId, GoneState>;
  uploadErrors: Record<string, ChatErrorCode>;
}

export const useMediaViewStore = create<MediaViewState>()(() => ({
  gone: {},
  uploadErrors: {},
}));

function markGone(mediaId: MediaId, state: string) {
  useMediaViewStore.setState((current) => {
    const gone = { ...current.gone };
    if (state === 'deleted' || state === 'lost') gone[mediaId] = state;
    else delete gone[mediaId];
    return { gone };
  });
}

function markUploadError(id: string, code: ChatErrorCode) {
  useMediaViewStore.setState((current) => ({
    uploadErrors: { ...current.uploadErrors, [id]: code },
  }));
}

let listening = false;

function setupMediaView() {
  injectMediaKeyframes();
  if (listening) return;
  listening = true;
  listen<MediaStateEvent>('chat:media-state', ({ payload }) =>
    markGone(payload.mediaId, payload.state),
  ).catch(() => undefined);
  listen<UploadErrorEvent>('chat:media-upload-error', ({ payload }) =>
    markUploadError(payload.id, payload.error.code),
  ).catch(() => undefined);
}

export function useMediaView() {
  useEffect(setupMediaView, []);
}

export function useGone(mediaId: MediaId): GoneState | null {
  return useMediaViewStore((state) => state.gone[mediaId] ?? null);
}

export function useUploadError(id: string): ChatErrorCode | null {
  return useMediaViewStore((state) => state.uploadErrors[id] ?? null);
}
