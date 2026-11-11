import { useAddToPlaylistRequest } from '../../../stores/add-to-playlist';
import { useLyricsStore } from '../../../stores/lyrics';
import { type Track, usePlayerStore } from '../../../stores/player';
import { useSearchQueryStore } from '../../../stores/searchQuery';
import { isLocalUrn } from '../../local-library';
import { getAlbumTarget, getArtistTarget, getTrackDisplay } from '../../track-display';
import { useVoiceStore } from '../store';
import { applySetting, readSettings } from './app-settings';
import type { Brief } from './context';
import { chatIpc } from './ipc';
import { goTo } from './navigator';
import { addNote, dropNotes } from './notes';
import { type CurrentLinks, type Page, pageTarget, type SettingsSection } from './pages';
import type { AppPort, OpenResult } from './ports';

const CURRENT: Page[] = ['current_track', 'current_artist', 'current_album'];

export function briefOf(track: Track): Brief {
  const display = getTrackDisplay(track);
  return { title: display.title, artist: display.artistLine };
}

function trackLink(track: Track): string | null {
  return isLocalUrn(track.urn) ? null : `/track/${encodeURIComponent(track.urn)}`;
}

function currentLinks(track: Track | null): CurrentLinks {
  if (!track) return { track: null, artist: null, album: null };
  return { track: trackLink(track), artist: getArtistTarget(track), album: getAlbumTarget(track) };
}

function open(page: Page, query: string, section: SettingsSection | null): OpenResult {
  const track = usePlayerStore.getState().currentTrack;
  if (CURRENT.includes(page) && !track) return 'nothing_playing';
  const target = pageTarget(page, section, currentLinks(track));
  if (!target) return 'no_page';
  if (page === 'search' && query) useSearchQueryStore.getState().setQ(query);
  return goTo(target.to, target.state) ? 'ok' : 'no_page';
}

function upNext(limit: number): Brief[] {
  const { queue, queueIndex } = usePlayerStore.getState();
  return queue.slice(queueIndex + 1, queueIndex + 1 + limit).map(briefOf);
}

function pickPlaylist(): boolean {
  const track = usePlayerStore.getState().currentTrack;
  if (!track || isLocalUrn(track.urn)) return false;
  useAddToPlaylistRequest.getState().request([track.urn]);
  return true;
}

function setSpeed(rate: number): number {
  usePlayerStore.getState().setPlaybackRate(rate);
  return usePlayerStore.getState().playbackRate;
}

function showLyrics(shown: boolean) {
  if (shown) useLyricsStore.getState().openPanel('lyrics');
  else useLyricsStore.getState().close();
}

function remember(note: string): boolean {
  const store = useVoiceStore.getState();
  const next = addNote(store.notes, note);
  if (next === store.notes) return false;
  store.setNotes(next);
  return true;
}

function forget(note: string): number {
  const store = useVoiceStore.getState();
  const next = dropNotes(store.notes, note);
  store.setNotes(next);
  return store.notes.length - next.length;
}

export const appPort: AppPort = {
  resolve: chatIpc.resolve,
  open,
  setSpeed,
  showLyrics,
  upNext,
  clearQueue: () => usePlayerStore.getState().clearQueue(),
  pickPlaylist,
  settings: readSettings,
  applySetting,
  remember,
  forget,
};
