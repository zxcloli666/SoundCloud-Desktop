import React, {useCallback, useEffect, useMemo, useRef} from 'react';
import {useTranslation} from 'react-i18next';
import {useNavigate} from 'react-router-dom';
import {AudioLines, ChevronRight, Sparkles} from '../../../lib/icons';
import {usePerfMode} from '../../../lib/perf';
import {useSearchPrefsStore} from '../../../stores/searchPrefs';

interface Props {
    className?: string;
}

/**
 * Liquid Glass Portal — a lit doorway carved into the frosted SoundWave hero.
 *
 * Depth is built from stacked light, not a single frosted rect: an accent
 * aurora blooms up from the floor, a cursor-tracked specular lens glides under
 * the surface, a constellation of accent motes drifts at rest and is drawn
 * toward the trailing » arrow on hover, and a row of marching chevrons surges
 * forward — pulling the eye through into discovery-by-feeling (/search vibe).
 *
 * Pointer lighting writes CSS vars on a ref (rAF-coalesced, zero React state).
 * Blur lives only in isolated GPU layers (contain:strict + translateZ(0)).
 */
const MOTES = Array.from({length: 7}, (_, i) => ({
    i,
    left: 10 + ((i * 41) % 64), // 10%..74%, biased left/centre
    top: 22 + ((i * 53) % 56),
    size: 2 + (i % 2),
    driftDur: 5200 + ((i * 313) % 3200),
    driftDelay: (i * 277) % 3200,
    pullDur: 460 + ((i * 71) % 320),
}));

export const VibePortal = React.memo(function VibePortal({className}: Props) {
    const {t} = useTranslation();
    const perf = usePerfMode();
    const navigate = useNavigate();
    const rootRef = useRef<HTMLButtonElement>(null);
    const rafRef = useRef(0);
    const pending = useRef<{ x: number; y: number } | null>(null);

    const open = useCallback(() => {
        useSearchPrefsStore.getState().setMode('vibe');
        navigate('/search');
        requestAnimationFrame(() => {
            (document.getElementById('global-search-input') as HTMLInputElement | null)?.focus();
        });
    }, [navigate]);

    // Cursor-tracked lensing + faint parallax. CSS vars on a ref, rAF-coalesced,
    // hover-gated. No setState per move. Parallax skipped under reduced-motion.
    useEffect(() => {
        const el = rootRef.current;
        if (!el) return;
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const flush = () => {
            rafRef.current = 0;
            const p = pending.current;
            if (!p) return;
            const r = el.getBoundingClientRect();
            const nx = (p.x - r.left) / r.width;
            const ny = (p.y - r.top) / r.height;
            el.style.setProperty('--mx', `${(nx * 100).toFixed(1)}%`);
            el.style.setProperty('--my', `${(ny * 100).toFixed(1)}%`);
            if (!reduce) el.style.setProperty('--px', `${((0.5 - nx) * 12).toFixed(1)}px`);
        };
        const onMove = (e: PointerEvent) => {
            pending.current = {x: e.clientX, y: e.clientY};
            if (!rafRef.current) rafRef.current = requestAnimationFrame(flush);
        };
        const onLeave = () => {
            el.style.setProperty('--mx', '50%');
            el.style.setProperty('--my', '0%');
            el.style.setProperty('--px', '0px');
        };
        el.addEventListener('pointermove', onMove);
        el.addEventListener('pointerleave', onLeave);
        return () => {
            el.removeEventListener('pointermove', onMove);
            el.removeEventListener('pointerleave', onLeave);
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, []);

    const moteCount = perf.particles(MOTES.length);
    const idleMotes = perf.idleAnim;
    const moteGlow = perf.glow;
    const motes = useMemo(
        () =>
            MOTES.slice(0, moteCount).map((m) => (
                <span
                    key={m.i}
                    className="vp-mote absolute rounded-full"
                    style={
                        {
                            left: `${m.left}%`,
                            top: `${m.top}%`,
                            width: `${m.size}px`,
                            height: `${m.size}px`,
                            background: 'var(--color-accent)',
                            boxShadow: moteGlow ? '0 0 6px var(--color-accent-glow)' : undefined,
                            '--vp-dx': `${88 - m.left}%`,
                            '--vp-dy': `${50 - m.top}%`,
                            '--vp-pdur': `${m.pullDur}ms`,
                            animationName: idleMotes ? undefined : 'none',
                            animationDuration: `${m.driftDur}ms`,
                            animationDelay: `${m.driftDelay}ms`,
                        } as React.CSSProperties
                    }
                />
            )),
        [moteCount, idleMotes, moteGlow],
    );

    return (
        <button
            ref={rootRef}
            type="button"
            onClick={open}
            aria-label={`${t('soundwave.vibeCta.title')} — ${t('soundwave.vibeCta.subtitle')}`}
            className={`vp-portal group relative isolate w-full h-[76px] overflow-hidden rounded-2xl text-left outline-none ${className ?? ''}`}
            style={{
                background:
                    'linear-gradient(165deg, rgb(var(--ink) / 0.075), rgb(var(--ink) / 0.022) 58%, rgb(var(--ink) / 0.05))',
                border: '0.5px solid rgb(var(--ink) / 0.14)',
                boxShadow:
                    '0 8px 26px rgb(var(--shade) / calc(0.34 * var(--shade-alpha))), inset 0 1px 0 rgba(255,255,255,0.09), inset 0 -18px 30px -22px var(--color-accent-glow)',
            }}
        >
            {/* Floor aurora — GPU-isolated, blooms up from the doorway sill. */}
            <span
                aria-hidden
                className="vp-aurora pointer-events-none absolute -inset-x-8 -bottom-12 h-28"
                style={{
                    background:
                        'radial-gradient(60% 100% at 50% 100%, var(--color-accent-glow), transparent 72%)',
                    filter: `blur(${perf.blur(26)}px)`,
                    contain: 'strict',
                    transform: 'translateZ(0)',
                    animation: perf.idleAnim ? 'sw-aurora 9s ease-in-out infinite' : undefined,
                }}
            />

            {/* Drifting accent motes — isolated GPU layer, translate+opacity only. */}
            <span
                aria-hidden
                className="vp-field pointer-events-none absolute inset-0"
                style={{contain: 'strict', transform: 'translateZ(0)'}}
            >
        {motes}
      </span>

            {/* Cursor-tracked specular lens, gliding under the glass. */}
            <span
                aria-hidden
                className="vp-lens pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100"
                style={{
                    background:
                        'radial-gradient(140px 90px at var(--mx,50%) var(--my,0%), rgb(var(--ink) / 0.16), transparent 60%)',
                    contain: 'strict',
                    transform: 'translateZ(0)',
                    transition: 'opacity 0.4s var(--ease-apple)',
                }}
            />

            {/* Content — isolated so text repaints never recompute the blur layers. */}
            <span
                className="relative flex h-full items-center gap-3.5 px-4"
                style={{isolation: 'isolate'}}
            >
        {/* Top specular sheen, parallax-shifted opposite the cursor. */}
                <span
                    aria-hidden
                    className="vp-sheen absolute inset-x-5 top-0 h-px"
                    style={{
                        background: 'linear-gradient(90deg, transparent, rgb(var(--ink) / 0.45), transparent)',
                        transform: 'translateX(var(--px,0px))',
                        transition: 'transform 0.3s var(--ease-apple)',
                    }}
                />
                {/* Sweeping gleam on hover. */}
                <span aria-hidden className="absolute inset-0 overflow-hidden rounded-2xl">
          <span className="vp-gleam absolute -inset-y-2 -left-1/3 w-1/3 opacity-0 group-hover:opacity-100">
            <span
                className="block h-full w-full"
                style={{
                    background:
                        'linear-gradient(90deg, transparent, rgb(var(--ink) / 0.2), transparent)',
                    transform: 'skewX(-18deg)',
                }}
            />
          </span>
        </span>

                {/* Sigil — an accent facet you peer into, carrying the app's audio glyph. */}
                <span
                    className="vp-sigil relative grid h-11 w-11 shrink-0 place-items-center rounded-xl"
                    style={{
                        background:
                            'radial-gradient(circle at 32% 28%, var(--color-accent-hover), var(--color-accent) 70%)',
                        border: '0.5px solid rgb(var(--ink) / 0.28)',
                        boxShadow:
                            '0 6px 18px var(--color-accent-glow), inset 0 1px 0 rgba(255,255,255,0.32), inset 0 -6px 10px -6px rgb(var(--shade) / calc(0.4 * var(--shade-alpha)))',
                    }}
                >
          <AudioLines
              size={18}
              style={{color: 'var(--color-accent-contrast)'}}
              strokeWidth={2.2}
          />
          <span
              aria-hidden
              className="vp-sigil-ring pointer-events-none absolute inset-0 rounded-xl"
              style={{border: '1px solid var(--color-accent)'}}
          />
        </span>

                {/* Title + evocative subtitle. */}
                <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="vp-title text-[15px] font-semibold leading-tight text-ink-95">
              {t('soundwave.vibeCta.title')}
            </span>
            <span
                className="inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-px text-[9px] font-bold uppercase tracking-[0.14em]"
                style={{
                    color: 'var(--color-accent-contrast)',
                    background: 'var(--color-accent)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25)',
                }}
            >
              <Sparkles size={9} style={{color: 'var(--color-accent-contrast)'}}/>
                {t('soundwave.vibeCta.badge')}
            </span>
          </span>
          <span className="mt-0.5 block truncate text-[12px] text-ink-50">
            {t('soundwave.vibeCta.subtitle')}
          </span>
        </span>

                {/* » motif — marching chevrons that surge forward, pulling toward /search. */}
                <span className="vp-march relative flex shrink-0 items-center pr-0.5" aria-hidden>
          {[0, 1, 2].map((i) => (
              <ChevronRight
                  key={i}
                  size={20}
                  strokeWidth={2.6}
                  className="vp-chev -ml-2.5"
                  style={{
                      color: 'var(--color-accent)',
                      opacity: 0.28 + i * 0.26,
                      animationName: perf.idleAnim ? undefined : 'none',
                      animationDelay: `${i * 0.16}s`,
                  }}
              />
          ))}
        </span>
      </span>

            {/* Focus-visible accent ring. */}
            <span
                aria-hidden
                className="vp-ring pointer-events-none absolute inset-0 rounded-2xl opacity-0"
                style={{boxShadow: '0 0 0 2px var(--color-accent), 0 0 22px var(--color-accent-glow)'}}
            />
        </button>
    );
});
