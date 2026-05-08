import { lazy, type ReactNode, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useShallow } from 'zustand/shallow';
import { AppShell } from './components/layout/AppShell';
import YMImportFloatingStatus from './components/music/YMImportFloatingStatus';
import { ReAuthOverlay } from './components/ReAuthOverlay';
import { ThemeProvider } from './components/ThemeProvider';
import { ApiError } from './lib/api';
import { CHECK_UPDATES } from './lib/constants';
import { checkForAppUpdate, type GithubRelease } from './lib/update-check';
import { getAppMode, useAppStatusStore } from './stores/app-status';
import { useAuthStore } from './stores/auth';
import { useSessionExpiryStore } from './stores/session-expiry';
import { type StartupPage, useSettingsStore } from './stores/settings';
import { useYmImportStore } from './stores/ym-import';

const Home = lazy(() => import('./pages/Home').then((module) => ({ default: module.Home })));
const Library = lazy(() =>
  import('./pages/Library').then((module) => ({ default: module.Library })),
);
const Login = lazy(() => import('./pages/Login').then((module) => ({ default: module.Login })));
const PlaylistPage = lazy(() =>
  import('./pages/PlaylistPage').then((module) => ({ default: module.PlaylistPage })),
);
const OfflinePage = lazy(() =>
  import('./pages/OfflinePage').then((module) => ({ default: module.OfflinePage })),
);
const Search = lazy(() => import('./pages/Search').then((module) => ({ default: module.Search })));
const Settings = lazy(() =>
  import('./pages/Settings').then((module) => ({ default: module.Settings })),
);
const TrackPage = lazy(() =>
  import('./pages/TrackPage').then((module) => ({ default: module.TrackPage })),
);
const UserPage = lazy(() =>
  import('./pages/UserPage').then((module) => ({ default: module.UserPage })),
);
const UpdateChecker = lazy(() =>
  import('./components/UpdateChecker').then((module) => ({ default: module.UpdateChecker })),
);
const NewsToast = lazy(() =>
  import('./components/NewsToast').then((module) => ({ default: module.NewsToast })),
);

function LiquidGlassDefs() {
  return (
    <svg className="pointer-events-none absolute h-0 w-0" aria-hidden="true" focusable="false">
      <filter id="liquid-glass-soft" x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.015 0.035"
          numOctaves="2"
          seed="12"
          result="noise"
        />
        <feGaussianBlur in="noise" stdDeviation="2" result="blurredNoise" />
        <feDisplacementMap
          in="SourceGraphic"
          in2="blurredNoise"
          scale="14"
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>
    </svg>
  );
}

const STARTUP_PAGE_ROUTES: Record<StartupPage, string> = {
  home: '/home',
  search: '/search',
  library: '/library',
  settings: '/settings',
};

function StartPageRedirect() {
  const startupPage = useSettingsStore((s) => s.startupPage);
  return <Navigate to={STARTUP_PAGE_ROUTES[startupPage]} replace />;
}

export default function App() {
  const { isAuthenticated, sessionId, fetchUser } = useAuthStore(
    useShallow((s) => ({
      isAuthenticated: s.isAuthenticated,
      sessionId: s.sessionId,
      fetchUser: s.fetchUser,
    })),
  );
  const [availableRelease, setAvailableRelease] = useState<GithubRelease | null>(null);
  const dismissedReleaseTagRef = useRef<string | null>(null);
  const handleUpdateDismiss = useCallback(() => {
    setAvailableRelease((prev) => {
      if (prev) dismissedReleaseTagRef.current = prev.tag_name;
      return null;
    });
  }, []);
  const appMode = useAppStatusStore((s) =>
    s.offlineBypass || !s.navigatorOnline || !s.backendReachable ? 'offline' : 'online',
  );
  const hasLocalSession = Boolean(sessionId);
  const canUseMainShell = isAuthenticated || hasLocalSession;
  const showOfflineOnlyShell = !canUseMainShell && appMode !== 'online';

  useEffect(() => {
    useYmImportStore.getState().initBridge();
  }, []);

  useEffect(() => {
    const syncOnline = () => {
      const online = navigator.onLine;
      const appStatus = useAppStatusStore.getState();
      appStatus.setNavigatorOnline(online);
      if (online) {
        appStatus.setBackendReachable(true);
      }
    };

    syncOnline();
    window.addEventListener('online', syncOnline);
    window.addEventListener('offline', syncOnline);
    return () => {
      window.removeEventListener('online', syncOnline);
      window.removeEventListener('offline', syncOnline);
    };
  }, []);

  useEffect(() => {
    if (!sessionId || appMode !== 'online') {
      return;
    }

    let cancelled = false;

    fetchUser().catch((error) => {
      if (cancelled) return;

      if (error instanceof ApiError && error.status === 401) {
        useSessionExpiryStore.getState().setSessionExpired(true);
        return;
      }

      if (getAppMode() !== 'online') {
        return;
      }

      console.warn('[Auth] Keeping local session after /me bootstrap failure:', error);
      useAuthStore.setState({ isAuthenticated: true });
    });

    void import('./lib/dislikes').then(({ loadAllDislikedIds }) => {
      if (!cancelled) void loadAllDislikedIds();
    });

    return () => {
      cancelled = true;
    };
  }, [appMode, fetchUser, sessionId]);

  useEffect(() => {
    if (!CHECK_UPDATES || !isAuthenticated || appMode !== 'online') {
      setAvailableRelease(null);
      return;
    }

    let cancelled = false;
    const checkUpdates = () => {
      checkForAppUpdate()
        .then((release) => {
          if (cancelled) return;
          if (release && release.tag_name === dismissedReleaseTagRef.current) return;
          setAvailableRelease(release);
        })
        .catch(() => {});
    };

    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(checkUpdates, { timeout: 1200 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(id);
      };
    }

    const id = setTimeout(checkUpdates, 1);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [appMode, isAuthenticated]);

  return (
    <ThemeProvider>
      <Toaster
        theme="dark"
        position="top-right"
        offset={48}
        toastOptions={{
          style: {
            background: 'rgba(30, 30, 34, 0.9)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.85)',
            fontSize: '13px',
          },
        }}
      />
      <LiquidGlassDefs />
      <ReAuthOverlay />
      <YMImportFloatingStatus />
      <BrowserRouter>
        {showOfflineOnlyShell ? (
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<Navigate to="/offline" replace />} />
              <Route
                path="offline"
                element={
                  <RouteLoader>
                    <OfflinePage />
                  </RouteLoader>
                }
              />
              <Route
                path="settings"
                element={
                  <RouteLoader>
                    <Settings />
                  </RouteLoader>
                }
              />
              <Route path="*" element={<Navigate to="/offline" replace />} />
            </Route>
          </Routes>
        ) : !canUseMainShell ? (
          <Suspense fallback={<AppLoadingScreen fullscreen />}>
            <Login />
          </Suspense>
        ) : (
          <>
            {availableRelease && (
              <Suspense fallback={null}>
                <UpdateChecker release={availableRelease} onDismiss={handleUpdateDismiss} />
              </Suspense>
            )}
            <Suspense fallback={null}>
              <NewsToast />
            </Suspense>
            <Routes>
              <Route element={<AppShell />}>
                <Route index element={<StartPageRedirect />} />
                <Route
                  path="home"
                  element={
                    <RouteLoader>
                      <Home />
                    </RouteLoader>
                  }
                />
                <Route
                  path="search"
                  element={
                    <RouteLoader>
                      <Search />
                    </RouteLoader>
                  }
                />
                <Route
                  path="library"
                  element={
                    <RouteLoader>
                      <Library />
                    </RouteLoader>
                  }
                />
                <Route
                  path="offline"
                  element={
                    <RouteLoader>
                      <OfflinePage />
                    </RouteLoader>
                  }
                />
                <Route
                  path="track/:urn"
                  element={
                    <RouteLoader>
                      <TrackPage />
                    </RouteLoader>
                  }
                />
                <Route
                  path="playlist/:urn"
                  element={
                    <RouteLoader>
                      <PlaylistPage />
                    </RouteLoader>
                  }
                />
                <Route
                  path="user/:urn"
                  element={
                    <RouteLoader>
                      <UserPage />
                    </RouteLoader>
                  }
                />
                <Route
                  path="settings"
                  element={
                    <RouteLoader>
                      <Settings />
                    </RouteLoader>
                  }
                />
              </Route>
            </Routes>
          </>
        )}
      </BrowserRouter>
    </ThemeProvider>
  );
}

function RouteLoader({ children }: { children: ReactNode }) {
  return <Suspense fallback={<AppLoadingScreen />}>{children}</Suspense>;
}

function AppLoadingScreen({ fullscreen = false }: { fullscreen?: boolean }) {
  const { t } = useTranslation();

  return (
    <div
      className={`flex items-center justify-center px-6 py-8 ${fullscreen ? 'h-screen' : 'min-h-[42vh]'}`}
    >
      <div className="flex items-center gap-3 rounded-[24px] border border-white/8 bg-white/[0.035] px-4 py-3 shadow-[0_18px_44px_rgba(0,0,0,0.24)] backdrop-blur-[28px]">
        <div className="flex size-10 items-center justify-center rounded-[16px] border border-accent/18 bg-accent/[0.10]">
          <div className="size-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/28">
            SoundCloud
          </div>
          <div className="mt-0.5 text-[13px] font-medium text-white/62">{t('common.loading')}</div>
        </div>
      </div>
    </div>
  );
}
