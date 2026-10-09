import {memo} from 'react';
import {useTranslation} from 'react-i18next';
import {Power, Sparkles} from '../../../lib/icons';
import {usePerfMode} from '../../../lib/perf';
import {useSubscription} from '../../../lib/subscription';
import {useAuthStore} from '../../../stores/auth';
import {useSettingsStore} from '../../../stores/settings';
import {Card, LockedToggle, PremiumBadge, Row, Toggle} from '../primitives';

const SOON_PARTICLES = [
    {left: 8, top: 22, size: 3, dur: 3.4, delay: 0},
    {left: 22, top: 64, size: 2, dur: 4.1, delay: 0.6},
    {left: 41, top: 36, size: 3, dur: 3.7, delay: 1.1},
    {left: 58, top: 70, size: 2, dur: 4.4, delay: 0.3},
    {left: 74, top: 28, size: 3, dur: 3.2, delay: 1.5},
    {left: 88, top: 58, size: 2, dur: 4.0, delay: 0.9},
];

/** "Coming Soon" curtain over the bypass toggle — pointer-events-none so the
 *  underlying toggle still toggles (state persists, drives nothing yet). */
const ComingSoonOverlay = memo(function ComingSoonOverlay() {
    const {t} = useTranslation();
    const blur = usePerfMode().blur(10);
    return (
        <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden rounded-2xl"
            style={{
                background:
                    blur > 0
                        ? 'linear-gradient(135deg, rgba(30,15,50,0.62) 0%, rgba(20,10,40,0.58) 50%, rgba(15,8,30,0.62) 100%)'
                        : 'rgba(22,12,38,0.92)',
                backdropFilter: blur > 0 ? `blur(${blur}px) saturate(140%)` : undefined,
                WebkitBackdropFilter: blur > 0 ? `blur(${blur}px) saturate(140%)` : undefined,
                border: '0.5px solid rgba(168,85,247,0.35)',
                boxShadow:
                    '0 18px 50px rgba(0,0,0,0.35), 0 0 32px rgba(139,92,246,0.18), inset 0 1px 0 rgba(255,255,255,0.06)',
            }}
        >
            <div className="absolute inset-0" style={{contain: 'strict', transform: 'translateZ(0)'}}>
                {SOON_PARTICLES.map((p, i) => (
                    <span
                        key={i}
                        className="absolute rounded-full"
                        style={{
                            width: p.size,
                            height: p.size,
                            left: `${p.left}%`,
                            top: `${p.top}%`,
                            background: `hsl(${260 + ((i * 11) % 50)}, 80%, ${68 + ((i * 7) % 22)}%)`,
                            opacity: 0.55,
                            animation: `star-float ${p.dur}s ease-in-out ${p.delay}s infinite alternate`,
                        }}
                    />
                ))}
            </div>
            <div
                className="absolute inset-y-0 -left-1/3 w-2/3"
                style={{
                    background:
                        'linear-gradient(110deg, transparent 35%, rgba(255,255,255,0.10) 50%, transparent 65%)',
                    animation: 'sw-shine 3.6s linear infinite',
                }}
            />
            <div
                className="relative flex items-center gap-2 rounded-full px-4 py-1.5"
                style={{
                    background:
                        'linear-gradient(135deg, rgba(168,85,247,0.42), rgba(139,92,246,0.32) 50%, rgba(99,102,241,0.36))',
                    border: '0.5px solid rgba(168,85,247,0.55)',
                    boxShadow: '0 6px 22px rgba(139,92,246,0.32), inset 0 1px 0 rgba(255,255,255,0.14)',
                }}
            >
                <Sparkles
                    size={12}
                    className="text-amber-300"
                    style={{filter: 'drop-shadow(0 0 6px rgba(252,211,77,0.6))'}}
                />
                <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/95">
          {t('settings.bypassWhitelistSoon')}
        </span>
            </div>
        </div>
    );
});

export function NetworkCard() {
    const {t} = useTranslation();
    const bypassWhitelist = useSettingsStore((s) => s.bypassWhitelist);
    const setBypassWhitelist = useSettingsStore((s) => s.setBypassWhitelist);
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    const {data: isPremium} = useSubscription(isAuthenticated);

    return (
        <Card title={t('settings.bypassTitle')} icon={<Power size={17}/>}>
            <div className="space-y-1">
                {/* Bypass whitelist — functional toggle under a "coming soon" curtain */}
                <div className="relative -mx-2 px-2 rounded-2xl">
                    <Row title={t('settings.bypassWhitelist')} desc={t('settings.bypassWhitelistDesc')}>
                        {isPremium ? (
                            <Toggle
                                checked={bypassWhitelist}
                                onChange={() => setBypassWhitelist(!bypassWhitelist)}
                            />
                        ) : (
                            <>
                                <PremiumBadge/>
                                <LockedToggle/>
                            </>
                        )}
                    </Row>
                    <ComingSoonOverlay/>
                </div>
            </div>
        </Card>
    );
}
