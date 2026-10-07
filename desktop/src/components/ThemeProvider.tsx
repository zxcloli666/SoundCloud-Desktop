import { useEffect } from 'react';
import {applyAccentVars, applyBgVars, applyPerfMode} from '../lib/apply-theme';
import {setupFocusGate, setupVisibilityGate} from '../lib/perf';
import { useSettingsStore } from '../stores/settings';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const accentColor = useSettingsStore((s) => s.accentColor);
  const bgPrimary = useSettingsStore((s) => s.bgPrimary);
  const perfMode = useSettingsStore((s) => s.perfMode);

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
      applyAccentVars(accentColor);
  }, [accentColor]);

  useEffect(() => {
      applyBgVars(bgPrimary);
      document.documentElement.style.backgroundColor = bgPrimary;
  }, [bgPrimary]);

  return <>{children}</>;
}
