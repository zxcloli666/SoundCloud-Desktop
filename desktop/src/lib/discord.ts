import { invoke as coreInvoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useDiscordStatusStore } from '../stores/discord-status';
import { usePlayerStore } from '../stores/player';
import { useSettingsStore } from '../stores/settings';
import { getCurrentTime } from './audio';
import { trackedInvoke as invoke } from './diagnostics';
import { getArtistDisplay, getDisplayTitle } from './track-display';

let connected = false;
let lastConnectAttemptAt = 0;
let syncing = false;
let syncAgain = false;
const CONNECT_RETRY_MS = 5000;
const HEARTBEAT_MS = 15000;
const CHANGE_DEBOUNCE_MS = 400;
const SEEK_DEBOUNCE_MS = 180;
const TEXT_MIN_LENGTH = 2;
const TEXT_MAX_LENGTH = 128;

function setConnected(value: boolean) {
  connected = value;
  useDiscordStatusStore.setState({ status: value ? 'connected' : 'unavailable' });
}

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
    setConnected(await coreInvoke<boolean>('discord_connect'));
    return connected;
  } catch {
    setConnected(false);
    return false;
  }
}

function artworkToLarge(url: string | null): string | undefined {
  if (!url) return undefined;
  return url.replace(/-[^-./]+(\.[^.]+)$/, '-t500x500$1');
}

function fitText(text: string): string {
  let fitted = '';
  for (const char of text) {
    if (fitted.length + char.length > TEXT_MAX_LENGTH) break;
    fitted += char;
  }
  return fitted.padEnd(TEXT_MIN_LENGTH, '\u200b');
}

async function pushPresence(): Promise<boolean> {
  if (!usePlayerStore.getState().currentTrack) {
    await clearPresence();
    return true;
  }
  if (!(await ensureConnected())) return true;

  const { currentTrack: track, isPlaying } = usePlayerStore.getState();
  if (!track) return true;

  try {
    const { discordRpcMode, discordRpcStatus, discordRpcShowButton } = useSettingsStore.getState();
    const display = getArtistDisplay(track);
    await invoke('discord_set_activity', {
      track: {
        title: fitText(getDisplayTitle(track)),
        artist: fitText(display.primary || track.user?.username || ''),
        artwork_url: artworkToLarge(track.artwork_url),
        track_url: track.permalink_url ? `${track.permalink_url}`.replace(/\?.*$/, '') : undefined,
        duration_secs: Math.round(track.duration / 1000),
        elapsed_secs: Math.round(getCurrentTime()),
        is_playing: isPlaying,
        mode: discordRpcMode,
        status: discordRpcStatus,
        show_button: discordRpcShowButton,
      },
    });
    return true;
  } catch (e) {
    console.warn('[Discord] Failed to set activity:', e);
    setConnected(false);
    return false;
  }
}

async function updatePresence() {
  if (syncing) {
    syncAgain = true;
    return;
  }
  syncing = true;
  try {
    do {
      syncAgain = false;
      if (!(await pushPresence())) {
        lastConnectAttemptAt = 0;
        await pushPresence();
      }
    } while (syncAgain);
  } finally {
    syncing = false;
  }
}

async function clearPresence() {
  if (!connected) return;
  try {
    await invoke('discord_clear_activity');
  } catch {
    setConnected(false);
  }
}

let lastUrn: string | null = null;
let lastLabel = '';
let lastPlaying = false;
let lastElapsed = 0;
let syncTimer: ReturnType<typeof setTimeout> | null = null;

function schedulePresenceSync(delayMs: number) {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    lastElapsed = Math.round(getCurrentTime());
    void updatePresence();
  }, delayMs);
}

usePlayerStore.subscribe((state) => {
  const { currentTrack, isPlaying } = state;

  const trackChanged = (currentTrack?.urn ?? null) !== lastUrn;
  const playChanged = isPlaying !== lastPlaying;

  if (!currentTrack) {
    if (lastPlaying || trackChanged) {
      void updatePresence();
    }
    if (syncTimer) {
      clearTimeout(syncTimer);
      syncTimer = null;
    }
    lastUrn = null;
    lastLabel = '';
    lastPlaying = false;
    lastElapsed = 0;
    return;
  }

  const label = `${getDisplayTitle(currentTrack)}\n${getArtistDisplay(currentTrack).primary}`;

  if (trackChanged || playChanged || label !== lastLabel) {
    lastUrn = currentTrack.urn;
    lastLabel = label;
    lastPlaying = isPlaying;
    lastElapsed = Math.round(getCurrentTime());
    schedulePresenceSync(CHANGE_DEBOUNCE_MS);
  }
});

useSettingsStore.subscribe((state, prev) => {
  const rpcSettingsChanged =
    state.discordRpcEnabled !== prev.discordRpcEnabled ||
    state.discordRpcMode !== prev.discordRpcMode ||
    state.discordRpcStatus !== prev.discordRpcStatus ||
    state.discordRpcShowButton !== prev.discordRpcShowButton;

  if (!rpcSettingsChanged) return;

  if (!state.discordRpcEnabled) {
    if (syncTimer) {
      clearTimeout(syncTimer);
      syncTimer = null;
    }
    void clearPresence().finally(() => {
      connected = false;
      useDiscordStatusStore.setState({ status: 'idle' });
      void invoke('discord_disconnect').catch(() => undefined);
    });
    return;
  }

  void updatePresence();
});

listen<number>('audio:tick', (event) => {
  const { currentTrack, isPlaying } = usePlayerStore.getState();
  if (!currentTrack || !useSettingsStore.getState().discordRpcEnabled) return;

  if (!connected) {
    void updatePresence();
    return;
  }

  if (!isPlaying) return;

  const elapsed = Math.round(event.payload);
  const drift = Math.abs(elapsed - lastElapsed);

  // Re-sync Discord timestamps on manual seek / large jumps without spamming updates every second.
  if (drift >= 2) {
    lastElapsed = elapsed;
    schedulePresenceSync(SEEK_DEBOUNCE_MS);
  } else {
    lastElapsed = elapsed;
  }
});

setInterval(() => {
  if (usePlayerStore.getState().currentTrack) void updatePresence();
}, HEARTBEAT_MS);
