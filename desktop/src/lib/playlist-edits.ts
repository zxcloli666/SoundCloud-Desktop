import { toast } from 'sonner';
import i18n from '../i18n';
import { ApiError, api, isRefreshPending } from './api';

const ANSWERED_STATUSES = [404, 409];

const ERROR_TEXT: Record<string, string> = {
  playlist_revision_conflict: 'playlist.changedElsewhere',
  playlist_track_not_in_catalog: 'playlist.trackNotSynced',
};

export function editPlaylistTracks(playlistUrn: string, edit: object): Promise<unknown> {
  return api(`/playlists/${encodeURIComponent(playlistUrn)}/tracks`, {
    method: 'POST',
    body: JSON.stringify(edit),
    silentStatuses: ANSWERED_STATUSES,
  });
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
