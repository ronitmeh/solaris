import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { prefetchGalaxyData } from '../lib/dataPrefetch'
import styles from './NowPlayingPage.module.css'

const getReleaseDateLabel = (releaseDate) => {
  if (typeof releaseDate !== 'string' || releaseDate.trim() === '') return 'Unknown date'
  return releaseDate
}

const parseGenres = (genresValue) => {
  if (Array.isArray(genresValue)) return genresValue
  if (typeof genresValue === 'string') {
    return genresValue
      .split(',')
      .map((genre) => genre.trim())
      .filter(Boolean)
  }
  return []
}

const getSimilarMoviesFor = (movieId, nodeById, links) => {
  const related = []
  const seen = new Set([String(movieId)])

  for (const link of links) {
    const sourceId = String(link.source_id ?? link.source ?? '')
    const targetId = String(link.target_id ?? link.target ?? '')
    if (!sourceId || !targetId) continue

    let neighborId = null
    if (sourceId === String(movieId)) neighborId = targetId
    else if (targetId === String(movieId)) neighborId = sourceId
    if (!neighborId || seen.has(neighborId)) continue

    const movie = nodeById.get(neighborId)
    if (!movie) continue

    seen.add(neighborId)
    related.push({
      movie,
      value: Number(link.value || 0)
    })
  }

  return related
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)
}

export default function NowPlayingPage() {
  const [movies, setMovies] = useState([])
  const [allNodes, setAllNodes] = useState([])
  const [links, setLinks] = useState([])
  const [selectedMovieId, setSelectedMovieId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    const loadNowPlaying = async () => {
      try {
        setLoading(true)
        const galaxyData = await prefetchGalaxyData(supabase)

        if (cancelled) return

        const normalizedNodes = galaxyData.nodes || []
        const nowPlaying = normalizedNodes.filter((node) => Boolean(node.is_now_playing))

        setAllNodes(normalizedNodes)
        setLinks(galaxyData.links || [])
        setMovies(nowPlaying)
      } catch (err) {
        if (!cancelled) {
          console.error(err)
          setError('Could not load now playing movies.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadNowPlaying()

    return () => {
      cancelled = true
    }
  }, [])

  const nodeById = useMemo(
    () => new Map(allNodes.map((movie) => [String(movie.id), movie])),
    [allNodes]
  )

  const nowPlayingMovies = useMemo(() => {
    return [...movies].sort((a, b) => Number(b.popularity || 0) - Number(a.popularity || 0))
  }, [movies])

  const topMovies = useMemo(() => nowPlayingMovies.slice(0, 50), [nowPlayingMovies])

  const selectedMovie = useMemo(
    () => topMovies.find((movie) => String(movie.id) === String(selectedMovieId)) ?? null,
    [selectedMovieId, topMovies]
  )

  const selectedSimilarMovies = useMemo(() => {
    if (!selectedMovie) return []
    return getSimilarMoviesFor(selectedMovie.id, nodeById, links)
  }, [selectedMovie, nodeById, links])

  useEffect(() => {
    if (!selectedMovie) return undefined

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setSelectedMovieId(null)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedMovie])

  if (loading) {
    return (
      <div className={styles.page}>
        <section className={styles.loadingScreen} role="status" aria-live="polite" aria-busy="true">
          <div className={styles.loadingOrb} aria-hidden="true" />
          <p className={styles.loadingTitle}>Scanning Theater Signals</p>
          <p className={styles.loadingBody}>Loading now playing movies and similarity links...</p>
        </section>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <p className={styles.kicker}>Now Playing</p>
        <h1 className={styles.title}>In Theaters</h1>
        <p className={styles.description}>Top 50 by popularity. Click any poster to open details and similar picks.</p>
      </section>

      {error ? (
        <div className={styles.state}>{error}</div>
      ) : topMovies.length === 0 ? (
        <div className={styles.state}>No now playing movies found.</div>
      ) : (
        <section className={styles.posterWall}>
          {topMovies.map((movie, index) => (
            <button
              key={movie.id}
              type="button"
              className={styles.posterButton}
              onClick={() => setSelectedMovieId(movie.id)}
            >
              <span className={styles.posterRank}>#{index + 1}</span>
              {movie.poster_path ? (
                <img
                  src={`https://image.tmdb.org/t/p/w154${movie.poster_path}`}
                  className={styles.posterThumb}
                  alt={movie.title || 'Movie poster'}
                />
              ) : (
                <span className={styles.posterThumbFallback}>No Poster</span>
              )}
            </button>
          ))}
        </section>
      )}

      {selectedMovie ? (
        <div
          className={styles.modalBackdrop}
          onClick={() => setSelectedMovieId(null)}
          role="presentation"
        >
          <section
            className={styles.modalCard}
            role="dialog"
            aria-modal="true"
            aria-label={selectedMovie.title || 'Movie details'}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className={styles.closeButton}
              onClick={() => setSelectedMovieId(null)}
              aria-label="Close details"
            >
              Close
            </button>

            <div className={styles.modalTop}>
              {selectedMovie.poster_path ? (
                <img
                  src={`https://image.tmdb.org/t/p/w342${selectedMovie.poster_path}`}
                  className={styles.modalPoster}
                  alt={selectedMovie.title || 'Movie poster'}
                />
              ) : (
                <div className={styles.modalPosterFallback}>No Poster</div>
              )}

              <div className={styles.modalMeta}>
                <p className={styles.releaseDate}>{getReleaseDateLabel(selectedMovie.release_date)}</p>
                <h2 className={styles.modalTitle}>{selectedMovie.title}</h2>
                <p className={styles.modalOverview}>{selectedMovie.overview || 'No overview available.'}</p>
                <div className={styles.genreList}>
                  {parseGenres(selectedMovie.genres).length > 0 ? parseGenres(selectedMovie.genres).map((genre) => (
                    <span key={`${selectedMovie.id}-${genre}`} className={styles.genreChip}>
                      {genre}
                    </span>
                  )) : (
                    <span className={styles.emptyHint}>Genres unavailable</span>
                  )}
                </div>
              </div>
            </div>

            <div className={styles.similarPanel}>
              <div className={styles.similarHeader}>Similar movies</div>
              {selectedSimilarMovies.length > 0 ? (
                <div className={styles.similarList}>
                  {selectedSimilarMovies.map(({ movie: similarMovie }) => (
                    <div className={styles.similarItem} key={`${selectedMovie.id}-${similarMovie.id}`}>
                      {similarMovie.poster_path ? (
                        <img
                          src={`https://image.tmdb.org/t/p/w92${similarMovie.poster_path}`}
                          className={styles.similarPoster}
                          alt={similarMovie.title || 'Similar movie poster'}
                        />
                      ) : (
                        <div className={styles.similarPosterFallback}>No Poster</div>
                      )}
                      <div className={styles.similarMeta}>
                        <div className={styles.similarTitle}>{similarMovie.title}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.emptyHint}>No linked similar movies found.</div>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}