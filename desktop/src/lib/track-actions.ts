import { toast } from 'sonner';
import i18n from '../i18n';
import { type Track, usePlayerStore } from '../stores/player';
import { downloadTrack } from './cache';
import { cleanPermalink } from './permalink';
import { getTrackDisplay } from './track-display';

export function playTrackNext(track: Track) {
  const player = usePlayerStore.getState();
  if (!player.currentTrack) {
    player.play(track, [track]);
    return;
  }
  player.addToQueueNext([track]);
  toast(i18n.t('trackMenu.playNextDone', { title: getTrackDisplay(track).title }));
}

export function playTrackLast(track: Track) {
  const player = usePlayerStore.getState();
  if (!player.currentTrack) {
    player.play(track, [track]);
    return;
  }
  player.addToQueueEnd([track]);
  toast(i18n.t('trackMenu.playLastDone', { title: getTrackDisplay(track).title }));
}

export function trackLabel(track: Track): string {
  const display = getTrackDisplay(track);
  const artist = display.artistLine || track.user?.username;
  return artist ? `${artist} — ${display.title}` : display.title;
}

async function copyText(text: string, doneKey: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(i18n.t(doneKey));
  } catch {
    toast.error(i18n.t('trackMenu.copyFailed'));
  }
}

export function copyTrackLink(track: Track) {
  if (track.permalink_url)
    void copyText(cleanPermalink(track.permalink_url), 'trackMenu.linkCopied');
}

export function copyTrackLabel(track: Track) {
  void copyText(trackLabel(track), 'trackMenu.labelCopied');
}

export function saveTrackFile(track: Track) {
  const display = getTrackDisplay(track);
  return downloadTrack(track.urn, display.artistLine || track.user.username, display.title, {
    artworkUrl: track.artwork_url,
    durationMs: track.duration,
    storageQuality: track._scd_meta?.storage_quality,
  });
}
