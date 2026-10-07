import { invoke } from '@tauri-apps/api/core';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useSettingsStore } from '../stores/settings';
import { applyCustomCss, effectiveCustomCss, isCustomCssHotkey } from './custom-css';

export function useCustomCss() {
  const { t } = useTranslation();
  const css = useSettingsStore(effectiveCustomCss);

  useEffect(() => {
    applyCustomCss(css);
  }, [css]);

  useEffect(() => {
    invoke<boolean>('custom_css_suppressed')
      .then((suppressed) => {
        if (suppressed) useSettingsStore.getState().setCustomCssEnabled(false);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isCustomCssHotkey(e) || e.repeat) return;
      const { customCss, customCssEnabled, setCustomCssEnabled } = useSettingsStore.getState();
      if (!customCss.trim()) return;
      e.preventDefault();
      setCustomCssEnabled(!customCssEnabled);
      toast(t(customCssEnabled ? 'settings.customCssOffToast' : 'settings.customCssOnToast'));
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [t]);
}
