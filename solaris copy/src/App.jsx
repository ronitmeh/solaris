import { Navigate, NavLink, Route, Routes } from 'react-router-dom'
import HomePage from './pages/HomePage'
import NowPlayingPage from './pages/NowPlayingPage'
import LandingPage from './pages/LandingPage'
import styles from './App.module.css'

export default function App() {
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
          <NavLink
            to="/now-playing"
            className={({ isActive }) => `${styles.navTab} ${isActive ? styles.navTabActive : ''}`.trim()}
          >
            Now Playing
          </NavLink>
        </nav>

        <div className={styles.rightSpacer} aria-hidden="true" />
      </header>

      <main className={styles.main}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/movie-galaxy" element={<HomePage />} />
          <Route path="/now-playing" element={<NowPlayingPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}
