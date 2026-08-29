import React, {useEffect, useMemo, useRef} from 'react';
import {useTranslation} from 'react-i18next';
import {getCurrentTime, getDuration, subscribe} from '../../lib/audio';
import {art, durLong} from '../../lib/formatters';
import type {Comment} from '../../lib/hooks';

interface Dot {
    pct: number;
    comment: Comment;
    count: number;
}

const SLOTS = 46;
const BLOOM_MS = 4600;

function firstDotAfter(dots: Dot[], pct: number): number {
    let lo = 0;
    let hi = dots.length;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (dots[mid].pct <= pct) lo = mid + 1;
        else hi = mid;
    }
    return lo;
}

/** Comments live ON the wave: a faint dot at each timestamped comment's moment.
 *  Hover peeks it; click jumps there; and while this track plays, a dot blooms
 *  upward as the playhead sweeps past it — all DOM-driven, no per-frame React. */
export const WaveVoices = React.memo(function WaveVoices({
                                                             comments,
                                                             durationMs,
                                                             isCurrent,
                                                             onSeek,
                                                         }: {
    comments: Comment[];
    durationMs: number;
    isCurrent: boolean;
    onSeek: (seconds: number) => void;
}) {
    const {t} = useTranslation();

    const dots = useMemo<Dot[]>(() => {
        if (!durationMs || durationMs <= 0) return [];
        const slots = new Map<number, Dot>();
        for (const c of comments) {
            if (c.timestamp == null || !c.body) continue;
            const pct = Math.min(1, Math.max(0, c.timestamp / durationMs));
            const slot = Math.min(SLOTS - 1, Math.round(pct * SLOTS));
            const hit = slots.get(slot);
            if (hit) hit.count++;
            else slots.set(slot, {pct, comment: c, count: 1});
        }
        return [...slots.values()].sort((a, b) => a.pct - b.pct);
    }, [comments, durationMs]);

    const elsRef = useRef<(HTMLElement | null)[]>([]);
    const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

    // Bloom a dot when the live playhead sweeps past it (natural advance only —
    // a seek jump is skipped so we don't burst-bloom). Pure DOM, no React.
    useEffect(() => {
        const timers = timersRef.current;
        if (!isCurrent || dots.length === 0) return;
        let prev = (() => {
            const d = getDuration();
            return d > 0 ? getCurrentTime() / d : 0;
        })();
        let cursor = firstDotAfter(dots, prev);

        const tick = () => {
            const d = getDuration();
            if (d <= 0) return;
            const cur = Math.min(1, Math.max(0, getCurrentTime() / d));
            const delta = cur - prev;
            if (delta > 0 && delta < 0.03) {
                while (cursor < dots.length && dots[cursor].pct <= cur) {
                    if (dots[cursor].pct > prev) bloom(cursor);
                    cursor++;
                }
            } else if (delta < 0 || delta >= 0.03) {
                // A backwards/large jump is a seek: skip the burst and place the
                // cursor directly after the new playhead for subsequent natural ticks.
                cursor = firstDotAfter(dots, cur);
            }
            prev = cur;
        };

        const bloom = (i: number) => {
            const el = elsRef.current[i];
            if (!el) return;
            el.dataset.bloom = '1';
            const old = timers.get(i);
            if (old) clearTimeout(old);
            timers.set(
                i,
                setTimeout(() => {
                    if (elsRef.current[i]) elsRef.current[i]!.dataset.bloom = '0';
                    timers.delete(i);
                }, BLOOM_MS),
            );
        };

        const unsub = subscribe(tick);
        return () => {
            unsub();
            for (const id of timers.values()) clearTimeout(id);
            timers.clear();
        };
    }, [isCurrent, dots]);

    if (dots.length === 0) return null;

    return (
        <div className="absolute inset-0 pointer-events-none z-10">
            {dots.map((d, i) => (
                <button
                    key={d.comment.id}
                    type="button"
                    data-bloom="0"
                    ref={(el) => {
                        elsRef.current[i] = el;
                    }}
                    onClick={() => onSeek((d.comment.timestamp ?? 0) / 1000)}
                    title={t('track.seekTo', {time: durLong(d.comment.timestamp ?? 0)})}
                    className="wv-dot group/dot absolute bottom-0 pointer-events-auto cursor-pointer"
                    style={{left: `${d.pct * 100}%`}}
                >
                    <span
                        className="wv-pip block w-[7px] h-[7px] -translate-x-1/2 rounded-full bg-accent shadow-[0_0_8px_var(--color-accent-glow)] transition-transform duration-200 group-hover/dot:scale-150"/>
                    <span
                        className="wv-pill absolute bottom-[140%] left-0 z-20 flex items-center gap-2 max-w-[240px] w-max px-3 py-2 rounded-2xl"
                        style={{
                            background: 'rgba(22,22,28,0.92)',
                            border: '0.5px solid rgba(255,255,255,0.12)',
                            boxShadow: '0 16px 40px rgba(0,0,0,0.5), inset 0 0.5px 0 rgba(255,255,255,0.1)',
                        }}
                    >
            <img
                src={art(d.comment.user.avatar_url, 'small') ?? ''}
                alt=""
                loading="lazy"
                className="w-6 h-6 rounded-full shrink-0 object-cover"
            />
            <span className="min-w-0 text-left">
              <span className="block text-[12px] text-white/85 leading-snug truncate">
                {d.comment.body}
              </span>
                {d.count > 1 && (
                    <span className="block text-[10px] text-accent/90 tabular-nums">
                  {t('track.voicesHere', {count: d.count})}
                </span>
                )}
            </span>
          </span>
                </button>
            ))}
        </div>
    );
});
