import React from 'react';
import ReactDOM from 'react-dom/client';
import {changeAppLanguage} from '../i18n';
import {applyAccentVars, applyBgVars, applyPerfMode} from '../lib/apply-theme';
import {setupVisibilityGate} from '../lib/perf';
import {useSettingsStore} from '../stores/settings';
import '../fonts';
import '../index.css';
import './tray.css';
import {MiniPlayer} from './MiniPlayer';

/** Mirror the main window's accent/perf theming into this separate webview context. */
function applyTheme() {
    const s = useSettingsStore.getState();
    applyAccentVars(s.accentColor);
    applyBgVars(s.bgPrimary);
    applyPerfMode(s.perfMode);
}

/**
 * Поповер — окно фиксированного логического размера (384×248). Если webview-DPR
 * расходится со scale окна (под CEF бывает — главное окно лечит это в
 * `fixWebviewScale`), CSS-вьюпорт не совпадает с дизайном и флайаут «разъезжается».
 * Корректируем зумом scaleFactor/devicePixelRatio в обе стороны; при совпадении
 * (wry, целочисленный scale) — no-op.
 */
async function fixPopoverScale() {
    try {
        const {getCurrentWindow} = await import('@tauri-apps/api/window');
        const {getCurrentWebview} = await import('@tauri-apps/api/webview');
        const scale = await getCurrentWindow().scaleFactor();
        const dpr = window.devicePixelRatio || 1;
        const ratio = scale / dpr;
        if (Math.abs(ratio - 1) > 0.02) {
            await getCurrentWebview().setZoom(ratio);
        }
    } catch {}
}

async function bootstrap() {
    await fixPopoverScale();
    await useSettingsStore.persist.rehydrate();
    applyTheme();
    await changeAppLanguage(useSettingsStore.getState().language);

    ReactDOM.createRoot(document.getElementById('tray-root')!).render(
        <React.StrictMode>
            <MiniPlayer/>
        </React.StrictMode>,
    );

    setupVisibilityGate();

    // Re-pick theme/language changes made in the main window each time the popover re-shows
    // (separate store instance — it only reads the shared on-disk state on demand).
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;
        void Promise.resolve(useSettingsStore.persist.rehydrate()).then(applyTheme);
    });
}

void bootstrap();
