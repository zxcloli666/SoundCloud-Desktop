import {memo} from 'react';
import {useTranslation} from 'react-i18next';
import type {PerfMode} from '../../../lib/perf';
import {useSettingsStore} from '../../../stores/settings';
import {Card} from '../primitives';
import {SoftwareRenderingRow} from './SoftwareRenderingRow';

const PERF_CARDS: Array<{
    id: PerfMode;
    labelKey: string;
    descKey: string;
    orbBlur: number;
    motes: number;
}> = [
    {
        id: 'light',
        labelKey: 'settings.perfLight',
        descKey: 'settings.perfLightDesc',
        orbBlur: 0,
        motes: 0,
    },
    {
        id: 'medium',
        labelKey: 'settings.perfMedium',
        descKey: 'settings.perfMediumDesc',
        orbBlur: 9,
        motes: 2,
    },
    {
        id: 'beauty',
        labelKey: 'settings.perfBeauty',
        descKey: 'settings.perfBeautyDesc',
        orbBlur: 18,
        motes: 4,
    },
];

const PerfPreview = memo(function PerfPreview({
                                                  orbBlur,
                                                  motes,
                                              }: {
    orbBlur: number;
    motes: number;
}) {
    return (
        <div className="relative h-16 overflow-hidden bg-[#0c0c10]">
            {orbBlur > 0 && (
                <div
                    className="absolute -top-3 -left-2 h-16 w-16 rounded-full"
                    style={{
                        background: 'radial-gradient(circle, var(--color-accent-glow), transparent 70%)',
                        filter: `blur(${orbBlur}px)`,
                    }}
                />
            )}
            {Array.from({length: motes}, (_, i) => (
                <span
                    key={i}
                    className="absolute h-1 w-1 rounded-full"
                    style={{
                        left: `${18 + i * 22}%`,
                        top: `${28 + ((i * 37) % 42)}%`,
                        background: 'var(--color-accent)',
                        boxShadow: '0 0 4px var(--color-accent-glow)',
                    }}
                />
            ))}
            <div
                className="absolute inset-x-3 bottom-3 h-3 rounded-md border border-white/[0.08]"
                style={{background: orbBlur > 0 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.025)'}}
            />
        </div>
    );
});

export function PerformanceCard() {
    const {t} = useTranslation();
    const perfMode = useSettingsStore((s) => s.perfMode);
    const setPerfMode = useSettingsStore((s) => s.setPerfMode);

    return (
        <Card title={t('settings.performance')} desc={t('settings.performanceDesc')}>
            <div className="grid grid-cols-3 gap-3">
                {PERF_CARDS.map((card) => {
                    const active = perfMode === card.id;
                    return (
                        <button
                            key={card.id}
                            type="button"
                            onClick={() => setPerfMode(card.id)}
                            className={`group relative overflow-hidden rounded-2xl border text-left transition-all duration-200 cursor-pointer hover:scale-[1.03] active:scale-[0.97] ${
                                active
                                    ? 'border-white/30 ring-1 ring-white/20'
                                    : 'border-white/[0.06] hover:border-white/15'
                            }`}
                        >
                            <PerfPreview orbBlur={card.orbBlur} motes={card.motes}/>
                            <div className="bg-white/[0.03] px-3 py-2.5">
                <span
                    className={`block text-[12px] font-semibold ${active ? 'text-white/90' : 'text-white/55'}`}
                >
                  {t(card.labelKey)}
                </span>
                                <span className="mt-0.5 block text-[10px] leading-tight text-white/35">
                  {t(card.descKey)}
                </span>
                            </div>
                        </button>
                    );
                })}
            </div>
            <SoftwareRenderingRow/>
        </Card>
    );
}
