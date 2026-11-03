import { useEffect } from 'react';
import {applyAccentVars, applyBgVars, applyPerfMode, applyScheme} from '../lib/apply-theme';
import {useCoverPalette} from '../lib/cover-palette';
import {applyFontVars} from '../lib/interface-font';
import {useSystemScheme} from '../lib/scheme';
import {setupFocusGate, setupVisibilityGate} from '../lib/perf';
import {effectiveLook} from '../lib/themes/look';
import {activeLook} from '../lib/themes/records';
import {useThemes} from '../lib/themes/use-themes';
import {useCustomCss} from '../lib/use-custom-css';
import { useSettingsStore } from '../stores/settings';
import {useThemesStore} from '../stores/themes';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const schemeChoice = useSettingsStore((s) => s.scheme);
  const accentColor = useSettingsStore((s) => s.accentColor);
  const bgPrimary = useSettingsStore((s) => s.bgPrimary);
  const perfMode = useSettingsStore((s) => s.perfMode);
  const interfaceFont = useSettingsStore((s) => s.interfaceFont);
  const customFontName = useSettingsStore((s) => s.customFontName);
  const customFontFile = useSettingsStore((s) => s.customFontFile);
  const coverAccent = useSettingsStore((s) => s.coverAccent);
  const look = useThemesStore(activeLook);
  const palette = useCoverPalette(coverAccent);
  const system = useSystemScheme();
  const { scheme, accent, bg, font } = effectiveLook(
    { scheme: schemeChoice, accentColor, bgPrimary, coverAccent, interfaceFont, customFontName, customFontFile },
    look,
    palette,
    system,
  );
  useCustomCss();
  useThemes();

  // One global gate that pauses every CSS animation while the window is hidden
  // (the WebView does not throttle timers/rAF). Install once.
  useEffect(() => {
    setupVisibilityGate();
    setupFocusGate();
  }, []);

  // Drives index.css `[data-perf="…"]` rules (glass blur radii, idle-animation gates).
  useEffect(() => {
      applyPerfMode(perfMode);
  }, [perfMode]);

  useEffect(() => {
      applyScheme(scheme);
  }, [scheme]);

  useEffect(() => {
      applyAccentVars(accent);
  }, [accent]);

  useEffect(() => {
      void applyFontVars(font.id, font.name, font.file);
  }, [font.id, font.name, font.file]);

  useEffect(() => {
      applyBgVars(bg);
      document.documentElement.style.backgroundColor = bg;
  }, [bg]);

  return <>{children}</>;
}
