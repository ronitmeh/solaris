const EMPTY_GALAXY = { nodes: [], links: [] }

let galaxyDataCache = null
let galaxyDataPromise = null

const personalListsCache = new Map()

const fetchAllRows = async (supabase, tableName) => {
  const pageSize = 1000
  const allRows = []
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .range(from, from + pageSize - 1)

    if (error) throw error
    if (!data || data.length === 0) break

    allRows.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }

  return allRows
}

export const prefetchGalaxyData = async (supabase) => {
  if (galaxyDataCache) return galaxyDataCache
  if (galaxyDataPromise) return galaxyDataPromise

  galaxyDataPromise = (async () => {
    const [nodes, links] = await Promise.all([
      fetchAllRows(supabase, 'movie_galaxy'),
      fetchAllRows(supabase, 'movie_links')
    ])

    const normalized = {
      nodes: nodes.map((node) => ({ ...node, id: String(node.id) })),
      links: links.map((link) => ({
        source: String(link.source_id),
        target: String(link.target_id),
        value: Number(link.value || 1)
      }))
    }

    galaxyDataCache = normalized
    galaxyDataPromise = null
    return normalized
  })()

  try {
    return await galaxyDataPromise
  } catch (error) {
    galaxyDataPromise = null
    throw error
  }
}

export const getGalaxyDataSnapshot = () => galaxyDataCache || EMPTY_GALAXY

const mapPersonalRowsToPayload = (watchRows, historyRows, movieRows) => ({
  watchRows: watchRows || [],
  historyRows: (historyRows || []).map((row) => ({
    ...row,
    movie_id: String(row.movie_id),
    watched_at: row.watched_at || null,
    review: row.review || ''
  })),
  movieMap: new Map((movieRows || []).map((movie) => [String(movie.id), { ...movie, id: String(movie.id) }]))
})

const fetchPersonalLists = async (supabase, userId) => {
  const [{ data: watchRows, error: watchError }, { data: historyRows, error: historyError }] = await Promise.all([
    supabase
      .from('watchlist')
      .select('id, user_id, movie_id, created_at')
      .eq('user_id', userId),
    supabase
      .from('watched_history')
      .select('id, user_id, movie_id, rating, watched_at, review')
      .eq('user_id', userId)
  ])

  if (watchError) throw watchError
  if (historyError) throw historyError

  const allMovieIds = [...new Set([
    ...(watchRows || []).map((row) => String(row.movie_id)),
    ...(historyRows || []).map((row) => String(row.movie_id))
  ])]

  let movieRows = []
  if (allMovieIds.length > 0) {
    const { data: movies, error: movieError } = await supabase
      .from('movie_galaxy')
      .select('id, title, poster_path, release_date, cluster, overview')
      .in('id', allMovieIds)

    if (movieError) throw movieError
    movieRows = movies || []
  }

  return mapPersonalRowsToPayload(watchRows, historyRows, movieRows)
}

export const prefetchPersonalLists = async (supabase, userId) => {
  if (!userId) return { watchRows: [], historyRows: [], movieMap: new Map() }

  const key = String(userId)
  const entry = personalListsCache.get(key)

  if (entry?.data) return entry.data
  if (entry?.promise) return entry.promise

  const promise = (async () => {
    const data = await fetchPersonalLists(supabase, userId)
    personalListsCache.set(key, { data, promise: null })
    return data
  })()

  personalListsCache.set(key, { data: null, promise })

  try {
    return await promise
  } catch (error) {
    personalListsCache.delete(key)
    throw error
  }
}

export const refreshPersonalLists = async (supabase, userId) => {
  if (!userId) return { watchRows: [], historyRows: [], movieMap: new Map() }

  const key = String(userId)
  const data = await fetchPersonalLists(supabase, userId)
  personalListsCache.set(key, { data, promise: null })
  return data
}

export const getPersonalListsSnapshot = (userId) => {
  if (!userId) return { watchRows: [], historyRows: [], movieMap: new Map() }
  const entry = personalListsCache.get(String(userId))
  return entry?.data || { watchRows: [], historyRows: [], movieMap: new Map() }
}
