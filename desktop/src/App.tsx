import { lazy, type ReactNode, Suspense, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useShallow } from 'zustand/shallow';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HostStatusBanner } from './components/host-status/HostStatusBanner';
import { HostStatusModal } from './components/host-status/HostStatusModal';
import { AppShell } from './components/layout/AppShell';
import YMImportFloatingStatus from './components/music/YMImportFloatingStatus';
import { SessionRecoveryModal } from './components/SessionRecoveryModal';
import { ThemeProvider } from './components/ThemeProvider';
import { ApiError } from './lib/api';
import { getAppMode, useAppMode, useAppStatusStore } from './stores/app-status';
import { useAuthStore } from './stores/auth';
import { type StartupPage, useSettingsStore } from './stores/settings';
import { useYmImportStore } from './stores/ym-import';

const Home = lazy(() => import('./pages/Home').then((module) => ({ default: module.Home })));
const Library = lazy(() =>
  import('./pages/Library').then((module) => ({ default: module.Library })),
);
const LibraryCollection = lazy(() =>
  import('./pages/LibraryCollection').then((module) => ({ default: module.LibraryCollection })),
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
const ArtistPage = lazy(() =>
  import('./pages/ArtistPage').then((module) => ({ default: module.ArtistPage })),
);
const AlbumPage = lazy(() =>
  import('./pages/AlbumPage').then((module) => ({ default: module.AlbumPage })),
);
const Discover = lazy(() =>
  import('./pages/Discover').then((module) => ({ default: module.Discover })),
);

const STARTUP_PAGE_ROUTES: Record<StartupPage, string> = {
  home: '/home',
  search: '/search',
  library: '/library',
  settings: '/settings',
};

function StartPageRedirect() {
  const startupPage = useSettingsStore((s) => s.startupPage);
  return <Navigate to={STARTUP_PAGE_ROUTES[startupPage] ?? '/home'} replace />;
}

export default function App() {
  const { isAuthenticated, hasSession, fetchUser } = useAuthStore(
    useShallow((s) => ({
      isAuthenticated: s.isAuthenticated,
      hasSession: s.hasSession,
      fetchUser: s.fetchUser,
    })),
  );
  const appMode = useAppMode();
  const offlineBypass = useAppStatusStore((s) => s.offlineBypass);
  const canUseMainShell = isAuthenticated || hasSession;
  // Offline-only shell is the explicit "browse offline" choice from Login — NOT
  // a fallback for being logged out. An explicit logout always lands on <Login/>.
  const showOfflineOnlyShell = !canUseMainShell && offlineBypass;

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
    if (!hasSession || appMode !== 'online') {
      return;
    }

    let cancelled = false;

    fetchUser().catch((error) => {
      if (cancelled) return;

      // Auth-recoverable сбои (401/429/пустой юзер) уже перехвачены в
      // api-client → recoverSession() (silent renew, при неудаче — модалка).
      if (error instanceof ApiError) return;

      if (getAppMode() !== 'online') {
        return;
      }

      // Logged out while /me was in flight — don't resurrect the session.
      if (!useAuthStore.getState().hasSession) return;

      console.warn('[Auth] Keeping local session after /me bootstrap failure:', error);
      useAuthStore.setState({ isAuthenticated: true });
    });

    void import('./lib/dislikes').then(({ loadAllDislikedIds }) => {
      if (!cancelled) void loadAllDislikedIds();
    });

    return () => {
      cancelled = true;
    };
  }, [appMode, fetchUser, hasSession]);

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
      <SessionRecoveryModal />
      <YMImportFloatingStatus />
      <BrowserRouter>
        {/* Внутри Router ради navigate('/offline'); видны и над Login (он тоже в Router). */}
        <HostStatusModal />
        <HostStatusBanner />
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
                path="library/:section"
                element={
                  <RouteLoader>
                    <LibraryCollection />
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
                path="artist/:id"
                element={
                  <RouteLoader>
                    <ArtistPage />
                  </RouteLoader>
                }
              />
              <Route
                path="album/:id"
                element={
                  <RouteLoader>
                    <AlbumPage />
                  </RouteLoader>
                }
              />
              <Route
                path="discover"
                element={
                  <RouteLoader>
                    <Discover />
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
        )}
      </BrowserRouter>
    </ThemeProvider>
  );
}

function RouteLoader({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<AppLoadingScreen />}>
      <ErrorBoundary>{children}</ErrorBoundary>
    </Suspense>
  );
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
