import type { SettingsState } from '../../stores/settings';
import { useSettingsStore } from '../../stores/settings';
import { useThemesStore } from '../../stores/themes';
import { applyAccentVars, applyBgVars, applyScheme } from '../apply-theme';
import { applyCustomCss, effectiveCustomCss } from '../custom-css';
import { applyFontVars, type InterfaceFont } from '../interface-font';
import { fitAccent, resolveScheme, type Scheme, systemScheme, WHITE_BG } from '../scheme';
import { syncThemeCss } from './apply';
import type { InstalledVersion } from './files';
import { themeFont } from './fonts';
import { activeLook } from './records';

export type LookSettings = Pick<
  SettingsState,
  | 'scheme'
  | 'accentColor'
  | 'bgPrimary'
  | 'coverAccent'
  | 'interfaceFont'
  | 'customFontName'
  | 'customFontFile'
>;

export interface EffectiveLook {
  scheme: Scheme;
  accent: string;
  bg: string;
  font: { id: InterfaceFont; name: string; file: string };
}

export function effectiveLook(
  settings: LookSettings,
  look: InstalledVersion | null,
  palette: { accent: string | null } | null,
  system: Scheme,
): EffectiveLook {
  const scheme = look ? (look.scheme ?? 'dark') : resolveScheme(settings.scheme, system);
  const userAccent = (settings.coverAccent && palette?.accent) || settings.accentColor;
  return {
    scheme,
    accent: look?.accent || fitAccent(userAccent, scheme),
    bg: look?.background || (scheme === 'white' ? WHITE_BG : settings.bgPrimary),
    font: look?.font
      ? { id: themeFont(look.font), name: '', file: '' }
      : {
          id: settings.interfaceFont,
          name: settings.customFontName,
          file: settings.customFontFile,
        },
  };
}

export async function applyLook(safe = false): Promise<boolean> {
  const settings = useSettingsStore.getState();
  const look = safe ? null : activeLook(useThemesStore.getState());
  const { scheme, accent, bg, font } = effectiveLook(settings, look, null, systemScheme());
  applyScheme(scheme);
  applyAccentVars(accent);
  applyBgVars(bg);
  void applyFontVars(font.id, font.name, font.file);
  const applied = await syncThemeCss(look);
  applyCustomCss(safe ? '' : effectiveCustomCss(settings));
  return applied;
}
