import {emit, listen} from '@tauri-apps/api/event';
import {
    areTraySnapshotsEqual,
    type TrayNowPlayingSnapshot,
    type TrayRepeatMode,
} from '../lib/tray-snapshot';

/* ── Now-playing snapshot, pushed by the main window ─────────────
   The popover is a separate webview context — it owns no player state and runs no
   audio orchestrator. The main window is the single source of truth: it emits
   `tray:np` on every relevant change, and the live scrubber position rides the
   already-broadcast `audio:tick` (10Hz) — so the popover adds zero extra IPC. */

export type RepeatMode = TrayRepeatMode;
export type TrayNp = TrayNowPlayingSnapshot;

export type TrayCmd =
    | 'play_pause'
    | 'next'
    | 'prev'
    | 'shuffle'
    | 'repeat'
    | 'like'
    | 'dislike'
    | 'show'
    | 'seek'
    | 'volume';

const EMPTY: TrayNp = {
    hasTrack: false,
    title: '',
    artist: '',
    artworkUrl: null,
    artworkLarge: null,
    isPlaying: false,
    volume: 50,
    liked: false,
    disliked: false,
    shuffle: false,
    repeat: 'off',
    durationSec: 0,
    abLoop: null,
};

let snapshot: TrayNp = EMPTY;
const snapListeners = new Set<() => void>();
export const getNp = (): TrayNp => snapshot;

export function subscribeNp(fn: () => void): () => void {
    snapListeners.add(fn);
    return () => snapListeners.delete(fn);
}

let position = 0;
const posListeners = new Set<() => void>();
export const getPosition = (): number => position;

export function subscribePosition(fn: () => void): () => void {
    posListeners.add(fn);
    return () => posListeners.delete(fn);
}

const hidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';

/** Optimistically patch the local snapshot for snappy UI before the main window echoes back. */
export function patchNp(patch: Partial<TrayNp>) {
    const next = {...snapshot, ...patch};
    if (areTraySnapshotsEqual(snapshot, next)) return;
    snapshot = next;
    for (const l of snapListeners) l();
}

/** Send a transport/control command to the main window (single source of truth). */
export function sendCmd(action: TrayCmd, value?: number) {
    void emit('tray:cmd', {action, value});
}

void listen<TrayNp>('tray:np', (e) => {
    if (areTraySnapshotsEqual(snapshot, e.payload)) return;
    snapshot = e.payload;
    for (const l of snapListeners) l();
});

void listen<number>('audio:tick', (e) => {
    position = e.payload;
    if (hidden()) return; // window minimized/hidden — skip the DOM fan-out (WebView doesn't throttle)
    for (const l of posListeners) l();
});

// On (re)show, ask the main window for a fresh snapshot and re-sync the position frame.
function requestSync() {
    void emit('tray:hello');
    for (const l of posListeners) l();
}

if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') requestSync();
    });
}

requestSync();
