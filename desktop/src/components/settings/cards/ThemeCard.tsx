import {useRef} from 'react';
import {useTranslation} from 'react-i18next';
import {Sparkles} from '../../../lib/icons';
import {activeLook} from '../../../lib/themes/records';
import {THEME_PRESETS, useSettingsStore} from '../../../stores/settings';
import {useThemesStore} from '../../../stores/themes';
import {Card} from '../primitives';
import {SchemePicker} from './SchemePicker';
import {ThemeOverrideRow} from './ThemeOverrideRow';

const THEME_PRESET_KEYS = ['soundcloud', 'dark', 'neon', 'forest', 'crimson'] as const;

const PRESET_COLORS = [
    '#ff5500',
    '#ff3366',
    '#7c3aed',
    '#3b82f6',
    '#06b6d4',
    '#10b981',
    '#eab308',
    '#ef4444',
    '#f97316',
    '#8b5cf6',
];

export function ThemeCard() {
    const {t} = useTranslation();
    const accentColor = useSettingsStore((s) => s.accentColor);
    const themePreset = useSettingsStore((s) => s.themePreset);
    const setAccentColor = useSettingsStore((s) => s.setAccentColor);
    const setThemePreset = useSettingsStore((s) => s.setThemePreset);
    const resetTheme = useSettingsStore((s) => s.resetTheme);
    const look = useThemesStore(activeLook);
    const colorInputRef = useRef<HTMLInputElement>(null);

    return (
        <Card
            title={t('settings.appearance')}
            icon={<Sparkles size={17}/>}
            action={
                <button
                    type="button"
                    onClick={() => {
                        resetTheme();
                        useThemesStore.getState().deactivate();
                    }}
                    className="text-[12px] text-ink-30 hover:text-ink-60 transition-colors cursor-pointer"
                >
                    {t('settings.resetDefaults')}
                </button>
            }
        >
            <div className="space-y-6">
                {look && (
                    <ThemeOverrideRow label={t('settings.themesColorsFromTheme', {name: look.name})}/>
                )}
                <SchemePicker/>
                <div className="space-y-3">
                    <label className="text-[13px] text-ink-50 font-medium">
                        {t('settings.themePreset')}
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                        {THEME_PRESET_KEYS.map((id) => {
                            const def = THEME_PRESETS[id];
                            const isActive = themePreset === id;
                            return (
                                <button
                                    key={id}
                                    type="button"
                                    onClick={() => setThemePreset(id)}
                                    className={`group relative rounded-2xl overflow-hidden border transition-all duration-200 cursor-pointer hover:scale-[1.03] active:scale-[0.97] ${
                                        isActive
                                            ? 'border-ink/30 ring-1 ring-ink/20'
                                            : 'border-ink/[0.06] hover:border-ink/15'
                                    }`}
                                >
                                    <div
                                        className="relative h-16 overflow-hidden"
                                        style={{backgroundColor: def.preview[1]}}
                                    >
                                        <div
                                            className="absolute left-3 top-3 w-5 h-5 rounded-full"
                                            style={{backgroundColor: def.preview[0]}}
                                        />
                                        <div
                                            className="absolute right-3 bottom-2 left-3 h-6 rounded-lg"
                                            style={{backgroundColor: def.preview[2]}}
                                        />
                                    </div>
                                    <div className="px-3 py-2 bg-ink/[0.03] text-center">
                    <span
                        className={`text-[12px] font-medium ${isActive ? 'text-ink-90' : 'text-ink-50'}`}
                    >
                      {t(`settings.theme_${id}`)}
                    </span>
                                    </div>
                                </button>
                            );
                        })}
                        <button
                            type="button"
                            onClick={() => {
                                setThemePreset('custom');
                                colorInputRef.current?.click();
                            }}
                            className={`group relative rounded-2xl overflow-hidden border border-dashed transition-all duration-200 cursor-pointer hover:scale-[1.03] active:scale-[0.97] ${
                                themePreset === 'custom'
                                    ? 'border-ink/30 bg-ink/[0.04]'
                                    : 'border-ink/[0.1] hover:border-ink/20'
                            }`}
                        >
                            <div className="h-16 flex items-center justify-center">
                <span className="text-[20px] text-ink-30 group-hover:text-ink-50 transition-colors">
                  +
                </span>
                            </div>
                            <div className="px-3 py-2 bg-ink/[0.02] text-center">
                <span
                    className={`text-[12px] font-medium ${themePreset === 'custom' ? 'text-ink-90' : 'text-ink-40'}`}
                >
                  {t('settings.themeCustom')}
                </span>
                            </div>
                        </button>
                    </div>
                </div>

                {themePreset === 'custom' && (
                    <div className="space-y-3">
                        <label className="text-[13px] text-ink-50 font-medium">
                            {t('settings.accentColor')}
                        </label>
                        <div className="flex items-center gap-2 flex-wrap">
                            {PRESET_COLORS.map((color) => (
                                <button
                                    key={color}
                                    type="button"
                                    onClick={() => setAccentColor(color)}
                                    className="w-8 h-8 rounded-full border-2 transition-all duration-200 cursor-pointer hover:scale-110 active:scale-95 shadow-md"
                                    style={{
                                        backgroundColor: color,
                                        borderColor: accentColor === color ? 'white' : 'transparent',
                                        boxShadow: accentColor === color ? `0 0 16px ${color}60` : undefined,
                                    }}
                                />
                            ))}
                            <button
                                type="button"
                                onClick={() => colorInputRef.current?.click()}
                                className="w-8 h-8 rounded-full border-2 border-dashed border-ink/20 hover:border-ink/40 transition-all cursor-pointer flex items-center justify-center text-ink-30 hover:text-ink-60 hover:scale-110"
                            >
                                <span className="text-[11px] font-bold">+</span>
                            </button>
                        </div>
                    </div>
                )}

                <input
                    ref={colorInputRef}
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="sr-only"
                />
            </div>
        </Card>
    );
}
