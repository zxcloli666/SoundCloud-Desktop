import {getCurrentWindow} from '@tauri-apps/api/window';
import {
    Heart,
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
import {formatTime} from '../lib/formatters';
import {getNp, getPosition, patchNp, sendCmd, subscribeNp, subscribePosition} from './state';

const t = (key: string) => i18n.t(key);

/** Explicit close — the reliable dismiss on compositors where focus-based hide is flaky. */
const hideSelf = () => void getCurrentWindow().hide();

const bloomEnabled = () => document.documentElement.dataset.perf !== 'light';
const VOLUME_SEND_INTERVAL_MS = 40;

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

    const paintTo = (clientX: number) => {
        const d = getNp().durationSec || duration;
        if (d <= 0) return;
        const pct = (valueAt(clientX) / d) * 100;
        if (fillRef.current) fillRef.current.style.width = `${Math.max(0, Math.min(100, pct))}%`;
    };

    const onPointerDown = (e: React.PointerEvent) => {
        const d = getNp().durationSec || duration;
        if (d <= 0) return;
        draggingRef.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        paintTo(e.clientX);
    };

    return (
        <div
            ref={trackRef}
            className="tp-scrub group"
            onPointerDown={onPointerDown}
            onPointerMove={(event) => {
                if (draggingRef.current) paintTo(event.clientX);
            }}
            onPointerUp={(event) => {
                if (!draggingRef.current) return;
                draggingRef.current = false;
                sendCmd('seek', valueAt(event.clientX));
            }}
            onPointerCancel={() => {
                draggingRef.current = false;
            }}
            onLostPointerCapture={() => {
                draggingRef.current = false;
            }}
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

function VolumeControl({volume}: { volume: number }) {
    const trackRef = useRef<HTMLDivElement>(null);
    const fillRef = useRef<HTMLDivElement>(null);
    const draggingRef = useRef(false);
    const pendingVolumeRef = useRef(volume);
    const lastVolumeSendRef = useRef(0);
    const volumeSendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const valueAt = useCallback((clientX: number) => {
        const el = trackRef.current;
        if (!el) return volume;
        const rect = el.getBoundingClientRect();
        if (rect.width <= 0) return volume;
        const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        return Math.round(pct * 100);
    }, [volume]);

    const sendPendingVolume = useCallback(() => {
        if (volumeSendTimerRef.current) {
            clearTimeout(volumeSendTimerRef.current);
            volumeSendTimerRef.current = null;
        }
        lastVolumeSendRef.current = performance.now();
        sendCmd('volume', pendingVolumeRef.current);
    }, []);

    const scheduleVolumeSend = useCallback(() => {
        const remaining = VOLUME_SEND_INTERVAL_MS - (performance.now() - lastVolumeSendRef.current);
        if (remaining <= 0) {
            sendPendingVolume();
        } else if (!volumeSendTimerRef.current) {
            volumeSendTimerRef.current = setTimeout(sendPendingVolume, remaining);
        }
    }, [sendPendingVolume]);

    useEffect(
        () => () => {
            if (volumeSendTimerRef.current) clearTimeout(volumeSendTimerRef.current);
        },
        [],
    );

    const paintAt = (clientX: number) => {
        const next = valueAt(clientX);
        pendingVolumeRef.current = next;
        if (fillRef.current) fillRef.current.style.width = `${next}%`;
        scheduleVolumeSend();
    };

    const onPointerDown = (e: React.PointerEvent) => {
        draggingRef.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        paintAt(e.clientX);
    };

    const Icon = volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2;
    const pct = Math.min(100, (volume / 100) * 100);

    return (
        <div className="tp-vol">
            <button
                type="button"
                className="tp-icon-btn"
                onClick={() => {
                    const v = volume > 0 ? 0 : 50;
                    patchNp({volume: v});
                    sendCmd('volume', v);
                }}
            >
                <Icon size={15}/>
            </button>
            <div
                ref={trackRef}
                className="tp-vol-track group"
                onPointerDown={onPointerDown}
                onPointerMove={(event) => {
                    if (draggingRef.current) paintAt(event.clientX);
                }}
                onPointerUp={() => {
                    if (!draggingRef.current) return;
                    draggingRef.current = false;
                    const next = pendingVolumeRef.current;
                    patchNp({volume: next});
                    sendPendingVolume();
                }}
                onPointerCancel={() => {
                    if (draggingRef.current) {
                        patchNp({volume: pendingVolumeRef.current});
                        sendPendingVolume();
                    }
                    draggingRef.current = false;
                }}
                onLostPointerCapture={() => {
                    if (draggingRef.current) {
                        patchNp({volume: pendingVolumeRef.current});
                        sendPendingVolume();
                    }
                    draggingRef.current = false;
                }}
            >
                <div ref={fillRef} className="tp-vol-fill" style={{width: `${pct}%`}}/>
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
        <div className="tp" data-playing={playing ? 'true' : 'false'}>
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
                        <VolumeControl volume={np.volume}/>
                    </div>
                </div>
            </div>
        </div>
    );
}
