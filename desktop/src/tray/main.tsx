import {listen} from '@tauri-apps/api/event';
import React from 'react';
import ReactDOM from 'react-dom/client';
import {changeAppLanguage} from '../i18n';
import {applyPerfMode} from '../lib/apply-theme';
import {setServerPorts} from '../lib/constants';
import {trackedInvoke as invoke} from '../lib/diagnostics';
import {setupFocusGate, setupVisibilityGate} from '../lib/perf';
import {applyThemeCss} from '../lib/themes/apply';
import {applyLook} from '../lib/themes/look';
import {probeTheme} from '../lib/themes/probe';
import {activeLook} from '../lib/themes/records';
import {miniPlayerStockOpacity, useSettingsStore} from '../stores/settings';
import {useThemesStore} from '../stores/themes';
import '../index.css';
import './tray.css';
import {MiniPlayer} from './MiniPlayer';

let brokenHash: string | null = null;
let passedHash: string | null = null;

function applyCardOpacity(opacity: number | null) {
    const stock = miniPlayerStockOpacity(useSettingsStore.getState().perfMode);
    const alpha = opacity ?? stock;
    const root = document.documentElement.style;
    root.setProperty('--tp-card-fade', String(Math.min(1, alpha / stock)));
    root.setProperty('--tp-card-fill', String(Math.max(0, (alpha - stock) / (1 - stock))));
}

function applySolid(solid: boolean) {
    document.documentElement.toggleAttribute('data-tp-solid', solid);
}

async function applyTheme(safe = false) {
    const settings = useSettingsStore.getState();
    applyPerfMode(settings.perfMode);
    applyCardOpacity(settings.miniPlayerOpacity);
    applySolid(settings.miniPlayerSolid);
    const hash = activeLook(useThemesStore.getState())?.hash ?? null;
    if (!(await applyLook(safe))) return;
    if (hash === brokenHash) {
        applyThemeCss('');
        return;
    }
    if (safe || hash === passedHash) return;
    void probeTheme('tray').then((failed) => {
        if (!failed.length) {
            passedHash = hash;
            return;
        }
        brokenHash = hash;
        applyThemeCss('');
    });
}

async function rehydrate() {
    await useSettingsStore.persist.rehydrate();
    await useThemesStore.persist.rehydrate();
}

/**
 * Поповер — окно фиксированного логического размера (384×248). Если webview-DPR
 * расходится со scale окна (главное окно лечит это в `lib/ui-scale`), CSS-вьюпорт
 * не совпадает с дизайном и флайаут «разъезжается».
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
    const [staticPort, proxyPort] = await invoke<[number, number]>('get_server_ports');
    setServerPorts(staticPort, proxyPort);
    await rehydrate();
    const suppressed = await invoke<boolean>('custom_css_suppressed').catch(() => false);
    await applyTheme(suppressed);
    await changeAppLanguage(useSettingsStore.getState().language);

    ReactDOM.createRoot(document.getElementById('tray-root')!).render(
        <React.StrictMode>
            <MiniPlayer/>
        </React.StrictMode>,
    );

    setupVisibilityGate();
    setupFocusGate();
    void listen<number | null>('tray:opacity', (e) => applyCardOpacity(e.payload));
    void listen<boolean>('tray:solid', (e) => applySolid(e.payload));

    // Re-pick theme/language changes made in the main window each time the popover re-shows
    // (separate store instance — it only reads the shared on-disk state on demand).
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;
        void rehydrate().then(() => applyTheme());
    });
}

void bootstrap();
