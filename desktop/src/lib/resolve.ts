import { ApiError, api } from './api';
import { type ResolvedStreamingTrack, resolveTrackFromStreaming } from './streaming';

export type ResolvedEntity = ResolvedStreamingTrack;

const QUIET_STATUSES = [400, 404, 422, 429, 500, 502, 503, 504];
const ENTITY_URN = /^soundcloud:(tracks|playlists|users):\d+$/;

function fallsBack(error: unknown): boolean {
  if (!(error instanceof ApiError)) return true;
  return error.status === 429 || error.status >= 500;
}

export async function resolveLink(link: string): Promise<ResolvedEntity> {
  try {
    return await api<ResolvedEntity>(`/resolve?url=${encodeURIComponent(link)}`, {
      silentStatuses: QUIET_STATUSES,
    });
  } catch (error) {
    if (!fallsBack(error)) throw error;
    if (ENTITY_URN.test(link)) return { urn: link };
    try {
      return await resolveTrackFromStreaming(link);
    } catch {
      throw error;
    }
  }
}
