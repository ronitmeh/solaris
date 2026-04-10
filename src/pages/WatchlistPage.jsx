import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { prefetchPersonalLists, refreshPersonalLists } from '../lib/dataPrefetch'
import styles from './WatchlistPage.module.css'

const toYear = (releaseDate) => {
  if (typeof releaseDate !== 'string') return 'Unknown year'
  const match = releaseDate.match(/^(\d{4})/)
  return match ? match[1] : 'Unknown year'
}

const mergeRowsWithMovies = (rows, movieMap) => {
  return rows
    .map((row) => {
      const movieId = String(row.movie_id)
      const movie = movieMap.get(movieId)
      if (!movie) return null
      return {
        ...row,
        movieId,
        movie
      }
    })
    .filter(Boolean)
}

export default function WatchlistPage() {
  const [userId, setUserId] = useState(null)
  const [watchlistRows, setWatchlistRows] = useState([])
  const [watchedRows, setWatchedRows] = useState([])
  const [moviesById, setMoviesById] = useState(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [watchedModalOpen, setWatchedModalOpen] = useState(false)
  const [watchedTargetMovie, setWatchedTargetMovie] = useState(null)
  const [watchedFormRating, setWatchedFormRating] = useState('')
  const [watchedFormDate, setWatchedFormDate] = useState('')
  const [watchedFormReview, setWatchedFormReview] = useState('')
  const [watchedSaving, setWatchedSaving] = useState(false)

  const loadLists = async (uid) => {
    if (!uid) {
      setWatchlistRows([])
      setWatchedRows([])
      setMoviesById(new Map())
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    try {
      const payload = await prefetchPersonalLists(supabase, uid)
      setWatchlistRows(payload.watchRows || [])
      setWatchedRows(payload.historyRows || [])
      setMoviesById(payload.movieMap || new Map())
    } catch (loadError) {
      console.error('Failed to load personal lists', loadError)
      setError('Could not load your watchlist right now.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let mounted = true

    const init = async () => {
      const { data, error: sessionError } = await supabase.auth.getUser()
      if (sessionError) {
        console.error(sessionError)
        return
      }
      if (!mounted) return
      const uid = data?.user?.id || null
      setUserId(uid)
      loadLists(uid)
    }

    init()

    return () => {
      mounted = false
    }
  }, [])

  const watchlistMovies = useMemo(() => mergeRowsWithMovies(watchlistRows, moviesById), [watchlistRows, moviesById])
  const watchedMovies = useMemo(() => {
    const merged = mergeRowsWithMovies(watchedRows, moviesById)
    return merged.sort((a, b) => {
      const aTime = a.watched_at ? new Date(a.watched_at).getTime() : 0
      const bTime = b.watched_at ? new Date(b.watched_at).getTime() : 0
      return bTime - aTime
    })
  }, [watchedRows, moviesById])

  const watchedByMovieId = useMemo(() => {
    const map = new Map()
    for (const row of watchedRows) {
      map.set(String(row.movie_id), row)
    }
    return map
  }, [watchedRows])

  const removeFromWatchlist = async (movieId) => {
    if (!userId) return

    const { error: deleteError } = await supabase
      .from('watchlist')
      .delete()
      .eq('user_id', userId)
      .eq('movie_id', String(movieId))

    if (deleteError) {
      console.error(deleteError)
      setError('Could not remove that movie from your watchlist.')
      return
    }

    const payload = await refreshPersonalLists(supabase, userId)
    setWatchlistRows(payload.watchRows || [])
    setWatchedRows(payload.historyRows || [])
    setMoviesById(payload.movieMap || new Map())
  }

  const removeFromWatched = async (movieId) => {
    if (!userId) return

    const { error: deleteError } = await supabase
      .from('watched_history')
      .delete()
      .eq('user_id', userId)
      .eq('movie_id', String(movieId))

    if (deleteError) {
      console.error(deleteError)
      setError('Could not remove that movie from your watched history.')
      return
    }

    const payload = await refreshPersonalLists(supabase, userId)
    setWatchlistRows(payload.watchRows || [])
    setWatchedRows(payload.historyRows || [])
    setMoviesById(payload.movieMap || new Map())
  }

  const markAsWatched = async (movieId, details = {}) => {
    if (!userId) return

    const normalizedRating = Number.isInteger(details.rating) ? details.rating : null
    const normalizedWatchedAt = typeof details.watched_at === 'string' && details.watched_at.trim() ? details.watched_at : null
    const normalizedReview = typeof details.review === 'string' ? details.review.trim() : ''

    const { data: existingRows, error: existingError } = await supabase
      .from('watched_history')
      .select('movie_id')
      .eq('user_id', userId)
      .eq('movie_id', String(movieId))
      .limit(1)

    if (existingError) {
      console.error(existingError)
      setError('Could not update watched history.')
      return
    }

    if ((existingRows || []).length > 0) {
      const { error: updateError } = await supabase
        .from('watched_history')
        .update({
          rating: normalizedRating,
          watched_at: normalizedWatchedAt,
          review: normalizedReview
        })
        .eq('user_id', userId)
        .eq('movie_id', String(movieId))

      if (updateError) {
        console.error(updateError)
        setError('Could not update rating in watched history.')
        return
      }
    } else {
      const { error: insertError } = await supabase
        .from('watched_history')
        .insert({
          user_id: userId,
          movie_id: String(movieId),
          rating: normalizedRating,
          watched_at: normalizedWatchedAt,
          review: normalizedReview
        })

      if (insertError) {
        console.error(insertError)
        setError('Could not add this movie to watched history.')
        return
      }
    }

    const { error: removeWatchlistError } = await supabase
      .from('watchlist')
      .delete()
      .eq('user_id', userId)
      .eq('movie_id', String(movieId))

    if (removeWatchlistError) {
      console.error(removeWatchlistError)
    }

    const payload = await refreshPersonalLists(supabase, userId)
    setWatchlistRows(payload.watchRows || [])
    setWatchedRows(payload.historyRows || [])
    setMoviesById(payload.movieMap || new Map())
    return true
  }

  const openWatchedModal = (movie) => {
    if (!movie) return
    const existing = watchedByMovieId.get(String(movie.id))
    setWatchedTargetMovie(movie)
    setWatchedFormRating(Number.isInteger(existing?.rating) ? String(existing.rating) : '')
    setWatchedFormDate(typeof existing?.watched_at === 'string' ? existing.watched_at.slice(0, 10) : '')
    setWatchedFormReview(existing?.review || '')
    setWatchedModalOpen(true)
  }

  const closeWatchedModal = () => {
    setWatchedModalOpen(false)
    setWatchedTargetMovie(null)
    setWatchedSaving(false)
  }

  const submitWatchedModal = async () => {
    if (!watchedTargetMovie) return
    setWatchedSaving(true)
    const ok = await markAsWatched(watchedTargetMovie.id, {
      rating: watchedFormRating ? Number(watchedFormRating) : null,
      watched_at: watchedFormDate,
      review: watchedFormReview
    })
    setWatchedSaving(false)
    if (ok) closeWatchedModal()
  }

  if (!userId) {
    return (
      <div className={styles.page}>
        <section className={styles.stateCard}>
          <h1 className={styles.title}>Want To See</h1>
          <p className={styles.stateText}>Sign up or sign in to manage your personal watchlist and watched history.</p>
        </section>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <section className={styles.header}>
        <p className={styles.kicker}>Personal Lists</p>
        <h1 className={styles.title}>Watch Planner</h1>
        <p className={styles.subtitle}>Track what you want to see next and what you already watched in Solaris.</p>
      </section>

      {error ? <p className={styles.error}>{error}</p> : null}

      {loading ? (
        <section className={styles.stateCard}>
          <p className={styles.stateText}>Loading your movie lists...</p>
        </section>
      ) : (
        <section className={styles.grid}>
          <article className={styles.column}>
            <div className={styles.columnHeader}>
              <h2 className={styles.columnTitle}>Want To See</h2>
              <span className={styles.count}>{watchlistMovies.length}</span>
            </div>
            {watchlistMovies.length === 0 ? (
              <p className={styles.empty}>No movies saved yet. Add movies from the 3D galaxy.</p>
            ) : (
              <div className={styles.list}>
                {watchlistMovies.map(({ movie }) => (
                  <article className={styles.item} key={`watchlist-${movie.id}`}>
                    {movie.poster_path ? (
                      <img src={`https://image.tmdb.org/t/p/w92${movie.poster_path}`} className={styles.poster} alt="" />
                    ) : (
                      <div className={styles.posterFallback}>No Poster</div>
                    )}
                    <div className={styles.meta}>
                      <p className={styles.movieTitle}>{movie.title || 'Untitled'}</p>
                      <p className={styles.movieInfo}>{toYear(movie.release_date)} · Cluster {movie.cluster ?? 'N/A'}</p>
                      <div className={styles.actions}>
                        <button className={styles.primaryBtn} type="button" onClick={() => openWatchedModal(movie)}>
                          Mark Watched
                        </button>
                        <button className={styles.ghostBtn} type="button" onClick={() => removeFromWatchlist(movie.id)}>
                          Remove
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </article>

          <article className={styles.column}>
            <div className={styles.columnHeader}>
              <h2 className={styles.columnTitle}>Watched History</h2>
              <span className={styles.count}>{watchedMovies.length}</span>
            </div>
            {watchedMovies.length === 0 ? (
              <p className={styles.empty}>No watched movies yet.</p>
            ) : (
              <div className={styles.list}>
                {watchedMovies.map(({ movie, rating, watched_at: watchedAt, review }) => (
                  <article className={styles.item} key={`watched-${movie.id}`}>
                    {movie.poster_path ? (
                      <img src={`https://image.tmdb.org/t/p/w92${movie.poster_path}`} className={styles.poster} alt="" />
                    ) : (
                      <div className={styles.posterFallback}>No Poster</div>
                    )}
                    <div className={styles.meta}>
                      <p className={styles.movieTitle}>{movie.title || 'Untitled'}</p>
                      <p className={styles.movieInfo}>{toYear(movie.release_date)} · Cluster {movie.cluster ?? 'N/A'}</p>
                      <p className={styles.ratingLabel}>Rating: {Number.isInteger(rating) ? `${rating}/5` : 'Unrated'}</p>
                      <p className={styles.ratingLabel}>Watched: {watchedAt ? watchedAt.slice(0, 10) : 'Unknown date'}</p>
                      <p className={styles.reviewText}>{review ? review : 'No review added.'}</p>
                      <div className={styles.actions}>
                        <button className={styles.ghostBtn} type="button" onClick={() => removeFromWatched(movie.id)}>
                          Remove
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </article>
        </section>
      )}

      {watchedModalOpen && watchedTargetMovie ? (
        <div className={styles.watchedModalOverlay} onClick={closeWatchedModal}>
          <section className={styles.watchedModal} role="dialog" aria-modal="true" aria-label="Mark movie as watched" onClick={(event) => event.stopPropagation()}>
            <div className={styles.watchedModalHeader}>
              <h3 className={styles.watchedModalTitle}>Mark As Watched</h3>
              <button type="button" className={styles.ghostBtn} onClick={closeWatchedModal}>Close</button>
            </div>

            <p className={styles.watchedModalMovie}>{watchedTargetMovie.title || 'Untitled'}</p>

            <label className={styles.watchedModalLabel} htmlFor="watchlist-watched-rating">Rating</label>
            <select
              id="watchlist-watched-rating"
              className={styles.watchedModalInput}
              value={watchedFormRating}
              onChange={(event) => setWatchedFormRating(event.target.value)}
            >
              <option value="">No rating</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5</option>
            </select>

            <label className={styles.watchedModalLabel} htmlFor="watchlist-watched-date">Watch Date</label>
            <input
              id="watchlist-watched-date"
              type="date"
              className={styles.watchedModalInput}
              value={watchedFormDate}
              onChange={(event) => setWatchedFormDate(event.target.value)}
            />

            <label className={styles.watchedModalLabel} htmlFor="watchlist-watched-review">Review</label>
            <textarea
              id="watchlist-watched-review"
              className={styles.watchedModalTextarea}
              value={watchedFormReview}
              onChange={(event) => setWatchedFormReview(event.target.value)}
              placeholder="Write your thoughts..."
              rows={4}
            />

            <div className={styles.watchedModalActions}>
              <button type="button" className={styles.ghostBtn} onClick={closeWatchedModal}>Cancel</button>
              <button type="button" className={styles.primaryBtn} onClick={submitWatchedModal} disabled={watchedSaving}>
                {watchedSaving ? 'Saving...' : 'Save Watched'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}
