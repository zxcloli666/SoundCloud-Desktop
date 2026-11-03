import {memo} from 'react';
import {AudioLines} from '../../lib/icons';
import {usePerfMode} from '../../lib/perf';
import {useViewerAura} from '../../lib/useViewerAura';

/** The login hero — a floating accent logo radiating sonar pulses, under a
 *  shimmer wordmark. The one thing you remember from the entry screen. */
export const BrandMark = memo(function BrandMark({subtitle}: { subtitle: string }) {
    const perf = usePerfMode();
    const aura = useViewerAura();
    return (
        <div className="flex flex-col items-center text-center">
            <div
                className="relative w-[84px] h-[84px] mb-6"
                style={{animation: perf.idleAnim ? 'auth-float 6s ease-in-out infinite' : undefined}}
            >
                {/* ambient glow */}
                <div
                    aria-hidden
                    className="absolute -inset-6 rounded-full"
                    style={{
                        background: 'radial-gradient(circle, var(--color-accent-glow), transparent 70%)',
                        filter: perf.glow ? 'blur(16px)' : undefined,
                    }}
                />
                {/* sonar pulses — sound radiating out */}
                {perf.idleAnim &&
                    [0, 1, 2].map((i) => (
                        <span
                            key={i}
                            aria-hidden
                            className="auth-anim absolute inset-0 rounded-[26px]"
                            style={{
                                border: '1px solid var(--color-accent)',
                                opacity: 0,
                                animation: `auth-sonar 3s ease-out ${i}s infinite`,
                            }}
                        />
                    ))}
                {/* logo tile */}
                <div
                    className="relative w-full h-full rounded-[26px] flex items-center justify-center"
                    style={{
                        background: 'linear-gradient(150deg, var(--color-accent), var(--color-accent-hover))',
                        boxShadow:
                            '0 14px 44px var(--color-accent-glow), 0 0 30px var(--color-accent-glow), inset 0 1px 0 rgba(255,255,255,0.32)',
                    }}
                >
                    <AudioLines size={36} strokeWidth={2} style={{color: 'var(--color-accent-contrast)'}}/>
                </div>
            </div>

            <h1
                className="text-[32px] font-black tracking-tight leading-none"
                style={{
                    backgroundImage: aura.nameGradient,
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    color: 'transparent',
                }}
            >
                SoundCloud
            </h1>
            <p className="text-[13px] text-ink-40 mt-2.5 min-h-[18px]">{subtitle}</p>
        </div>
    );
});
