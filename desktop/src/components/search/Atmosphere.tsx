import {memo} from 'react';
import {usePerfMode} from '../../lib/perf';

interface AtmosphereProps {
    /** 1-3 hues pulled from the vibe of what's on the wall. Falls back to accent. */
    tint?: string[];
    /** 0 (calm/cold) .. 1 (hot/fast) — scales orb drift speed. */
    energy?: number;
}

/* Three blurred orbs, mix-blend-screen, GPU-isolated so the breathing wall in
 * front never recomputes their blur. The color says what's on the wall; the
 * drift speed says its energy. Not decoration — meaning. */
export const Atmosphere = memo(function Atmosphere({tint, energy = 0.5}: AtmosphereProps) {
    const perf = usePerfMode();
    const c0 = tint?.[0] ?? 'var(--color-accent)';
    const c1 = tint?.[1] ?? tint?.[0] ?? 'var(--color-accent)';
    // energy 0 → slow (×1.6), energy 1 → fast (×0.6)
    const k = 1.6 - energy * 1.0;
    const d = (base: number) => `${(base * k).toFixed(1)}s`;

    // Light: a single flat low-opacity radial tint — no blur, no drift, no blend.
    if (!perf.atmosphere) {
        return (
            <div
                className="fixed inset-0 pointer-events-none overflow-hidden"
                style={{contain: 'strict', transform: 'translateZ(0)'}}
            >
                <div
                    className="absolute -top-[22%] -left-[12%] w-[78vw] h-[78vw] rounded-full"
                    style={{
                        background: `radial-gradient(circle, ${c0} 0%, transparent 62%)`,
                        opacity: tint?.length ? 0.12 : 0.08,
                    }}
                />
            </div>
        );
    }

    // Medium: drop the third orb (still drifting, half-blur) — beauty keeps all 3.
    const thirdOrb = perf.particles(3) >= 3;
    // Beauty keeps the original breathing scale; medium uses translate-only drift
    // so the 120-160px blur kernel isn't re-rasterized every frame.
    const drift = perf.mode === 'beauty' ? 'tg-orb-drift' : 'tg-orb-drift-lite';

    return (
        <div
            className="fixed inset-0 pointer-events-none overflow-hidden"
            style={{contain: 'strict', transform: 'translateZ(0)'}}
        >
            <div
                className="tg-orb absolute -top-[22%] -left-[12%] w-[78vw] h-[78vw] rounded-full mix-blend-screen"
                style={{
                    background: `radial-gradient(circle, ${c0} 0%, transparent 62%)`,
                    opacity: tint?.length ? 0.42 : 0.34,
                    filter: `blur(${perf.blur(120)}px)`,
                    animation: `${drift} ${d(24)} ease-in-out infinite`,
                    transition: 'opacity 1200ms ease, background 1200ms ease',
                }}
            />
            <div
                className="tg-orb absolute -top-[6%] -right-[24%] w-[72vw] h-[72vw] rounded-full mix-blend-screen"
                style={{
                    background: `radial-gradient(circle, ${c1} 0%, transparent 66%)`,
                    opacity: 0.24,
                    filter: `blur(${perf.blur(150)}px)`,
                    animation: `${drift} ${d(30)} ease-in-out -10s infinite`,
                    transition: 'opacity 1200ms ease, background 1200ms ease',
                }}
            />
            {thirdOrb && (
                <div
                    className="tg-orb absolute -bottom-[22%] left-[16%] w-[72vw] h-[72vw] rounded-full mix-blend-screen"
                    style={{
                        background: `radial-gradient(circle, ${c1} 0%, rgb(var(--ink) / 0.4) 45%, transparent 60%)`,
                        opacity: tint?.length ? 0.26 : 0.16,
                        filter: `blur(${perf.blur(160)}px)`,
                        animation: `${drift} ${d(36)} ease-in-out -18s infinite`,
                        transition: 'opacity 1200ms ease, background 1200ms ease',
                    }}
                />
            )}
        </div>
    );
});
