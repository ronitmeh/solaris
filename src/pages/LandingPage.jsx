import { useEffect, useMemo, useState } from 'react'
import styles from './LandingPage.module.css'
import { supabase } from '../lib/supabase'

const fallbackPosters = [
  { title: 'Metropolis', year: '1927', palette: 'linear-gradient(160deg, #f2d8a7 0%, #8f6a4e 100%)' },
  { title: 'Psycho', year: '1960', palette: 'linear-gradient(160deg, #d9dce6 0%, #5a5f70 100%)' },
  { title: 'Alien', year: '1979', palette: 'linear-gradient(160deg, #8cc4a0 0%, #2d4c41 100%)' },
  { title: 'Inception', year: '2010', palette: 'linear-gradient(160deg, #8fc0f0 0%, #31537d 100%)' },
  { title: 'Dune', year: '2021', palette: 'linear-gradient(160deg, #f0c18f 0%, #805431 100%)' }
]

const featureItems = [
  {
    id: 'galaxy',
    title: 'Movie Galaxy',
    body: 'Explore films as a connected 3D constellation where clusters reveal thematic neighborhoods and live recommendation paths.'
  },
  {
    id: 'now-playing',
    title: 'Now Playing Tab',
    body: 'Track active titles from the is_now_playing feed with full details and linked companions pulled directly from Supabase.'
  },
  {
    id: 'decade',
    title: 'Decade Explorer',
    body: 'Step through curated decade highlights and jump the camera to each selection for low-latency cinematic navigation.'
  },
  {
    id: 'semantic',
    title: 'Semantic Search',
    body: 'Describe a mood or premise and discover nearby movies by meaning, not exact keywords, using embedding-based matching.'
  }
]

const getReleaseYear = (releaseDate) => {
  if (typeof releaseDate !== 'string') return ''
  const match = releaseDate.match(/^(\d{4})/)
  return match ? match[1] : ''
}

const toPosterUrl = (posterPath) => {
  if (typeof posterPath !== 'string' || posterPath.trim().length === 0) return null
  const trimmed = posterPath.trim()
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  const normalizedPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return `https://image.tmdb.org/t/p/w342${normalizedPath}`
}

const pickRandomItems = (items, count) => {
  const pool = [...items]
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, count)
}

export default function LandingPage() {
  const [supabasePosters, setSupabasePosters] = useState([])

  useEffect(() => {
    let isMounted = true

    const loadOrbitPosters = async () => {
      try {
        const { data, error } = await supabase
          .from('movie_galaxy')
          .select('id,title,release_date,poster_path')
          .not('poster_path', 'is', null)
          .limit(40)

        if (error) throw error

        const posters = pickRandomItems((data || [])
          .filter((movie) => typeof movie.poster_path === 'string' && movie.poster_path.length > 0)
          .map((movie) => ({
            id: movie.id,
            title: movie.title || 'Untitled',
            year: getReleaseYear(movie.release_date),
            image: toPosterUrl(movie.poster_path)
          }))
          .filter((poster) => Boolean(poster.image)), 5)

        if (isMounted) {
          setSupabasePosters(posters)
        }
      } catch (error) {
        console.error('Failed to load landing posters from Supabase', error)
      }
    }

    loadOrbitPosters()

    return () => {
      isMounted = false
    }
  }, [])

  const orbitPosters = useMemo(() => {
    if (supabasePosters.length === 0) return fallbackPosters

    const neededFallbacks = Math.max(0, 5 - supabasePosters.length)
    return [...supabasePosters, ...pickRandomItems(fallbackPosters, neededFallbacks)]
  }, [supabasePosters])

  return (
    <div className={styles.page}>
      <div className={styles.backdropGlow} />
      <main className={styles.hero}>
        <section className={styles.copyCol}>
          <p className={styles.kicker}>Cinematic Discovery Engine</p>
          <h1 className={styles.title}>Solaris</h1>
          <p className={styles.description}>
            Solaris is an interactive movie intelligence app that maps films as constellations,
            revealing hidden thematic links, cluster neighborhoods, and story-adjacent recommendations
            so you can explore cinema as a living galaxy.
          </p>
        </section>

        <section className={styles.visualCol} aria-hidden="true">
          <div className={styles.sphereWrap}>
            <div className={styles.orbitLayer}>
              {orbitPosters.map((poster, index) => (
                <div
                  key={`orbit-${poster.id || poster.title}`}
                  className={styles.posterOrbitItem}
                  style={{ '--index': index }}
                >
                  <article className={styles.posterCard} style={{ background: poster.palette }}>
                    {poster.image ? <img src={poster.image} alt="" className={styles.posterImage} loading="lazy" /> : null}
                  </article>
                </div>
              ))}
            </div>

            <div className={styles.sphere} />
            <div className={styles.orbitRing} />
          </div>
        </section>
      </main>

      <section className={styles.featuresSection}>
        <div className={styles.featuresHeader}>
          <p className={styles.featuresKicker}>What You Can Do</p>
          <h2 className={styles.featuresTitle}>Key Features</h2>
        </div>

        <div className={styles.featuresGrid}>
          {featureItems.map((feature, index) => (
            <article key={feature.id} className={styles.featureCard}>
              <p className={styles.featureIndex}>{String(index + 1).padStart(2, '0')}</p>
              <h3 className={styles.featureTitle}>{feature.title}</h3>
              <p className={styles.featureBody}>{feature.body}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
