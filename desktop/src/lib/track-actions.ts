import { toast } from 'sonner';
import i18n from '../i18n';
import { type Track, usePlayerStore } from '../stores/player';
import { downloadTrack } from './cache';
import { trackedInvoke as invoke } from './diagnostics';
import { sanitizeFilename } from './filename';
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

export async function saveTrackCover(track: Track) {
  const artwork = track.artwork_url;
  if (!artwork) return;
  const display = getTrackDisplay(track);
  const extension = artwork.match(/\.(\w+)(?:\?|$)/)?.[1] ?? 'jpg';
  const name = sanitizeFilename(`${display.artistLine || track.user.username} - ${display.title}`);
  const { save } = await import('@tauri-apps/plugin-dialog');
  const dest = await save({
    defaultPath: `${name}.${extension}`,
    filters: [{ name: 'Image', extensions: [extension] }],
  });
  if (!dest) return;
  await invoke('track_cover_save', {
    urls: [artwork.replace('-large', '-original'), artwork.replace('-large', '-t500x500')],
    destPath: dest,
  });
  toast.success(i18n.t('track.downloaded'));
}
