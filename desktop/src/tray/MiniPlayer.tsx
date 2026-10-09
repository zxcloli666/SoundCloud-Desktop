import {
    Heart,
    ListPlus,
    Maximize2,
    Pause,
    Play,
    Repeat,
    Repeat1,
    Shuffle,
    SkipBack,
    SkipForward,
    ThumbsDown,
    Volume1,
    Volume2,
    VolumeX,
    X,
} from 'lucide-react';
import {useCallback, useEffect, useRef, useState, useSyncExternalStore} from 'react';
import i18n from '../i18n';
import {trackedInvoke as invoke} from '../lib/diagnostics';
import {formatTime} from '../lib/formatters';
import {snapVolume} from '../lib/volume';
import {getNp, getPosition, patchNp, sendCmd, subscribeNp, subscribePosition} from './state';

const t = (key: string) => i18n.t(key);

/** Explicit close — the reliable dismiss on compositors where focus-based hide is flaky. */
const hideSelf = () => void invoke('tray_popover_hide');

const bloomEnabled = () => document.documentElement.dataset.perf !== 'light';

/** Replays the entrance animation each time the popover is re-shown. */
function useShowPulse(): number {
    const [pulse, setPulse] = useState(0);
    useEffect(() => {
        const onVis = () => {
            if (document.visibilityState === 'visible') setPulse((p) => p + 1);
        };
        document.addEventListener('visibilitychange', onVis);
        return () => document.removeEventListener('visibilitychange', onVis);
    }, []);
    return pulse;
}

/* ── Scrubber (custom pointer-drag, DOM-driven fill — no per-tick re-render) ── */

function Scrubber({duration}: { duration: number }) {
    const trackRef = useRef<HTMLDivElement>(null);
    const fillRef = useRef<HTMLDivElement>(null);
    const draggingRef = useRef(false);

    // Live fill from the broadcast tick, written straight to the DOM.
    useEffect(() => {
        const paint = () => {
            if (draggingRef.current) return;
            const d = getNp().durationSec || duration;
            const pct = d > 0 ? Math.min(100, (getPosition() / d) * 100) : 0;
            if (fillRef.current) fillRef.current.style.width = `${pct}%`;
        };
        paint();
        return subscribePosition(paint);
    }, [duration]);

    const valueAt = (clientX: number): number => {
        const el = trackRef.current;
        if (!el) return 0;
        const rect = el.getBoundingClientRect();
        if (rect.width <= 0) return 0;
        const d = getNp().durationSec || duration;
        const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        return pct * d;
    };

    const onPointerDown = (e: React.PointerEvent) => {
        const d = getNp().durationSec || duration;
        if (d <= 0) return;
        draggingRef.current = true;
        const paintTo = (clientX: number) => {
            const pct = (valueAt(clientX) / d) * 100;
            if (fillRef.current) fillRef.current.style.width = `${Math.max(0, Math.min(100, pct))}%`;
        };
        paintTo(e.clientX);
        const onMove = (ev: PointerEvent) => paintTo(ev.clientX);
        const onUp = (ev: PointerEvent) => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            const v = valueAt(ev.clientX);
            draggingRef.current = false;
            sendCmd('seek', v);
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
    };

    return (
        <div
            ref={trackRef}
            className="tp-scrub group"
            data-tauri-drag-region="false"
            onPointerDown={onPointerDown}
        >
            <div className="tp-scrub-track">
                <div ref={fillRef} className="tp-scrub-fill"/>
            </div>
        </div>
    );
}

function TimeRow({duration}: { duration: number }) {
    const cur = useSyncExternalStore(subscribePosition, () => Math.floor(getPosition()));
    return (
        <div className="tp-times">
            <span>{formatTime(cur)}</span>
            <span>{formatTime(duration)}</span>
        </div>
    );
}

/* ── Volume (custom drag) ───────────────────────────────────────── */

const TRAY_SNAP_POINTS = [50, 100];

function VolumeControl({volume}: { volume: number }) {
    const trackRef = useRef<HTMLDivElement>(null);
    const set = useCallback((clientX: number, precise: boolean) => {
        const el = trackRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        if (rect.width <= 0) return;
        const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const raw = Math.round(pct * 100);
        const v = precise ? raw : snapVolume(raw, 100 / rect.width, TRAY_SNAP_POINTS);
        patchNp({volume: v});
        sendCmd('volume', v);
    }, []);

    const onPointerDown = (e: React.PointerEvent) => {
        set(e.clientX, e.shiftKey);
        const onMove = (ev: PointerEvent) => set(ev.clientX, ev.shiftKey);
        const onUp = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
    };

    const Icon = volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2;
    const pct = Math.min(100, (volume / 100) * 100);

    return (
        <div className="tp-vol">
            <button
                type="button"
                className="tp-icon-btn"
                onClick={() => sendCmd('mute_toggle')}
            >
                <Icon size={15}/>
            </button>
            <div
                ref={trackRef}
                className="tp-vol-track group"
                data-tauri-drag-region="false"
                title={t('player.volumeResetHint')}
                onPointerDown={onPointerDown}
                onDoubleClick={() => {
                    patchNp({volume: 100});
                    sendCmd('volume', 100);
                }}
            >
                <div className="tp-vol-fill" style={{width: `${pct}%`}}/>
            </div>
        </div>
    );
}

/* ── MiniPlayer ─────────────────────────────────────────────────── */

export function MiniPlayer() {
    const np = useSyncExternalStore(subscribeNp, getNp);
    const pulse = useShowPulse();
    const [bloom] = useState(bloomEnabled);

    const playing = np.isPlaying;
    const RepeatIcon = np.repeat === 'one' ? Repeat1 : Repeat;

    return (
        <div className="tp" data-ui="tray" data-playing={playing ? 'true' : 'false'} data-tauri-drag-region="deep">
            <div className="tp-dock" key={pulse}>
                {bloom && np.artworkLarge && (
                    <div
                        className="tp-aura"
                        style={{backgroundImage: `url(${np.artworkLarge})`}}
                        aria-hidden="true"
                    />
                )}
                <div className="npb-glass"/>

                <div className="tp-content">
                    {/* header: art + title/artist + open-app */}
                    <div className="tp-head">
                        <button
                            type="button"
                            className="npb-art tp-art"
                            title={t('player.openApp')}
                            onClick={() => sendCmd('show')}
                        >
                            {np.artworkUrl ? <img src={np.artworkUrl} alt=""/> : <div className="npb-artfb"/>}
                            <span className="npb-ring"/>
                            <span className="npb-eq">
                <i/>
                <i/>
                <i/>
                <i/>
              </span>
                        </button>

                        <div className="tp-meta">
                            <span className="tp-title">{np.hasTrack ? np.title : t('player.notPlaying')}</span>
                            {np.hasTrack && <span className="tp-artist">{np.artist}</span>}
                        </div>

                        <button
                            type="button"
                            className="tp-icon-btn tp-open"
                            title={t('player.openApp')}
                            onClick={() => sendCmd('show')}
                        >
                            <Maximize2 size={15}/>
                        </button>
                        <button
                            type="button"
                            className="tp-icon-btn"
                            title={t('common.close')}
                            onClick={hideSelf}
                        >
                            <X size={16}/>
                        </button>
                    </div>

                    {/* scrubber */}
                    <div className="tp-lane">
                        <Scrubber duration={np.durationSec}/>
                        <TimeRow duration={np.durationSec}/>
                    </div>

                    {/* transport */}
                    <div className="tp-transport">
                        <button
                            type="button"
                            className={`tp-icon-btn ${np.shuffle ? 'is-active' : ''}`}
                            title={t('player.shuffle')}
                            onClick={() => sendCmd('shuffle')}
                        >
                            <Shuffle size={16}/>
                        </button>
                        <button
                            type="button"
                            className="tp-icon-btn"
                            title={t('player.previous')}
                            onClick={() => sendCmd('prev')}
                        >
                            <SkipBack size={19}/>
                        </button>
                        <button
                            type="button"
                            className="npb-play tp-play"
                            title={playing ? t('track.pause') : t('track.play')}
                            onClick={() => sendCmd('play_pause')}
                        >
                            {playing ? (
                                <Pause size={20} fill="currentColor"/>
                            ) : (
                                <Play size={20} fill="currentColor"/>
                            )}
                        </button>
                        <button
                            type="button"
                            className="tp-icon-btn"
                            title={t('player.next')}
                            onClick={() => sendCmd('next')}
                        >
                            <SkipForward size={19}/>
                        </button>
                        <button
                            type="button"
                            className={`tp-icon-btn ${np.repeat !== 'off' ? 'is-active' : ''}`}
                            title={t('player.repeat')}
                            onClick={() => sendCmd('repeat')}
                        >
                            <RepeatIcon size={16}/>
                        </button>
                    </div>

                    {/* footer: reactions + volume */}
                    <div className="tp-foot">
                        <button
                            type="button"
                            className={`tp-icon-btn ${np.liked ? 'is-like' : ''}`}
                            title={t('track.likes')}
                            onClick={() => sendCmd('like')}
                        >
                            <Heart size={16} fill={np.liked ? 'currentColor' : 'none'}/>
                        </button>
                        <button
                            type="button"
                            className={`tp-icon-btn ${np.disliked ? 'is-dislike' : ''}`}
                            title={np.disliked ? t('track.removeDislike') : t('track.dislike')}
                            onClick={() => sendCmd('dislike')}
                        >
                            <ThumbsDown size={16} fill={np.disliked ? 'currentColor' : 'none'}/>
                        </button>
                        <button
                            type="button"
                            className="tp-icon-btn"
                            title={t('playlist.addToPlaylist')}
                            aria-label={t('playlist.addToPlaylist')}
                            onClick={() => {
                                sendCmd('add_to_playlist');
                                hideSelf();
                            }}
                        >
                            <ListPlus size={16}/>
                        </button>
                        <VolumeControl volume={np.volume}/>
                    </div>
                </div>
            </div>
        </div>
    );
}
