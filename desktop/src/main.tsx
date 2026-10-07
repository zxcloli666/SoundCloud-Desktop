import { QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ErrorScreen } from './components/ui/ErrorScreen';
import { changeAppLanguage } from './i18n';
import { initAuthBridge } from './lib/auth-session';
import { setupCacheMaintenance } from './lib/cache';
import { setServerPorts } from './lib/constants';
import {
  describeError,
  trackedInvoke as invoke,
  logError,
  setupUiWatchdog,
} from './lib/diagnostics';
import { initEdge } from './lib/edge';
import { installFpsCap } from './lib/fps-cap';
import { queryClient } from './lib/query-client';
import { bootstrapPremium } from './lib/subscription';
import './fonts';
import './index.css';
import { useSettingsStore } from './stores/settings';

// Кап 60 fps: троттл requestAnimationFrame (см. lib/fps-cap.ts). На высокогерцовых
// дисплеях убирает лишние кадры (CPU/GPU), на ≤60 Гц — no-op. Ставить максимально
// рано, до первых rAF-циклов.
installFpsCap(60);

// Sync language from persisted settings → i18n after tauriStorage rehydration
useSettingsStore.persist.onFinishHydration((state) => {
  if (state.language) {
    void changeAppLanguage(state.language);
  }
});

if (import.meta.env.DEV) {
  const script = document.createElement('script');
  script.src = 'https://unpkg.com/react-scan/dist/auto.global.js';
  script.crossOrigin = 'anonymous';
  document.head.appendChild(script);
}

function scheduleAfterFirstPaint(task: () => void) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(() => task(), { timeout: 1500 });
      } else {
        setTimeout(task, 1);
      }
    });
  });
}

function startDeferredRuntime() {
  scheduleAfterFirstPaint(() => {
    setupUiWatchdog();
    setupCacheMaintenance();
    void import('./lib/scproxy');
    void import('./lib/tray');
    void import('./lib/audio');
    void import('./lib/queue-autopilot');
    void import('./lib/discord');
    void import('./lib/perf-probe').then((m) => m.probePerfMode());
    void import('./lib/host-status').then((m) => m.initHostStatus());
    void import('./lib/storage-location').then((m) => m.warnIfStorageUnavailable());
  });
}

async function fixWebviewScale() {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const { getCurrentWebview } = await import('@tauri-apps/api/webview');
    const monitorScale = await getCurrentWindow().scaleFactor();
    const webviewDpr = window.devicePixelRatio;
    if (monitorScale > 1 && webviewDpr < monitorScale * 0.8) {
      await getCurrentWebview().setZoom(monitorScale / webviewDpr);
    }
  } catch {}
}

async function bootstrap() {
  await fixWebviewScale();
  await useSettingsStore.persist.rehydrate();

  const settings = useSettingsStore.getState();
  await changeAppLanguage(settings.language);

  const [staticPort, proxyPort] = await invoke<[number, number]>('get_server_ports');
  setServerPorts(staticPort, proxyPort);

  // Вердикт транспорта (прямой / relay / воркеры) — до первого запроса,
  // иначе забаненный юзер платит таймаутом на логине.
  await initEdge();

  // Seed the Rust-owned session into the frontend mirror + subscribe to
  // auth:changed before the first render so the shell/login gate is correct.
  await initAuthBridge();

  // «Есть ли подписка?» — у ОБОИХ хостов сразу, до первого рендера. Первый
  // рендер поднимает пачку запросов; если premium к этому моменту неизвестен,
  // вся пачка уходит на main, и при сломанном main экран остаётся пустым.
  // Ответ нужен до неё, поэтому дожидаемся (свой короткий бюджет внутри).
  await bootstrapPremium();

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary fullscreen>
          <App />
        </ErrorBoundary>
      </QueryClientProvider>
    </React.StrictMode>,
  );

  void startDeferredRuntime();
}

bootstrap().catch((error) => {
  const message = describeError(error);
  logError(`[Boot] ${message}`);
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <ErrorScreen error={new Error(message)} fullscreen />,
  );
});
