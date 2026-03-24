import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useShallow } from 'zustand/shallow';
import { ThemeProvider } from './components/ThemeProvider';
import { ApiError } from './lib/api';
import { checkForAppUpdate, type GithubRelease } from './lib/update-check';
import { useAuthStore } from './stores/auth';
import { useSettingsStore, type StartupPage } from './stores/settings';

const AppShell = lazy(() =>
  import('./components/layout/AppShell').then((module) => ({ default: module.AppShell })),
);
const Home = lazy(() => import('./pages/Home').then((module) => ({ default: module.Home })));
const Library = lazy(() =>
  import('./pages/Library').then((module) => ({ default: module.Library })),
);
const Login = lazy(() => import('./pages/Login').then((module) => ({ default: module.Login })));
const PlaylistPage = lazy(() =>
  import('./pages/PlaylistPage').then((module) => ({ default: module.PlaylistPage })),
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
  const [checking, setChecking] = useState(true);
  const [availableRelease, setAvailableRelease] = useState<GithubRelease | null>(null);

  useEffect(() => {
    if (sessionId) {
      fetchUser()
        .catch((error) => {
          if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
            useAuthStore.getState().logout();
            return;
          }

          console.warn('[Auth] Keeping local session after /me bootstrap failure:', error);
          useAuthStore.setState({ isAuthenticated: true });
        })
        .finally(() => setChecking(false));
    } else {
      setChecking(false);
    }
  }, [fetchUser, sessionId]);

  useEffect(() => {
    if (!isAuthenticated) {
      setAvailableRelease(null);
      return;
    }

    let cancelled = false;
    const checkUpdates = () => {
      checkForAppUpdate()
        .then((release) => {
          if (!cancelled) {
            setAvailableRelease(release);
          }
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
  }, [isAuthenticated]);

  if (checking) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Suspense fallback={<AppLoadingScreen />}>
        <Login />
      </Suspense>
    );
  }

  return (
    <ThemeProvider>
      <BrowserRouter>
        <Toaster
          theme="dark"
          position="top-right"
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
        {availableRelease && (
          <Suspense fallback={null}>
            <UpdateChecker release={availableRelease} />
          </Suspense>
        )}
        <Suspense fallback={<AppLoadingScreen />}>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<StartPageRedirect />} />
              <Route path="home" element={<Home />} />
              <Route path="search" element={<Search />} />
              <Route path="library" element={<Library />} />
              <Route path="track/:urn" element={<TrackPage />} />
              <Route path="playlist/:urn" element={<PlaylistPage />} />
              <Route path="user/:urn" element={<UserPage />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ThemeProvider>
  );
}

function AppLoadingScreen() {
  return (
    <div className="h-screen flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
