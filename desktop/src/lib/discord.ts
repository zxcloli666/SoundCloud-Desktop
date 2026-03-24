import type { Track } from '../stores/player';
import { usePlayerStore } from '../stores/player';
import { useSettingsStore } from '../stores/settings';
import { getCurrentTime, subscribe as subscribeAudioTime } from './audio';
import { trackedInvoke as invoke } from './diagnostics';

let connected = false;
let lastConnectAttemptAt = 0;
const CONNECT_RETRY_MS = 5000;

async function ensureConnected(): Promise<boolean> {
  if (!useSettingsStore.getState().discordRpcEnabled) {
    return false;
  }
  if (connected) return true;
  const now = Date.now();
  if (now - lastConnectAttemptAt < CONNECT_RETRY_MS) {
    return false;
  }
  lastConnectAttemptAt = now;
  try {
    connected = await invoke<boolean>('discord_connect');
    return connected;
  } catch {
    return false;
  }
}

function artworkToLarge(url: string | null): string | undefined {
  if (!url) return undefined;
  return url.replace(/-[^-./]+(\.[^.]+)$/, '-t500x500$1');
}

async function updatePresence(track: Track) {
  if (!(await ensureConnected())) return;

  try {
    const isPlaying = usePlayerStore.getState().isPlaying;
    const { discordRpcMode, discordRpcShowButton } = useSettingsStore.getState();
    await invoke('discord_set_activity', {
      track: {
        title: track.title,
        artist: track.user.username,
        artwork_url: artworkToLarge(track.artwork_url),
        track_url: track.permalink_url
          ? `${track.permalink_url}`.replace(/\?.*$/, '')
          : undefined,
        duration_secs: Math.round(track.duration / 1000),
        elapsed_secs: Math.round(getCurrentTime()),
        is_playing: isPlaying,
        mode: discordRpcMode,
        show_button: discordRpcShowButton,
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

let lastUrn: string | null = null;
let lastPlaying = false;
let lastElapsed = 0;
let seekSyncTimer: ReturnType<typeof setTimeout> | null = null;

function schedulePresenceSync(track: Track, delayMs: number) {
  if (seekSyncTimer) clearTimeout(seekSyncTimer);
  seekSyncTimer = setTimeout(() => {
    seekSyncTimer = null;
    lastElapsed = Math.round(getCurrentTime());
    updatePresence(track);
  }, delayMs);
}

usePlayerStore.subscribe((state) => {
  const { currentTrack, isPlaying } = state;

  const trackChanged = currentTrack?.urn !== lastUrn;
  const playChanged = isPlaying !== lastPlaying;

  if (!currentTrack) {
    if (lastPlaying || trackChanged) {
      clearPresence();
    }
    if (seekSyncTimer) {
      clearTimeout(seekSyncTimer);
      seekSyncTimer = null;
    }
    lastUrn = null;
    lastPlaying = false;
    lastElapsed = 0;
    return;
  }

  if (trackChanged || playChanged) {
    lastUrn = currentTrack.urn;
    lastPlaying = isPlaying;
    lastElapsed = Math.round(getCurrentTime());
    updatePresence(currentTrack);
  }
});

useSettingsStore.subscribe((state, prev) => {
  const rpcSettingsChanged =
    state.discordRpcEnabled !== prev.discordRpcEnabled ||
    state.discordRpcMode !== prev.discordRpcMode ||
    state.discordRpcShowButton !== prev.discordRpcShowButton;

  if (!rpcSettingsChanged) return;

  if (!state.discordRpcEnabled) {
    if (seekSyncTimer) {
      clearTimeout(seekSyncTimer);
      seekSyncTimer = null;
    }
    void clearPresence().finally(() => {
      connected = false;
      void invoke('discord_disconnect').catch(() => undefined);
    });
    return;
  }

  const { currentTrack } = usePlayerStore.getState();
  if (currentTrack) {
    void updatePresence(currentTrack);
  }
});

subscribeAudioTime(() => {
  const { currentTrack, isPlaying } = usePlayerStore.getState();
  if (!currentTrack || !useSettingsStore.getState().discordRpcEnabled) return;

  if (!connected) {
    void updatePresence(currentTrack);
    return;
  }

  if (!isPlaying) return;

  const elapsed = Math.round(getCurrentTime());
  const drift = Math.abs(elapsed - lastElapsed);

  // Re-sync Discord timestamps on manual seek / large jumps without spamming updates every second.
  if (drift >= 2) {
    schedulePresenceSync(currentTrack, 180);
  } else {
    lastElapsed = elapsed;
  }
});
