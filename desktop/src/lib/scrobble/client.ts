import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { openUrl } from '@tauri-apps/plugin-opener';
import { type ScrobbleService, type ScrobbleStatus, useScrobbleStore } from '../../stores/scrobble';

const AUTH_POLL_MS = 3000;
const AUTH_TIMEOUT_MS = 5 * 60_000;

let authTimer: ReturnType<typeof setTimeout> | null = null;
let authDeadline = 0;

function apply(status: ScrobbleStatus) {
  useScrobbleStore.setState({ status });
}

export async function loadScrobbleStatus(): Promise<void> {
  try {
    apply(await invoke<ScrobbleStatus>('scrobble_status'));
  } catch (e) {
    console.warn('[Scrobble] status failed:', e);
  }
}

export async function refreshScrobbleProfiles(): Promise<void> {
  try {
    apply(await invoke<ScrobbleStatus>('scrobble_refresh'));
  } catch (e) {
    console.warn('[Scrobble] refresh failed:', e);
  }
}

export async function disconnectScrobbler(service: ScrobbleService): Promise<void> {
  apply(await invoke<ScrobbleStatus>('scrobble_disconnect', { service }));
}

export async function connectListenbrainz(token: string): Promise<void> {
  apply(await invoke<ScrobbleStatus>('listenbrainz_connect', { token }));
}

function stopAuthPolling() {
  if (authTimer) clearTimeout(authTimer);
  authTimer = null;
}

async function pollLastfmAuth() {
  authTimer = null;
  if (useScrobbleStore.getState().lastfmAuth !== 'waiting') return;
  try {
    const status = await invoke<ScrobbleStatus | null>('lastfm_auth_finish');
    if (useScrobbleStore.getState().lastfmAuth !== 'waiting') return;
    if (status) {
      useScrobbleStore.setState({ status, lastfmAuth: 'idle' });
      return;
    }
  } catch (e) {
    if (String(e) === 'expired') {
      useScrobbleStore.setState({ lastfmAuth: 'error' });
      return;
    }
  }
  if (Date.now() > authDeadline) {
    void cancelLastfmAuth();
    return;
  }
  authTimer = setTimeout(pollLastfmAuth, AUTH_POLL_MS);
}

export async function startLastfmAuth(): Promise<void> {
  stopAuthPolling();
  useScrobbleStore.setState({ lastfmAuth: 'waiting' });
  try {
    const url = await invoke<string>('lastfm_auth_start');
    await openUrl(url);
    authDeadline = Date.now() + AUTH_TIMEOUT_MS;
    authTimer = setTimeout(pollLastfmAuth, AUTH_POLL_MS);
  } catch (e) {
    console.warn('[Scrobble] Last.fm auth failed:', e);
    useScrobbleStore.setState({ lastfmAuth: 'error' });
  }
}

export async function cancelLastfmAuth(): Promise<void> {
  stopAuthPolling();
  useScrobbleStore.setState({ lastfmAuth: 'idle' });
  await invoke('lastfm_auth_cancel').catch(() => undefined);
}

export function resumeLastfmAuthCheck(): void {
  if (useScrobbleStore.getState().lastfmAuth !== 'waiting') return;
  stopAuthPolling();
  void pollLastfmAuth();
}

void listen('scrobble:changed', () => {
  void loadScrobbleStatus();
});
