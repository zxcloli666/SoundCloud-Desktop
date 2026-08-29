import type { Track } from '../stores/player';
import { usePlayerStore } from '../stores/player';
import { useSettingsStore } from '../stores/settings';
import { getCurrentTime, subscribe as subscribeAudioTime } from './audio';
import { trackedInvoke as invoke } from './diagnostics';
import { getArtistDisplay, getDisplayTitle } from './track-display';

let connected = false;
let lastConnectAttemptAt = 0;
let connectPromise: Promise<boolean> | null = null;
const CONNECT_RETRY_MS = 5000;

async function ensureConnected(): Promise<boolean> {
  if (!useSettingsStore.getState().discordRpcEnabled) {
    return false;
  }
  if (connected) return true;
  if (connectPromise) return connectPromise;
  const now = Date.now();
  if (now - lastConnectAttemptAt < CONNECT_RETRY_MS) {
    return false;
  }
  lastConnectAttemptAt = now;
  connectPromise = invoke<boolean>('discord_connect')
    .then((result) => {
      connected = result;
      return result;
    })
    .catch(() => false)
    .finally(() => {
      connectPromise = null;
    });
  return connectPromise;
}

function artworkToLarge(url: string | null): string | undefined {
  if (!url) return undefined;
  return url.replace(/-[^-./]+(\.[^.]+)$/, '-t500x500$1');
}

async function updatePresence(track: Track) {
  if (!(await ensureConnected())) return;

  // A connect can outlive a fast track switch or a settings toggle. Never let
  // that stale continuation publish metadata for a track that is no longer active.
  const activeTrack = usePlayerStore.getState().currentTrack;
  if (
    !activeTrack ||
    activeTrack.urn !== track.urn ||
    !useSettingsStore.getState().discordRpcEnabled
  ) {
    return;
  }

  try {
    const isPlaying = usePlayerStore.getState().isPlaying;
    const { discordRpcMode, discordRpcShowButton } = useSettingsStore.getState();
    const display = getArtistDisplay(activeTrack);
    await invoke('discord_set_activity', {
      track: {
        title: getDisplayTitle(activeTrack),
        artist: display.primary || activeTrack.user.username,
        artwork_url: artworkToLarge(activeTrack.artwork_url),
        track_url: activeTrack.permalink_url
          ? `${activeTrack.permalink_url}`.replace(/\?.*$/, '')
          : undefined,
        duration_secs: Math.round(activeTrack.duration / 1000),
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
    void updatePresence(track);
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
    if (seekSyncTimer) {
      clearTimeout(seekSyncTimer);
      seekSyncTimer = null;
    }
    lastUrn = currentTrack.urn;
    lastPlaying = isPlaying;
    lastElapsed = Math.round(getCurrentTime());
    void updatePresence(currentTrack);
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
  if (elapsed === lastElapsed) return;
  const drift = Math.abs(elapsed - lastElapsed);

  // Re-sync Discord timestamps on manual seek / large jumps without spamming updates every second.
  if (drift >= 2) {
    lastElapsed = elapsed;
    schedulePresenceSync(currentTrack, 180);
  } else {
    lastElapsed = elapsed;
  }
});
