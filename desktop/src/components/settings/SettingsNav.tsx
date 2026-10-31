import {useTranslation} from 'react-i18next';
import {usePerfMode} from '../../lib/perf';
import type {SettingsCategory, SettingsCategoryId} from './registry';

/** Left rail — a sticky frosted panel of category pills, lit by the accent. */
export function SettingsNav({
                                categories,
                                active,
                                onChange,
                            }: {
    categories: SettingsCategory[];
    active: SettingsCategoryId;
    onChange: (id: SettingsCategoryId) => void;
}) {
    const {t} = useTranslation();
    const blur = usePerfMode().blur(40);
    return (
        <nav data-ui="settings-nav" className="w-[212px] shrink-0 hidden md:block">
            <div
                className="sticky top-8 rounded-[1.75rem] p-2.5"
                style={{
                    border: '0.5px solid rgb(var(--ink) / 0.07)',
                    background:
                        blur > 0
                            ? 'linear-gradient(180deg, rgb(var(--ink) / 0.045), rgb(var(--ink) / 0.012))'
                            : 'rgb(var(--surface) / 0.85)',
                    backdropFilter: blur > 0 ? `blur(${blur}px) saturate(1.3)` : undefined,
                    WebkitBackdropFilter: blur > 0 ? `blur(${blur}px) saturate(1.3)` : undefined,
                    boxShadow: '0 18px 50px rgb(var(--shade) / calc(0.35 * var(--shade-alpha))), inset 0 1px 0 rgba(255,255,255,0.05)',
                }}
            >
                <div className="flex flex-col gap-1">
                    {categories.map((c) => {
                        const on = c.id === active;
                        return (
                            <button
                                key={c.id}
                                type="button"
                                data-ui="settings-nav-item"
                                aria-current={on ? 'true' : undefined}
                                onClick={() => onChange(c.id)}
                                className={`group relative flex items-center gap-3 h-11 pl-3.5 pr-3 rounded-2xl text-[13.5px] font-semibold text-left transition-all duration-200 cursor-pointer ${
                                    on ? 'text-ink' : 'text-ink-45 hover:text-ink-85 hover:bg-ink/[0.05]'
                                }`}
                                style={
                                    on
                                        ? {
                                            background:
                                                'linear-gradient(180deg, var(--color-accent-glow), transparent), rgb(var(--ink) / 0.06)',
                                            boxShadow:
                                                '0 0 22px var(--color-accent-glow), inset 0 0.5px 0 rgba(255,255,255,0.16)',
                                        }
                                        : undefined
                                }
                            >
                                {on && (
                                    <span
                                        aria-hidden
                                        className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full"
                                        style={{
                                            background: 'var(--color-accent)',
                                            boxShadow: '0 0 10px var(--color-accent)',
                                        }}
                                    />
                                )}
                                <span
                                    className={`transition-colors duration-200 ${
                                        on ? 'text-[var(--color-accent)]' : 'text-ink-40 group-hover:text-ink-70'
                                    }`}
                                >
                  {c.icon}
                </span>
                                {t(c.labelKey)}
                            </button>
                        );
                    })}
                </div>
            </div>
        </nav>
    );
}
