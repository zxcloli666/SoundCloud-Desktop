import React, {useEffect, useRef} from 'react';
import {useTranslation} from 'react-i18next';
import {getCurrentTime, subscribe} from '../../lib/audio';
import {durLong} from '../../lib/formatters';
import type {Comment} from '../../lib/hooks';
import type {Track} from '../../stores/player';
import {LiveWaveform} from '../music/soundwave/waveform';
import type {TrackAura} from './useTrackAura';
import {WaveVoices} from './WaveVoices';

/** The floor of the room: the live waveform, recolored to the track's own hue
 *  (scoped --color-accent), with voices plotted on it and a time ruler. */
export const RoomFloor = React.memo(function RoomFloor({
                                                           track,
                                                           isCurrent,
                                                           comments,
                                                           aura,
                                                           onSeek,
                                                       }: {
    track: Track;
    isCurrent: boolean;
    comments: Comment[];
    aura: TrackAura;
    onSeek: (seconds: number) => void;
}) {
    const {t} = useTranslation();
    const elapsedRef = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        if (!isCurrent) {
            if (elapsedRef.current) elapsedRef.current.textContent = '0:00';
            return;
        }
        let lastSecond = -1;
        const paint = () => {
            const second = Math.floor(getCurrentTime());
            if (second === lastSecond) return;
            lastSecond = second;
            if (elapsedRef.current) elapsedRef.current.textContent = durLong(second * 1000);
        };
        paint();
        return subscribe(paint);
    }, [isCurrent]);

    const durationMs = track.full_duration ?? track.duration;
    const playableFrac = durationMs > 0 ? Math.min(1, track.duration / durationMs) : 1;
    const previewTail = track.access === 'preview' && playableFrac < 0.995 ? 1 - playableFrac : 0;

    return (
        <div
            className="relative"
            style={
                {
                    '--color-accent': aura.accent,
                    '--color-accent-glow': aura.accentGlow,
                } as React.CSSProperties
            }
        >
            <div className="relative w-full">
                <LiveWaveform track={track} isCurrent={isCurrent}/>
                {previewTail > 0 && (
                    <div
                        className="absolute inset-y-0 right-0 pointer-events-none rounded-r-lg"
                        style={{
                            width: `${previewTail * 100}%`,
                            background:
                                'linear-gradient(90deg, transparent, rgba(8,8,10,0.55) 40%, rgba(8,8,10,0.7))',
                        }}
                        title={t('track.previewOnly')}
                    />
                )}
                <WaveVoices
                    comments={comments}
                    durationMs={durationMs}
                    isCurrent={isCurrent}
                    onSeek={onSeek}
                />
            </div>
            <div className="flex items-center justify-between mt-2.5 px-0.5 text-[11px] tabular-nums text-white/35">
                <span ref={elapsedRef}>0:00</span>
                {previewTail > 0 && (
                    <span className="text-white/25 uppercase tracking-[0.18em] text-[9px]">
            {t('track.previewOnly')}
          </span>
                )}
                <span>{durLong(track.duration)}</span>
            </div>
        </div>
    );
});
