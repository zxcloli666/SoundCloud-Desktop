import { invoke } from '@tauri-apps/api/core';
import { usePlayerStore } from '../stores/player';
import type { Track } from '../stores/player';

let connected = false;

async function ensureConnected(): Promise<boolean> {
  if (connected) return true;
  try {
    connected = await invoke<boolean>('discord_connect');
    return connected;
  } catch {
    return false;
  }
}

function artworkToLarge(url: string | null): string | undefined {
  if (!url) return undefined;
  // Use t500x500 for best quality in Discord
  return url.replace(/-[^./]*\./, '-t500x500.');
}

async function updatePresence(track: Track, elapsed: number) {
  if (!(await ensureConnected())) return;

  try {
    await invoke('discord_set_activity', {
      track: {
        title: track.title,
        artist: track.user.username,
        artwork_url: artworkToLarge(track.artwork_url),
        track_url: track.user.permalink_url
          ? `${track.user.permalink_url}`.replace(/\?.*$/, '')
          : undefined,
        duration_secs: Math.round(track.duration / 1000),
        elapsed_secs: Math.round(elapsed),
      },
    });
  } catch (e) {
    console.warn('[Discord] Failed to set activity:', e);
    connected = false;
  }
}

async function clearPresence() {
  if (!connected) return;
  try {
    await invoke('discord_clear_activity');
  } catch {
    connected = false;
  }
}

// Subscribe to playback state
let lastUrn: string | null = null;
let lastPlaying = false;

usePlayerStore.subscribe((state) => {
  const { currentTrack, isPlaying, progress } = state;

  const trackChanged = currentTrack?.urn !== lastUrn;
  const playChanged = isPlaying !== lastPlaying;

  if (!currentTrack || !isPlaying) {
    if (lastPlaying || trackChanged) {
      clearPresence();
    }
    lastUrn = currentTrack?.urn ?? null;
    lastPlaying = false;
    return;
  }

  if (trackChanged || playChanged) {
    lastUrn = currentTrack.urn;
    lastPlaying = isPlaying;
    updatePresence(currentTrack, progress);
  }
});
