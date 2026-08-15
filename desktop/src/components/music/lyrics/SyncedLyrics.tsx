import {invoke} from '@tauri-apps/api/core';
import {listen} from '@tauri-apps/api/event';
import React, {useEffect, useRef} from 'react';
import {useTranslation} from 'react-i18next';
import {getCurrentTime, seek} from '../../../lib/audio';
import {Search} from '../../../lib/icons';
import type {LyricLine, LyricsSource} from '../../../lib/lyrics';
import {usePerfMode} from '../../../lib/perf';
import {usePlayerStore} from '../../../stores/player';

const SOURCE_LABELS: Record<LyricsSource, string> = {
    lrclib: 'LRCLib',
    musixmatch: 'Musixmatch',
    genius: 'Genius',
    netease: 'NetEase',
    self_gen: 'AI',
    none: '',
};

function clamp01(v: number) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
}

function isAnimatedChar(ch: string) {
    return !/^\s$/u.test(ch);
}

interface CharCell {
    ch: string;
    animated: boolean;
}

function splitChars(text: string): CharCell[] {
    // Use Array.from to handle surrogate pairs / emoji as single grapheme-ish units.
    return Array.from(text).map((ch) => ({ch, animated: isAnimatedChar(ch)}));
}

function splitWordsForChars(cells: CharCell[]): CharCell[][] {
    // Group consecutive cells of same kind (animated vs whitespace) so words stay together
    // and don't break across lines mid-word.
    const groups: CharCell[][] = [];
    let cur: CharCell[] = [];
    let curKind: boolean | null = null;
    for (const c of cells) {
        if (c.animated !== curKind) {
            if (cur.length) groups.push(cur);
            cur = [c];
            curKind = c.animated;
        } else {
            cur.push(c);
        }
    }
    if (cur.length) groups.push(cur);
    return groups;
}

export const SyncedLyrics = React.memo(({lines}: { lines: LyricLine[] }) => {
    const perf = usePerfMode();
    const perChar = perf.mode !== 'light';
    const containerRef = useRef<HTMLDivElement>(null);
    const activeRef = useRef(-1);
    const linesRef = useRef(lines);
    const lineElsRef = useRef<HTMLElement[]>([]);
    const lineCharElsRef = useRef<HTMLElement[][]>([]);
    const manualScrollRef = useRef(false);
    const lastScrollTsRef = useRef(0);
    const lineProgressRef = useRef(0);
    linesRef.current = lines;

    // biome-ignore lint/correctness/useExhaustiveDependencies: perChar changes rendered lyric nodes.
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        lineElsRef.current = Array.from(container.querySelectorAll<HTMLElement>('.lyric-line'));
        lineCharElsRef.current = lineElsRef.current.map((el) =>
            Array.from(el.querySelectorAll<HTMLElement>('[data-char-index]')),
        );
        activeRef.current = -1;
        lineProgressRef.current = 0;
        manualScrollRef.current = false;

        const markManual = () => {
            manualScrollRef.current = true;
        };
        container.addEventListener('wheel', markManual, {passive: true});
        container.addEventListener('touchstart', markManual, {passive: true});
        container.addEventListener('pointerdown', markManual);

        void invoke('audio_set_lyrics_timeline', {
            lines: lines.map((line) => ({timeSecs: line.time})),
        });

        /** Per-char "head" sweeps left-to-right across the line.
         *  Each char's local progress is `head - charIndex`, smoothed.
         *  Slight forward leak (`+SOFT_LEAD`) so the leading char visibly lights up
         *  before becoming the active char — mimics the karaoke-style sweep. */
        const SOFT_LEAD = 0.6;
        const SOFT_TAIL = 1.4;

        const writeLineProgress = (i: number, p: number) => {
            const el = lineElsRef.current[i];
            if (!el) return;
            const value = clamp01(p);
            el.style.setProperty('--lyric-progress', `${(value * 100).toFixed(2)}%`);
            el.style.setProperty('--lyric-progress-value', value.toFixed(4));

            const chars = lineCharElsRef.current[i];
            if (chars && chars.length > 0) {
                const total = chars.length;
                const head = value * total;
                for (let c = 0; c < total; c++) {
                    const local = clamp01((head - c + SOFT_LEAD) / SOFT_TAIL);
                    // smoothstep
                    const eased = local * local * (3 - 2 * local);
                    chars[c].style.setProperty('--char-progress', eased.toFixed(4));
                }
            }

        };

        const setLineState = (i: number, state: string) => {
            const el = lineElsRef.current[i];
            if (!el || el.dataset.state === state) return;
            el.dataset.state = state;

            if (state === 'past' || state === 'past-near') {
                writeLineProgress(i, 1);
            } else if (state === 'next' || state === 'next-near') {
                writeLineProgress(i, 0);
            }
        };

        const unlistenPromise = listen<number | null>('lyrics:active_line', (event) => {
            const lineEls = lineElsRef.current;
            if (!container || lineEls.length === 0) return;

            const idx = typeof event.payload === 'number' ? event.payload : -1;
            if (idx === activeRef.current) return;

            const prev = activeRef.current;
            activeRef.current = idx;
            lineProgressRef.current = 0;

            for (let i = 0; i < lineEls.length; i++) {
                let state: string;
                if (i === idx) state = 'active';
                else if (i === idx - 1) state = 'past-near';
                else if (i === idx + 1) state = 'next-near';
                else if (idx >= 0 && i < idx) state = 'past';
                else state = 'next';
                setLineState(i, state);
            }

            if (idx >= 0 && idx < lineEls.length && !manualScrollRef.current) {
                const el = lineEls[idx];
                const top = el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2;
                const now = performance.now();
                const behavior =
                    now - lastScrollTsRef.current < 220 || prev === -1 || Math.abs(idx - prev) > 2
                        ? 'auto'
                        : 'smooth';
                container.scrollTo({top, behavior});
                lastScrollTsRef.current = now;
            }
        });

        let rafId = 0;
        let lastTickTs = 0;
        const FRAME_BUDGET_MS = 33; // ~30fps — sweep is per-char so 30fps still looks smooth
        const tick = (ts: number) => {
            // Park the rAF entirely while hidden; visibilitychange restarts it.
            if (document.visibilityState === 'hidden') {
                rafId = 0;
                return;
            }
            rafId = requestAnimationFrame(tick);
            if (ts - lastTickTs < FRAME_BUDGET_MS) return;
            lastTickTs = ts;

            const idx = activeRef.current;
            if (idx < 0 || idx >= linesRef.current.length) return;
            const cur = linesRef.current[idx];
            const next = linesRef.current[idx + 1];
            const dur = Math.max(0.4, (next?.time ?? cur.time + 2.6) - cur.time);
            const target = clamp01((getCurrentTime() - cur.time) / dur);

            const prev = lineProgressRef.current;
            const diff = target - prev;
            const smoothed =
                diff < 0 ? target : prev + diff * (diff > 0.18 || target > 0.92 ? 0.7 : 0.32);
            lineProgressRef.current = smoothed;
            writeLineProgress(idx, smoothed);
        };
        rafId = requestAnimationFrame(tick);

        const onVisibility = () => {
            if (document.visibilityState !== 'hidden' && !rafId) {
                lastTickTs = 0;
                rafId = requestAnimationFrame(tick);
            }
        };
        document.addEventListener('visibilitychange', onVisibility);

        const applyPaused = (paused: boolean) => {
            container.classList.toggle('lyrics-paused', paused);
        };
        applyPaused(!usePlayerStore.getState().isPlaying);
        const unsubPlayer = usePlayerStore.subscribe((s, prev) => {
            if (s.isPlaying !== prev.isPlaying) applyPaused(!s.isPlaying);
        });

        return () => {
            cancelAnimationFrame(rafId);
            document.removeEventListener('visibilitychange', onVisibility);
            container.removeEventListener('wheel', markManual);
            container.removeEventListener('touchstart', markManual);
            container.removeEventListener('pointerdown', markManual);
            void invoke('audio_clear_lyrics_timeline');
            unlistenPromise.then((unlisten) => unlisten());
            unsubPlayer();
        };
    }, [lines, perChar]);

    return (
        <div
            ref={containerRef}
            className="flex-1 overflow-y-auto scrollbar-hide px-12 py-16 relative"
            style={{
                maskImage: 'linear-gradient(transparent 0%, black 10%, black 90%, transparent 100%)',
            }}
        >
            <div className="flex flex-col gap-2">
                {lines.map((line, i) => {
                    if (!perChar) {
                        // Light: per-line highlight only — no per-char spans (hundreds of
                        // text-shadow nodes). The active line lights up via its [data-state]
                        // line styling (index.css), not the per-char sweep.
                        return (
                            <div
                                key={`${line.time}-${i}`}
                                className="lyric-line"
                                onClick={() => {
                                    manualScrollRef.current = false;
                                    seek(line.time);
                                }}
                            >
                                <span className="lyric-fill">{line.text}</span>
                            </div>
                        );
                    }
                    const cells = splitChars(line.text);
                    const groups = splitWordsForChars(cells);
                    // animatedIndex must be stable across whole line (chars-only count) so
                    // CSS sweep aligns with visible glyphs only, ignoring whitespace.
                    let animatedIndex = 0;
                    return (
                        <div
                            key={`${line.time}-${i}`}
                            className="lyric-line"
                            onClick={() => {
                                manualScrollRef.current = false;
                                seek(line.time);
                            }}
                        >
              <span className="lyric-fill">
                {groups.map((group, gi) => {
                    if (group.length === 0) return null;
                    const isWhitespace = !group[0].animated;
                    if (isWhitespace) {
                        return <span key={gi}>{group.map((c) => c.ch).join('')}</span>;
                    }
                    return (
                        <span key={gi} className="lyric-word">
                      {group.map((c, ci) => {
                          const idx = animatedIndex++;
                          return (
                              <span key={ci} className="lyric-char" data-char-index={idx}>
                            {c.ch}
                          </span>
                          );
                      })}
                    </span>
                    );
                })}
              </span>
                        </div>
                    );
                })}
            </div>
            <div className="h-[40vh]"/>
        </div>
    );
});

export const PlainLyrics = React.memo(({text}: { text: string }) => (
    <div
        className="flex-1 overflow-y-auto scrollbar-hide px-12 py-16"
        style={{maskImage: 'linear-gradient(transparent 0%, black 10%, black 90%, transparent 100%)'}}
    >
        <div className="text-[22px] text-white/70 font-semibold whitespace-pre-wrap leading-loose tracking-tight">
            {text}
        </div>
    </div>
));

export const LyricsSourceBadge = React.memo(
    ({source, onSearch}: { source: LyricsSource; onSearch: () => void }) => {
        const {t} = useTranslation();
        const label = source === 'self_gen' ? t('track.selfGenerated') : SOURCE_LABELS[source];
        return (
            <div className="flex items-center justify-between px-12 pt-3 pb-0">
                {label ? (
                    <span
                        className="text-[10px] font-semibold text-white/20 bg-white/[0.04] px-2 py-0.5 rounded-full border border-white/[0.06]">
            {label}
          </span>
                ) : (
                    <span/>
                )}
                <button
                    type="button"
                    onClick={onSearch}
                    className="w-8 h-8 flex items-center justify-center rounded-full text-white/30 hover:text-white/70 hover:bg-white/10 transition-colors cursor-pointer"
                    aria-label={t('track.manualSearch')}
                >
                    <Search size={14}/>
                </button>
            </div>
        );
    },
);
