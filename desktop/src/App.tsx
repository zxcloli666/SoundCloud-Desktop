import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { Home } from './pages/Home/Page.tsx'
import { Search } from './pages/Search/Page.tsx'
import { Library } from './pages/Library/Page.tsx'
import { TrackPage } from './pages/Track/Page.tsx'
import { PlaylistPage } from './pages/Playlist/Page.tsx'
import { UserPage } from './pages/User/Page.tsx'
import { Login } from './pages/Login/Page.tsx'
import { UpdateChecker } from './components/UpdateChecker'
import { useAuthStore } from './stores/auth'
import { useShallow } from 'zustand/shallow'

export default function App() {
    const { isAuthenticated, sessionId, fetchUser } = useAuthStore(
        useShallow((s) => ({
            isAuthenticated: s.isAuthenticated,
            sessionId: s.sessionId,
            fetchUser: s.fetchUser,
        }))
    )
    const [checking, setChecking] = useState(true)

    useEffect(() => {
        if (sessionId) {
            fetchUser()
                .catch(() => useAuthStore.getState().logout())
                .finally(() => setChecking(false))
        } else {
            setChecking(false)
        }
    }, [])

    if (checking) {
        return (
            <div className="h-screen flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    if (!isAuthenticated) {
        return <Login />
    }

    return (
        <BrowserRouter>
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
    )
}
