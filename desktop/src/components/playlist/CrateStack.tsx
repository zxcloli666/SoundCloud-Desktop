import React, {useMemo} from 'react';
import {art} from '../../lib/formatters';
import type {Playlist} from '../../lib/hooks';
import {ListMusic, pauseBlack22, playBlack22} from '../../lib/icons';
import {usePerfMode} from '../../lib/perf';
import type {Track} from '../../stores/player';

/** Seeded fan — index 0 is the front sleeve, rest lean behind it. No randomness. */
const FAN = [
    {rot: 0, x: 0, y: 0, s: 1, z: 50},
    {rot: 6, x: 17, y: 7, s: 0.965, z: 40},
    {rot: -7, x: -17, y: 9, s: 0.95, z: 30},
    {rot: 11, x: 31, y: 15, s: 0.93, z: 20},
    {rot: -12, x: -31, y: 17, s: 0.91, z: 10},
] as const;

const SLEEVE_SHADOW =
    '0 24px 50px rgb(var(--shade) / calc(0.5 * var(--shade-alpha))), inset 0 0 0 0.5px rgba(255,255,255,0.1), inset 0 1px 0 rgba(255,255,255,0.14)';

/** The Crate: a fanned stack of the playlist's real track artworks — a
 *  collection made visible, never a single disc. Click = play the set. */
export const CrateStack = React.memo(function CrateStack({
                                                             playlist,
                                                             tracks,
                                                             isPlaying,
                                                             trackCount,
                                                             onPlay,
                                                         }: {
    playlist: Playlist;
    tracks: Track[];
    isPlaying: boolean;
    trackCount: number;
    onPlay: () => void;
}) {
    const perf = usePerfMode();
    const max = perf.mode === 'light' ? 1 : perf.mode === 'medium' ? 3 : 5;

    const covers = useMemo(() => {
        const urls: string[] = [];
        const seen = new Set<string>();
        const push = (u: string | null) => {
            if (u && !seen.has(u)) {
                seen.add(u);
                urls.push(u);
            }
        };
        push(art(playlist.artwork_url, 't200x200'));
        for (const tr of tracks) {
            if (urls.length >= max) break;
            push(art(tr.artwork_url, 't200x200'));
        }
        return urls.slice(0, max);
    }, [playlist.artwork_url, tracks, max]);

    return (
        <button
            type="button"
            onClick={onPlay}
            aria-label={playlist.title}
            className="relative shrink-0 self-center lg:self-start group/crate cursor-pointer w-[150px] h-[150px] md:w-[200px] md:h-[200px]"
            style={{perspective: '1000px'}}
        >
            {covers.length === 0 && (
                <div
                    className="absolute inset-0 rounded-[1.7rem] flex items-center justify-center"
                    style={{background: 'rgb(var(--ink) / 0.04)', boxShadow: SLEEVE_SHADOW}}
                >
                    <ListMusic size={56} className="text-ink-15"/>
                </div>
            )}

            {covers.map((url, i) => {
                const f = FAN[i] ?? FAN[FAN.length - 1];
                const isFront = i === 0;
                return (
                    <div
                        key={url}
                        className={perf.idleAnim ? 'crate-sleeve-in' : ''}
                        style={{
                            position: 'absolute',
                            inset: 0,
                            zIndex: f.z,
                            animationDelay: perf.idleAnim ? `${(covers.length - 1 - i) * 70}ms` : undefined,
                        }}
                    >
                        <div
                            className="w-full h-full rounded-[1.7rem] overflow-hidden transition-transform duration-500 ease-[var(--ease-apple)]"
                            style={{
                                transform: `rotate(${f.rot}deg) translate(${f.x}px, ${f.y}px) scale(${f.s})`,
                                boxShadow: SLEEVE_SHADOW,
                            }}
                        >
                            <img
                                src={url}
                                alt=""
                                decoding="async"
                                loading="lazy"
                                className={`w-full h-full object-cover ${
                                    isFront ? 'transition-transform duration-700 group-hover/crate:scale-[1.05]' : ''
                                }`}
                            />
                            {isFront && (
                                <div
                                    className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${
                                        isPlaying
                                            ? 'bg-black/25 opacity-100'
                                            : 'bg-black/0 opacity-0 group-hover/crate:bg-black/30 group-hover/crate:opacity-100'
                                    }`}
                                >
                  <span
                      className={`w-14 h-14 rounded-full bg-white flex items-center justify-center shadow-2xl transition-transform duration-300 ease-[var(--ease-apple)] ${
                          isPlaying ? 'scale-100' : 'scale-75 group-hover/crate:scale-100'
                      }`}
                  >
                    {isPlaying ? pauseBlack22 : playBlack22}
                  </span>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}

            <span
                className="absolute -bottom-2 -right-1 z-[60] inline-flex items-center gap-1 text-[10px] font-bold tabular-nums px-2.5 py-1 rounded-full text-ink-85"
                style={{
                    background: 'rgb(var(--paper) / 0.75)',
                    border: '0.5px solid rgb(var(--ink) / 0.14)',
                    boxShadow: '0 8px 20px rgb(var(--shade) / calc(0.4 * var(--shade-alpha)))',
                }}
            >
        <ListMusic size={10}/>
                {trackCount}
      </span>
        </button>
    );
});
