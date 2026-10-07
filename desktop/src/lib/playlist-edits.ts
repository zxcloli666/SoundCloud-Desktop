import { toast } from 'sonner';
import i18n from '../i18n';
import { ApiError, api, isRefreshPending } from './api';

const ANSWERED_STATUSES = [404, 409];
const BASELINE_RETRIES = 3;
const MAX_BASELINE_WAIT_SECONDS = 10;

const ERROR_TEXT: Record<string, string> = {
  playlist_awaiting_baseline: 'playlist.awaitingSync',
  playlist_legacy_reconciliation_pending: 'playlist.awaitingSync',
  playlist_revision_conflict: 'playlist.changedElsewhere',
  playlist_track_not_in_catalog: 'playlist.trackNotSynced',
};

function isAwaitingBaseline(error: unknown): error is ApiError {
  return error instanceof ApiError && error.code === 'playlist_awaiting_baseline';
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function editPlaylistTracks(playlistUrn: string, edit: object): Promise<unknown> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await api(`/playlists/${encodeURIComponent(playlistUrn)}/tracks`, {
        method: 'POST',
        body: JSON.stringify(edit),
        silentStatuses: ANSWERED_STATUSES,
      });
    } catch (error) {
      if (!isAwaitingBaseline(error) || attempt === BASELINE_RETRIES) throw error;
      const seconds = Math.min(error.retryAfterSeconds ?? 5, MAX_BASELINE_WAIT_SECONDS);
      await sleep(seconds * 1000);
    }
  }
}

export interface PlaylistDetails {
  title: string;
  description: string;
}

export function updatePlaylistDetails(playlistUrn: string, details: PlaylistDetails) {
  return api(`/playlists/${encodeURIComponent(playlistUrn)}`, {
    method: 'PUT',
    body: JSON.stringify({ playlist: details }),
    silentStatuses: ANSWERED_STATUSES,
  });
}

export function toastPlaylistEditError(error: unknown) {
  if (isRefreshPending(error)) {
    toast.error(i18n.t('playlist.awaitingSync'));
    return;
  }
  if (!(error instanceof ApiError) || !ANSWERED_STATUSES.includes(error.status)) return;
  toast.error(i18n.t(ERROR_TEXT[error.code ?? ''] ?? 'playlist.editFailed'));
}
