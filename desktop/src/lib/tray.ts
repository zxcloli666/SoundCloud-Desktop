import {emit, listen} from '@tauri-apps/api/event';
import {getCurrentWindow} from '@tauri-apps/api/window';
import { usePlayerStore } from '../stores/player';
import {api} from './api';
import {getDuration, handlePrev, seek} from './audio';
import {isUrnDisliked, toggleDislike} from './dislikes';
import {art} from './formatters';
import {invalidateAllLikesCache} from './hooks';
import {commitOptimisticLike, isUrnLiked, optimisticToggleLike} from './likes';
import {queryClient} from './query-client';
import {getArtistDisplay, getDisplayTitle} from './track-display';
import {areTraySnapshotsEqual, type TrayNowPlayingSnapshot} from './tray-snapshot';

/* ── Tray-popover bridge ─────────────────────────────────────────
   The tray-popover is a separate webview with no player state. This window stays
   the single source of truth: it pushes a compact `tray:np` snapshot on change
   and replies to `tray:hello`, while the popover sends `tray:cmd` back here so all
   queue/seek/like logic runs in exactly one place. */

function buildNp(): TrayNowPlayingSnapshot {
    const s = usePlayerStore.getState();
    const tr = s.currentTrack;
    if (!tr) {
        return {
            hasTrack: false,
            title: '',
            artist: '',
            artworkUrl: null,
            artworkLarge: null,
            isPlaying: false,
            volume: s.volume,
            liked: false,
            disliked: false,
            shuffle: s.shuffle,
            repeat: s.repeat,
            durationSec: 0,
            abLoop: null,
        };
    }
    return {
        hasTrack: true,
        title: getDisplayTitle(tr),
        artist: getArtistDisplay(tr).primary || tr.user.username,
        artworkUrl: art(tr.artwork_url, 't200x200'),
        artworkLarge: art(tr.artwork_url, 't500x500'),
        isPlaying: s.isPlaying,
        volume: s.volume,
        liked: isUrnLiked(tr.urn) || !!tr.user_favorite,
        disliked: isUrnDisliked(tr.urn),
        shuffle: s.shuffle,
        repeat: s.repeat,
        durationSec: getDuration() || tr.duration / 1000,
        abLoop: s.abLoop,
    };
}

let lastEmittedNp: TrayNowPlayingSnapshot | null = null;

function emitNp(force = false) {
    const next = buildNp();
    if (!force && lastEmittedNp && areTraySnapshotsEqual(lastEmittedNp, next)) return;
    lastEmittedNp = next;
    void emit('tray:np', next);
}

// Coalesce bursty change sources (volume drag, query-cache churn) to one emit per frame.
let npScheduled = false;

function pushNp() {
    if (npScheduled) return;
    npScheduled = true;
    requestAnimationFrame(() => {
        npScheduled = false;
        emitNp();
    });
}

async function toggleLikeCurrent() {
    const tr = usePlayerStore.getState().currentTrack;
    if (!tr) return;
    const next = !(isUrnLiked(tr.urn) || !!tr.user_favorite);
    optimisticToggleLike(queryClient, tr, next); // also updates isUrnLiked
    invalidateAllLikesCache();
    if (next && isUrnDisliked(tr.urn)) void toggleDislike(queryClient, tr, false);
    pushNp();
    try {
        await api(`/likes/tracks/${encodeURIComponent(tr.urn)}`, {method: next ? 'POST' : 'DELETE'});
        commitOptimisticLike(tr.urn, next);
    } catch {
        optimisticToggleLike(queryClient, tr, !next, {emitEvent: false});
        pushNp();
    }
}

async function toggleDislikeCurrent() {
    const tr = usePlayerStore.getState().currentTrack;
    if (!tr) return;
    const next = !isUrnDisliked(tr.urn);
    if (next && (isUrnLiked(tr.urn) || tr.user_favorite)) {
        optimisticToggleLike(queryClient, tr, false);
        invalidateAllLikesCache();
        api(`/likes/tracks/${encodeURIComponent(tr.urn)}`, {method: 'DELETE'}).catch(() => {
        });
    }
    const dislikePromise = toggleDislike(queryClient, tr, next);
    // Disliking the current track skips it, mirroring the now-bar dislike button.
    if (next) usePlayerStore.getState().next('dislike');
    await dislikePromise;
    pushNp();
}

async function showMainWindow() {
    const w = getCurrentWindow();
    await w.show();
    await w.unminimize();
    await w.setFocus();
}

/* ── Native tray menu (Rust-emitted) ─────────────────────────── */

listen<string>('tray-action', (event) => {
  const store = usePlayerStore.getState();
  switch (event.payload) {
    case 'play_pause':
      store.togglePlay();
      break;
    case 'next':
      store.next();
      break;
    case 'prev':
      handlePrev();
      break;
  }
});

/* ── Popover commands ────────────────────────────────────────── */

listen<{ action: string; value?: number }>('tray:cmd', (event) => {
    const {action, value} = event.payload;
    const store = usePlayerStore.getState();
    switch (action) {
        case 'play_pause':
            store.togglePlay();
            break;
        case 'next':
            store.next();
            break;
        case 'prev':
            handlePrev();
            break;
        case 'shuffle':
            store.toggleShuffle();
            break;
        case 'repeat':
            store.toggleRepeat();
            break;
        case 'seek':
            if (typeof value === 'number') seek(value);
            break;
        case 'volume':
            if (typeof value === 'number') store.setVolume(value);
            break;
        case 'like':
            void toggleLikeCurrent();
            break;
        case 'dislike':
            void toggleDislikeCurrent();
            break;
        case 'show':
            void showMainWindow();
            break;
    }
    pushNp();
});

// Fresh snapshot whenever the popover (re)opens.
listen('tray:hello', () => emitNp(true));

/* ── Snapshot fan-out ────────────────────────────────────────── */

usePlayerStore.subscribe((state, prev) => {
    if (
        state.currentTrack !== prev.currentTrack ||
        state.isPlaying !== prev.isPlaying ||
        state.volume !== prev.volume ||
        state.shuffle !== prev.shuffle ||
        state.repeat !== prev.repeat ||
        state.abLoop !== prev.abLoop
    ) {
        pushNp();
    }
});

// Like/dislike state lives in TanStack Query — re-push when the current track's
// reaction caches change (toggles from the main UI).
queryClient.getQueryCache().subscribe((ev) => {
    const k = ev?.query?.queryKey;
    if (!Array.isArray(k)) return;
    if (k[0] === 'dislikes') {
        pushNp();
        return;
    }
    const currentUrn = usePlayerStore.getState().currentTrack?.urn;
    if (k[0] === 'track' && k[1] === currentUrn) pushNp();
});
