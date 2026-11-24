import {emit, listen} from '@tauri-apps/api/event';
import {useAddToPlaylistRequest} from '../stores/add-to-playlist';
import { usePlayerStore } from '../stores/player';
import {useSettingsStore} from '../stores/settings';
import {useSuperlikeLimit} from '../stores/superlike-limit';
import {api} from './api';
import {getDuration, handlePrev, seek} from './audio';
import {forgetOfflineLike} from './cache';
import {trackedInvoke as invoke} from './diagnostics';
import {clearDislike, dislikeTrack} from './dislike-actions';
import {isUrnDisliked} from './dislikes';
import {trackTasteWrite} from './events';
import {art} from './formatters';
import {invalidateAllLikesCache} from './hooks';
import {isUrnLiked, optimisticToggleLike} from './likes';
import {isLocalUrn} from './local-library';
import {rememberLikedUrn} from './offline-index';
import {queryClient} from './query-client';
import {toggleSuperlike} from './superlike-actions';
import {cachedQuota, isQuotaFull, isUrnSuperliked, subscribeSuperliked} from './superlikes';
import {getArtistDisplay, getDisplayTitle} from './track-display';

/* ── Tray-popover bridge ─────────────────────────────────────────
   The tray-popover is a separate webview with no player state. This window stays
   the single source of truth: it pushes a compact `tray:np` snapshot on change
   and replies to `tray:hello`, while the popover sends `tray:cmd` back here so all
   queue/seek/like logic runs in exactly one place. */

interface TrayNp {
    hasTrack: boolean;
    title: string;
    artist: string;
    artworkUrl: string | null;
    artworkLarge: string | null;
    isPlaying: boolean;
    volume: number;
    liked: boolean;
    superliked: boolean;
    superlikeBlocked: boolean;
    disliked: boolean;
    shuffle: boolean;
    repeat: 'off' | 'one' | 'all';
    durationSec: number;
    abLoop: { a: number; b: number | null } | null;
}

function buildNp(): TrayNp {
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
            superliked: false,
            superlikeBlocked: false,
            disliked: false,
            shuffle: s.shuffle,
            repeat: s.repeat,
            durationSec: 0,
            abLoop: null,
        };
    }
    const liked = isUrnLiked(tr.urn) || !!tr.user_favorite;
    const superliked = liked && isUrnSuperliked(tr.urn);
    return {
        hasTrack: true,
        title: getDisplayTitle(tr),
        artist: getArtistDisplay(tr).primary || tr.user.username,
        artworkUrl: art(tr.artwork_url, 't200x200'),
        artworkLarge: art(tr.artwork_url, 't500x500'),
        isPlaying: s.isPlaying,
        volume: s.volume,
        liked,
        superliked,
        superlikeBlocked: !superliked && isQuotaFull(cachedQuota()),
        disliked: isUrnDisliked(tr.urn),
        shuffle: s.shuffle,
        repeat: s.repeat,
        durationSec: getDuration() || tr.duration / 1000,
        abLoop: s.abLoop,
    };
}

function emitNp() {
    void emit('tray:np', buildNp());
}

// Coalesce bursty change sources (volume drag, query-cache churn) to one emit per frame.
let npScheduled = false;

function flushNp() {
    if (!npScheduled) return;
    npScheduled = false;
    emitNp();
}

function pushNp() {
    if (npScheduled) return;
    npScheduled = true;
    if (document.hidden) queueMicrotask(flushNp);
    else requestAnimationFrame(flushNp);
}

document.addEventListener('visibilitychange', () => {
    if (document.hidden) flushNp();
});

export async function toggleLikeCurrent() {
    const tr = usePlayerStore.getState().currentTrack;
    if (!tr || isLocalUrn(tr.urn)) return;
    const next = !(isUrnLiked(tr.urn) || !!tr.user_favorite);
    optimisticToggleLike(queryClient, tr, next); // also updates isUrnLiked
    invalidateAllLikesCache();
    if (next) clearDislike(tr.urn);
    pushNp();
    try {
        await trackTasteWrite(
            api(`/likes/tracks/${encodeURIComponent(tr.urn)}`, {
                method: next ? 'POST' : 'DELETE',
            }),
        );
        void (next ? rememberLikedUrn(tr.urn, tr) : forgetOfflineLike(tr.urn));
    } catch {
        optimisticToggleLike(queryClient, tr, !next);
        pushNp();
    }
}

function toggleSuperlikeCurrent() {
    const tr = usePlayerStore.getState().currentTrack;
    if (!tr || isLocalUrn(tr.urn)) return;
    toggleSuperlike(tr);
    if (useSuperlikeLimit.getState().wanted) void invoke('show_main_window');
}

async function toggleDislikeCurrent() {
    const tr = usePlayerStore.getState().currentTrack;
    if (!tr || isLocalUrn(tr.urn)) return;
    if (isUrnDisliked(tr.urn)) clearDislike(tr.urn);
    else await dislikeTrack(tr, {undo: false});
    pushNp();
}

function addCurrentToPlaylist() {
    const tr = usePlayerStore.getState().currentTrack;
    if (!tr || isLocalUrn(tr.urn)) return;
    void invoke('show_main_window');
    useAddToPlaylistRequest.getState().request(tr);
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
        case 'mute_toggle':
            store.setVolume(store.volume > 0 ? 0 : store.volumeBeforeMute);
            break;
        case 'like':
            void toggleLikeCurrent();
            break;
        case 'superlike':
            toggleSuperlikeCurrent();
            break;
        case 'dislike':
            void toggleDislikeCurrent();
            break;
        case 'add_to_playlist':
            addCurrentToPlaylist();
            break;
        case 'show':
            void invoke('show_main_window');
            break;
    }
    pushNp();
});

// Fresh snapshot whenever the popover (re)opens.
listen('tray:hello', () => emitNp());

/* ── Snapshot fan-out ────────────────────────────────────────── */

usePlayerStore.subscribe(pushNp);
subscribeSuperliked(pushNp);

useSettingsStore.subscribe((s, prev) => {
    if (s.miniPlayerOpacity !== prev.miniPlayerOpacity) void emit('tray:opacity', s.miniPlayerOpacity);
    if (s.miniPlayerSolid !== prev.miniPlayerSolid) void emit('tray:solid', s.miniPlayerSolid);
});

// Like/dislike state lives in TanStack Query — re-push when the current track's
// reaction caches change (toggles from the main UI).
queryClient.getQueryCache().subscribe((ev) => {
    const k = ev?.query?.queryKey;
    if (Array.isArray(k) && (k[0] === 'track' || k[0] === 'dislikes' || k[0] === 'superlikes')) pushNp();
});
