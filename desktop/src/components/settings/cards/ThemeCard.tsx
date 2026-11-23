import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Palette, Plus, RotateCcw } from '../../../lib/icons';
import { activeLook } from '../../../lib/themes/records';
import { THEME_PRESETS, useSettingsStore } from '../../../stores/settings';
import { useThemesStore } from '../../../stores/themes';
import { Card, Row } from '../primitives';
import { SchemePicker } from './SchemePicker';
import { ThemeOverrideRow } from './ThemeOverrideRow';

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
  const { t } = useTranslation();
  const accentColor = useSettingsStore((s) => s.accentColor);
  const themePreset = useSettingsStore((s) => s.themePreset);
  const setAccentColor = useSettingsStore((s) => s.setAccentColor);
  const setThemePreset = useSettingsStore((s) => s.setThemePreset);
  const resetTheme = useSettingsStore((s) => s.resetTheme);
  const look = useThemesStore(activeLook);
  const colorInputRef = useRef<HTMLInputElement>(null);

  return (
    <Card
      title={t('settings.colors')}
      icon={<Palette size={17} />}
      action={
        <button
          type="button"
          onClick={() => {
            resetTheme();
            useThemesStore.getState().deactivate();
          }}
          className="set-btn"
          data-tone="quiet"
        >
          <RotateCcw size={13} />
          {t('settings.resetDefaults')}
        </button>
      }
    >
      {look && (
        <ThemeOverrideRow label={t('settings.themesColorsFromTheme', { name: look.name })} />
      )}
      <SchemePicker />
      <Row title={t('settings.themePreset')} stacked>
        <div className="grid w-full grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2.5">
          {THEME_PRESET_KEYS.map((id) => {
            const def = THEME_PRESETS[id];
            return (
              <button
                key={id}
                type="button"
                data-active={themePreset === id}
                onClick={() => setThemePreset(id)}
                className="set-tile"
              >
                <span className="set-tile-art h-12" style={{ backgroundColor: def.preview[1] }}>
                  <span
                    className="absolute top-2.5 left-2.5 h-4 w-4 rounded-full"
                    style={{ backgroundColor: def.preview[0] }}
                  />
                  <span
                    className="absolute right-2.5 bottom-2 left-2.5 h-4 rounded-[5px]"
                    style={{ backgroundColor: def.preview[2] }}
                  />
                </span>
                <span className="set-tile-label text-center">{t(`settings.theme_${id}`)}</span>
              </button>
            );
          })}
          <button
            type="button"
            data-active={themePreset === 'custom'}
            onClick={() => {
              setThemePreset('custom');
              colorInputRef.current?.click();
            }}
            className="set-tile"
          >
            <span className="set-tile-art flex h-12 items-center justify-center border border-dashed border-[color:var(--shell-line-hi)] text-ink-45">
              <Plus size={16} />
            </span>
            <span className="set-tile-label text-center">{t('settings.themeCustom')}</span>
          </button>
        </div>
      </Row>
      {themePreset === 'custom' && (
        <Row title={t('settings.accentColor')} stacked>
          <div className="flex flex-wrap items-center gap-2.5">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={color}
                onClick={() => setAccentColor(color)}
                className={`h-7 w-7 cursor-pointer rounded-full outline-offset-2 transition-[outline-color] duration-150 ${
                  accentColor === color ? 'outline-2 outline-ink' : 'outline-2 outline-transparent'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
            <button
              type="button"
              aria-label={t('settings.themeCustom')}
              onClick={() => colorInputRef.current?.click()}
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-dashed border-[color:var(--shell-line-hi)] text-ink-45 transition-colors duration-150 hover:text-ink"
            >
              <Plus size={13} />
            </button>
          </div>
        </Row>
      )}
      <input
        ref={colorInputRef}
        type="color"
        value={accentColor}
        onChange={(e) => setAccentColor(e.target.value)}
        className="sr-only"
      />
    </Card>
  );
}
