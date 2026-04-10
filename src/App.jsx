import { useEffect, useState } from 'react'
import { Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import HomePage from './pages/HomePage'
import NowPlayingPage from './pages/NowPlayingPage'
import LandingPage from './pages/LandingPage'
import WatchlistPage from './pages/WatchlistPage'
import { supabase } from './lib/supabase'
import { prefetchGalaxyData, prefetchPersonalLists } from './lib/dataPrefetch'
import styles from './App.module.css'

export default function App() {
  const navigate = useNavigate()
  const [session, setSession] = useState(null)

  useEffect(() => {
    let isMounted = true

    const bootstrapSession = async () => {
      const { data, error } = await supabase.auth.getSession()
      if (error) {
        console.error('Failed to get auth session', error)
        return
      }
      if (isMounted) {
        setSession(data?.session || null)
      }
    }

    bootstrapSession()

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession || null)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    // Warm galaxy data once so Home, Now Playing, and related views can reuse it.
    prefetchGalaxyData(supabase).catch((error) => {
      console.warn('Galaxy prefetch failed', error)
    })
  }, [])

  useEffect(() => {
    const userId = session?.user?.id
    if (!userId) return

    // Warm personal data while user is active to remove tab-switch wait time.
    prefetchPersonalLists(supabase, userId).catch((error) => {
      console.warn('Personal list prefetch failed', error)
    })
  }, [session?.user?.id])

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Logout failed', error)
      return
    }
    navigate('/', { replace: true })
  }

  return (
    <div className={styles.appShell}>
      <header className={styles.topNav}>
        <NavLink to="/" end className={styles.brand}>
          Solaris
        </NavLink>

        <nav className={styles.centerNav}>
          <NavLink
            to="/movie-galaxy"
            className={({ isActive }) => `${styles.navTab} ${isActive ? styles.navTabActive : ''}`.trim()}
          >
            Movie Galaxy
          </NavLink>
        </nav>

        <div className={styles.rightActions}>
          {session ? (
            <button type="button" className={styles.logoutBtn} onClick={handleLogout}>
              Logout
            </button>
          ) : (
            <div className={styles.rightSpacer} aria-hidden="true" />
          )}
        </div>
      </header>

      <main className={styles.main}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/movie-galaxy" element={<HomePage />} />
          <Route path="/now-playing" element={<NowPlayingPage />} />
          <Route path="/watchlist" element={<WatchlistPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}
