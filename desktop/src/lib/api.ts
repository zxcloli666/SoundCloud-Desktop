// Re-export shim — keeps existing imports working
export {
  ApiError,
  apiRequest as api,
  fetchWithAuthFallback,
  getSessionId,
  isRefreshPending,
  setSessionId,
} from './api-client';
export type { ResolvedStreamingTrack } from './streaming';
export {
  buildStorageUrls,
  downloadFallbackUrls,
  isHqStreaming,
  resolveTrackFromStreaming,
  streamFallbackUrls,
} from './streaming';
