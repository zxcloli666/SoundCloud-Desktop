import { useEffect } from 'react';
import {applyAccentVars, applyBgVars, applyPerfMode} from '../lib/apply-theme';
import {useCoverPalette} from '../lib/cover-palette';
import {applyFontVars} from '../lib/interface-font';
import {setupFocusGate, setupVisibilityGate} from '../lib/perf';
import {useCustomCss} from '../lib/use-custom-css';
import { useSettingsStore } from '../stores/settings';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const accentColor = useSettingsStore((s) => s.accentColor);
  const bgPrimary = useSettingsStore((s) => s.bgPrimary);
  const perfMode = useSettingsStore((s) => s.perfMode);
  const interfaceFont = useSettingsStore((s) => s.interfaceFont);
  const customFontName = useSettingsStore((s) => s.customFontName);
  const coverAccent = useSettingsStore((s) => s.coverAccent);
  const palette = useCoverPalette(coverAccent);
  const effectiveAccent = (coverAccent && palette?.accent) || accentColor;
  useCustomCss();

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
      applyAccentVars(effectiveAccent);
  }, [effectiveAccent]);

  useEffect(() => {
      void applyFontVars(interfaceFont, customFontName);
  }, [interfaceFont, customFontName]);

  useEffect(() => {
      applyBgVars(bgPrimary);
      document.documentElement.style.backgroundColor = bgPrimary;
  }, [bgPrimary]);

  return <>{children}</>;
}
