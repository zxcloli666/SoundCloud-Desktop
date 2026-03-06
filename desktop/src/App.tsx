import { useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useShallow } from 'zustand/shallow';
import { UpdateChecker } from './components/UpdateChecker.tsx';
import { AppShell } from './components/layout/AppShell.tsx';
import { AudioRuntime } from './features/playback/index.ts';
import { Home } from './pages/Home/Page.tsx';
import { Library } from './pages/Library/Page.tsx';
import { Login } from './pages/Login/Page.tsx';
import { PlaylistPage } from './pages/Playlist/Page.tsx';
import { Search } from './pages/Search/Page.tsx';
import { TrackPage } from './pages/Track/Page.tsx';
import { UserPage } from './pages/User/Page.tsx';
import { useAuthStore } from './stores/auth';

export default function App() {
  const { isAuthenticated, sessionId, fetchUser } = useAuthStore(
    useShallow((s) => ({
      isAuthenticated: s.isAuthenticated,
      sessionId: s.sessionId,
      fetchUser: s.fetchUser,
    })),
  );
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    console.log('[Auth/App] auth gate effect', { hasSessionId: !!sessionId });
    if (sessionId) {
      fetchUser()
        .catch((err) => {
          console.error('[Auth/App] fetchUser from gate failed, logging out', err);
          useAuthStore.getState().logout();
        })
        .finally(() => {
          console.log('[Auth/App] auth gate done (session branch)');
          setChecking(false);
        });
    } else {
      console.log('[Auth/App] no sessionId, skip fetchUser');
      setChecking(false);
    }
  }, [sessionId, fetchUser]);

  if (checking) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <BrowserRouter>
      <AudioRuntime />
      <Toaster
        theme="dark"
        position="bottom-right"
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
      <UpdateChecker />
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Home />} />
          <Route path="search" element={<Search />} />
          <Route path="library" element={<Library />} />
          <Route path="track/:urn" element={<TrackPage />} />
          <Route path="playlist/:urn" element={<PlaylistPage />} />
          <Route path="user/:urn" element={<UserPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
