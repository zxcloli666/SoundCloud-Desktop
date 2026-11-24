import { useAddToPlaylistRequest } from '../../../stores/add-to-playlist';
import { usePlayerStore } from '../../../stores/player';
import { useSettingsStore } from '../../../stores/settings';
import { listMyPlaylists } from '../../import-save';
import { isLocalUrn } from '../../local-library';
import { addToPlaylist, type PlaylistPlace, toastPlaylistEditError } from '../../playlist-edits';
import { pickByTitle } from '../../playlist-pick';
import { queryClient } from '../../query-client';
import type { PlaylistAdd } from './ports';

export async function toPlaylist(name: string, place: PlaylistPlace | null): Promise<PlaylistAdd> {
  const track = usePlayerStore.getState().currentTrack;
  if (!track) return 'nothing_playing';
  if (isLocalUrn(track.urn)) return 'local_track';
  const settings = useSettingsStore.getState();

  if (!name) {
    if (place) settings.setPlaylistPlace(place);
    useAddToPlaylistRequest.getState().request(track);
    return 'opened';
  }

  try {
    const playlist = pickByTitle(await listMyPlaylists(), name);
    if (!playlist) return 'not_found';
    await addToPlaylist(playlist.urn, track.urn, place ?? settings.playlistPlace);
    queryClient.invalidateQueries({ queryKey: ['playlist', playlist.urn] });
    queryClient.invalidateQueries({ queryKey: ['me', 'playlists'] });
    return { added: playlist.title };
  } catch (error) {
    toastPlaylistEditError(error);
    return 'failed';
  }
}
