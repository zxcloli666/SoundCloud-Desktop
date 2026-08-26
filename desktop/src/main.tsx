import { QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { changeAppLanguage } from './i18n';
import { initAuthBridge } from './lib/auth-session';
import { setupCacheMaintenance } from './lib/cache';
import { setServerPorts } from './lib/constants';
import { designPreviewTracks, isDesignPreview } from './lib/design-preview';
import { trackedInvoke as invoke, setupUiWatchdog } from './lib/diagnostics';
import { initEdge } from './lib/edge';
import { installFpsCap } from './lib/fps-cap';
import { queryClient } from './lib/query-client';
import './fonts';
import './index.css';
import './sonveil.css';
import { useAuthStore } from './stores/auth';
import { useSettingsStore } from './stores/settings';

installFpsCap(60);

useSettingsStore.persist.onFinishHydration((state) => {
  if (isDesignPreview()) return;
  if (state.language) void changeAppLanguage(state.language);
});

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
    // Audio owns the player-store subscription, so initialise it first. Less
    // urgent integrations are staggered to avoid six chunks parsing in the same
    // post-paint task and freezing the first interaction.
    void import('./lib/tray');
    void import('./lib/audio');
    void import('./lib/queue-autopilot');
    window.setTimeout(() => void import('./lib/discord'), 1000);
    window.setTimeout(
      () => void import('./lib/host-status').then((module) => module.initHostStatus()),
      1500,
    );
    window.setTimeout(setupCacheMaintenance, 2500);
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
  if (isDesignPreview()) {
    await changeAppLanguage('en');
    useSettingsStore.setState({
      accentColor: '#d96d3d',
      backgroundImage: '',
      sidebarCollapsed: false,
    });
    useAuthStore.setState({
      isAuthenticated: true,
      hasSession: true,
      user: {
        id: 1,
        urn: 'soundcloud:users:1',
        username: 'sonveil',
        avatar_url: designPreviewTracks[0].artwork_url || '',
        permalink_url: '',
        followers_count: 0,
        followings_count: 0,
        track_count: 0,
        playlist_count: 0,
      },
    });
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary fullscreen>
          <App />
        </ErrorBoundary>
      </QueryClientProvider>,
    );
    return;
  }

  await fixWebviewScale();
  await useSettingsStore.persist.rehydrate();

  const settings = useSettingsStore.getState();
  await changeAppLanguage(settings.language);

  const [staticPort, proxyPort] = await invoke<[number, number]>('get_server_ports');
  setServerPorts(staticPort, proxyPort);

  // Install URL routing before React assigns the first remote <img>.src. Cache
  // maintenance and unrelated integrations remain deferred below.
  await import('./lib/scproxy');

  await initEdge();
  await initAuthBridge();

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary fullscreen>
          <App />
        </ErrorBoundary>
      </QueryClientProvider>
    </React.StrictMode>,
  );

  startDeferredRuntime();
}

void bootstrap();
