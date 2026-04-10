import { useMemo, useRef, useEffect, useState } from 'react'
import * as THREE from 'three'
import ForceGraph3D from 'react-force-graph-3d'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass'
import { supabase } from '../lib/supabase' 
import { prefetchGalaxyData, prefetchPersonalLists, refreshPersonalLists } from '../lib/dataPrefetch'
import styles from './HomePage.module.css'

const tutorialSteps = [
  {
    title: 'Navigate The Galaxy',
    body: 'Click and drag to rotate the view. Scroll to zoom in and out. Right-click drag to pan across clusters.'
  },
  {
    title: 'Search By Title',
    body: 'Use the title search on the left to jump directly to a movie. Selecting a result moves the camera and opens nearby recommendations.'
  },
  {
    title: 'Dashboard Options',
    body: 'Use the Now Playing and My Watchlist buttons in the left panel to open full-screen dashboard overlays. Now Playing includes posters, overviews, and similar movie poster strips.'
  },
  {
    title: 'Track Movies Fast',
    body: 'When a movie is focused, use the two icon buttons under Thematic Neighbors: the bookmark icon adds or removes watchlist, and the check icon opens watched details (rating, date, review).'
  },
  {
    title: 'Search By Description',
    body: 'Use the semantic search panel on the right to describe a mood or theme. Solaris finds the closest matching movies by meaning, not exact words.'
  },
  {
    title: 'Decade Explorer',
    body: 'Use the Decade Explorer in the bottom-left to step through one featured movie from each decade with lightweight navigation and optional graph focus.'
  }
]

const getReleaseYear = (releaseDate) => {
  if (typeof releaseDate !== 'string') return null
  const match = releaseDate.match(/^(\d{4})/)
  if (!match) return null
  const year = Number(match[1])
  return Number.isFinite(year) ? year : null
}

const getDecadeExplorerSummary = (decade) => {
  const summaries = {
    1920: 'Silent-era invention, bold visual language, and the first wave of movie spectacle set the tone for early cinema.',
    1930: 'Talkies, studio glamour, and genre foundations defined a decade of classic screen storytelling.',
    1940: 'War, noir, and sharper emotional tension shaped cinema with shadows and resilience.',
    1950: 'Wide screens, color, and postwar optimism pushed movies toward bigger images and bigger emotions.',
    1960: 'Rebellion, style, and cultural change brought riskier editing, new sounds, and more restless storytelling.',
    1970: 'Auteur-driven filmmaking, gritty realism, and blockbuster DNA transformed modern cinema.',
    1980: 'High-concept hits, practical effects, and genre-defining crowd-pleasers made movies feel larger than life.',
    1990: 'Studio spectacle and indie breakthroughs balanced each other with sharper pacing and iconic franchises.',
    2000: 'Digital tools, franchise storytelling, and global reach changed how films were built and shared.',
    2010: 'Streaming-era attention, franchise worlds, and more diverse voices reshaped mainstream movie culture.',
    2020: 'A flexible, platform-shaped era with theatrical rebounds, hybrid releases, and sharper genre experimentation.'
  }

  return summaries[decade] || 'This decade helped define the language of cinema through the films, styles, and trends that emerged within it.'
}

const formatNaturalList = (items) => {
  const filtered = (items || []).map((item) => String(item).trim()).filter(Boolean)
  if (filtered.length === 0) return ''
  if (filtered.length === 1) return filtered[0]
  if (filtered.length === 2) return `${filtered[0]} and ${filtered[1]}`
  return `${filtered.slice(0, -1).join(', ')}, and ${filtered[filtered.length - 1]}`
}

const buildClusterNarrative = ({ cluster, count, genres, topTitles, displayName }) => {
  const genreText = genres.length > 0 ? formatNaturalList(genres) : 'a blend of tones'
  const titleText = topTitles.length > 0 ? formatNaturalList(topTitles.slice(0, 3)) : 'a wide spectrum of films'
  const nameText = displayName || `This corner of Cluster ${cluster}`
  return `${nameText} leans into ${genreText}, with ${count} films orbiting around stories like ${titleText}.`
}

const CLUSTER_METADATA_BY_ID = {
  11: {
    displayName: "Noir's Horizon",
    coreGenre: 'Psychological Thriller',
    description: 'Dive into the shadows. This sector is home to obsessive investigators, cold-blooded mysteries, and the dark, atmospheric tension of modern noir.',
    keywords: ['thriller', 'mystery', 'crime', 'detective', 'noir', 'psychological']
  },
  10: {
    displayName: 'Comedy Aurora',
    coreGenre: 'Comedy & Uplift',
    description: 'A high-energy hub where laughter takes center stage. From slapstick underdogs to witty satires, this cluster is defined by its bright, feel-good spirit.',
    keywords: ['comedy', 'funny', 'satire', 'feel-good', 'romp', 'uplift']
  },
  9: {
    displayName: 'Cosmic Frontier',
    coreGenre: 'Sci-Fi & Space',
    description: 'The heart of the final frontier. Explore the intersection of high-concept technology, interstellar travel, and the vast mysteries of deep space.',
    keywords: ['sci-fi', 'space', 'alien', 'future', 'interstellar', 'cosmic']
  },
  8: {
    displayName: 'Mythic Nebula',
    coreGenre: 'Fantasy & Magic',
    description: 'A realm of magic and timeless wonders. This sector gathers the greatest tales of swords, sorcery, and mythical quests across ancient worlds.',
    keywords: ['fantasy', 'magic', 'myth', 'sword', 'sorcery', 'quest']
  },
  7: {
    displayName: 'Echoes of Home',
    coreGenre: 'Emotional Drama',
    description: 'A grounded sector focused on the human experience. These stories explore the ties of family, the weight of nostalgia, and the intimate moments that define us.',
    keywords: ['drama', 'family', 'life', 'home', 'heart', 'emotional']
  },
  6: {
    displayName: 'The Animated Menagerie',
    coreGenre: 'Animation & Family',
    description: 'A playful quadrant where imagination runs wild. Home to talking creatures, colorful adventures, and the timeless magic of animated storytelling.',
    keywords: ['animation', 'family', 'kids', 'adventure', 'animal', 'animated']
  },
  5: {
    displayName: 'Neon Heist Syndicate',
    coreGenre: 'Urban Action',
    description: 'High-octane energy meets city grit. This sector is fueled by stylish heists, adrenaline-pumping chases, and the neon-soaked aesthetics of urban crime.',
    keywords: ['action', 'heist', 'crime', 'city', 'chase', 'gang']
  },
  4: {
    displayName: 'Cipher Sector',
    coreGenre: 'War & Espionage',
    description: 'A tactical zone of high-stakes conflict. This cluster maps the clandestine world of international spies, government secrets, and the reality of the battlefield.',
    keywords: ['war', 'spy', 'espionage', 'military', 'battle', 'agent']
  },
  3: {
    displayName: "Affection's Orbit",
    coreGenre: 'Rom-Com & Music',
    description: 'The rhythmic heart of the galaxy. This sector explores the chemistry of relationships through the lens of romance and the pulse of music-driven dramas.',
    keywords: ['romance', 'love', 'music', 'relationship', 'rom-com', 'musical']
  },
  2: {
    displayName: 'Vanguard Multiverse',
    coreGenre: 'Superheroes',
    description: 'Where icons collide. This high-density sector houses the larger-than-life heroes and massive spectacles that define the modern blockbuster era.',
    keywords: ['superhero', 'hero', 'comic', 'avenger', 'marvel', 'dc']
  },
  1: {
    displayName: 'Terror Rift',
    coreGenre: 'Horror',
    description: 'A tear in the cosmic fabric where nightmares dwell. Enter a space of psychological dread, gothic hauntings, and visceral supernatural thrills.',
    keywords: ['horror', 'ghost', 'haunted', 'nightmare', 'supernatural', 'dread']
  },
  0: {
    displayName: 'Combat Plains',
    coreGenre: 'Westerns & Classics',
    description: 'The rugged roots of action. From the dusty trails of the Wild West to the precision of hand-to-hand combat, this sector honors the "lone hero" archetype.',
    keywords: ['western', 'classic', 'gunslinger', 'cowboy', 'martial', 'combat']
  }
}

const CLUSTER_NAME_BY_ID = {
  11: CLUSTER_METADATA_BY_ID[11].displayName,
  10: CLUSTER_METADATA_BY_ID[10].displayName,
  9: CLUSTER_METADATA_BY_ID[9].displayName,
  8: CLUSTER_METADATA_BY_ID[8].displayName,
  7: CLUSTER_METADATA_BY_ID[7].displayName,
  6: CLUSTER_METADATA_BY_ID[6].displayName,
  5: CLUSTER_METADATA_BY_ID[5].displayName,
  4: CLUSTER_METADATA_BY_ID[4].displayName,
  3: CLUSTER_METADATA_BY_ID[3].displayName,
  2: CLUSTER_METADATA_BY_ID[2].displayName,
  1: CLUSTER_METADATA_BY_ID[1].displayName,
  0: CLUSTER_METADATA_BY_ID[0].displayName
}

const WATCHED_FILTER_VALUE = '__watched__'
const WATCHED_NODE_COLOR = '#34d399'

const LOADING_FACTS = [
  'Movie posters help identify films instantly, even before the title is read.',
  'Overview text is often the fastest way to judge tone, genre, and pacing.',
  'Similarity links work best when theme, genre, and energy overlap together.',
  'Watchlist and watched history let the galaxy adapt to each viewer over time.'
]

const getLoadingMessages = () => ([
  `Building ${CLUSTER_NAME_BY_ID[11]} cluster...`,
  `Building ${CLUSTER_NAME_BY_ID[9]} cluster...`,
  `Building ${CLUSTER_NAME_BY_ID[8]} cluster...`,
  `Building ${CLUSTER_NAME_BY_ID[7]} cluster...`,
  `Fact: ${LOADING_FACTS[0]}`,
  `Fact: ${LOADING_FACTS[1]}`,
  `Fact: ${LOADING_FACTS[2]}`,
  `Fact: ${LOADING_FACTS[3]}`,
  'Gathering movie information: posters, overviews, genres, and release dates.',
  'Aligning similarity signals so related movies stay close in the galaxy.'
])

export default function HomePage() {
  const graphRef = useRef(null)
  const hasCompletedInitialRenderRef = useRef(false)
  const historyStepIndexRef = useRef(0)
  const [selectedNode, setSelectedNode] = useState(null)
  const [activeCluster, setActiveCluster] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [descriptionQuery, setDescriptionQuery] = useState('')
  const [descriptionResults, setDescriptionResults] = useState([])
  const [descriptionLoading, setDescriptionLoading] = useState(false)
  const [descriptionError, setDescriptionError] = useState('')
  const [clusterMenuOpen, setClusterMenuOpen] = useState(false)
  const [clusterInsightOpen, setClusterInsightOpen] = useState(false)
  const [clusterInsightCluster, setClusterInsightCluster] = useState(null)
  const [clusterInsightFallbacks, setClusterInsightFallbacks] = useState({})
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const [tutorialStepIndex, setTutorialStepIndex] = useState(0)
  const [decadeExplorerOpen, setDecadeExplorerOpen] = useState(false)
  const [decadeExplorerLoading, setDecadeExplorerLoading] = useState(false)
  const [decadeExplorerSequence, setDecadeExplorerSequence] = useState([])
  const [decadeExplorerIndex, setDecadeExplorerIndex] = useState(0)
  const [decadeExplorerCard, setDecadeExplorerCard] = useState(null)
  const [decadeExplorerSlideIndex, setDecadeExplorerSlideIndex] = useState(0)
  const [isHistoryMode, setIsHistoryMode] = useState(false)
  const [historyPreparing, setHistoryPreparing] = useState(false)
  const [historyPlaying, setHistoryPlaying] = useState(false)
  const [historyDecadeSequence, setHistoryDecadeSequence] = useState([])
  const [historyStepIndex, setHistoryStepIndex] = useState(0)
  const [historyCurrentDecade, setHistoryCurrentDecade] = useState(null)
  const [historyRevealedDecades, setHistoryRevealedDecades] = useState([])
  const [historySpotlightNodeId, setHistorySpotlightNodeId] = useState(null)
  const [historyFeatureCard, setHistoryFeatureCard] = useState(null)
  const [currentUserId, setCurrentUserId] = useState(null)
  const [watchlistMovieIds, setWatchlistMovieIds] = useState([])
  const [watchedHistoryRows, setWatchedHistoryRows] = useState([])
  const [personalListError, setPersonalListError] = useState('')
  const [watchedModalOpen, setWatchedModalOpen] = useState(false)
  const [watchedFormRating, setWatchedFormRating] = useState('')
  const [watchedFormDate, setWatchedFormDate] = useState('')
  const [watchedFormReview, setWatchedFormReview] = useState('')
  const [watchedFormSaving, setWatchedFormSaving] = useState(false)
  const [dashboardNowPlayingOpen, setDashboardNowPlayingOpen] = useState(false)
  const [dashboardWatchPlannerOpen, setDashboardWatchPlannerOpen] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState(4)
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0)
  
  const [dbData, setDbData] = useState({ nodes: [], links: [] })
  const [isLoaded, setIsLoaded] = useState(false)
  const [graphReady, setGraphReady] = useState(false)
  const loadingMessages = useMemo(() => getLoadingMessages(), [])

  const clusterColors = useMemo(() => [
    '#7dd3fc', '#fca5a5', '#86efac', '#fcd34d', '#c4b5fd', '#fdba74',
    '#67e8f9', '#f9a8d4', '#bbf7d0', '#93c5fd', '#f5d0fe', '#fde68a',
  ], [])

  const getClusterColor = (cluster) => clusterColors[Math.abs(cluster || 0) % clusterColors.length]

  const getLinkEndpointId = (endpoint) => {
    const rawId = typeof endpoint === 'object' ? endpoint?.id : endpoint
    return rawId !== undefined && rawId !== null ? String(rawId) : null
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

  const scoreNodeForClusterFit = (node, clusterMetadata) => {
    const metadata = clusterMetadata || {}
    const keywords = metadata.keywords || []
    const searchable = `${node.title || ''} ${node.overview || ''} ${node.tagline || ''}`.toLowerCase()
    const nodeGenres = parseGenres(node.genres).map((genre) => genre.toLowerCase())

    let keywordScore = 0
    for (const keyword of keywords) {
      const term = String(keyword || '').toLowerCase().trim()
      if (!term) continue
      if (searchable.includes(term)) keywordScore += 4
      if (nodeGenres.some((genre) => genre.includes(term) || term.includes(genre))) keywordScore += 5
    }

    const posterBonus = node.poster_path ? 10 : 0
    const voteScore = Number(node.vote_average || 0) * 0.45
    const popularityScore = Math.log10(Number(node.popularity || 0) + 1)

    return keywordScore + posterBonus + voteScore + popularityScore
  }

  // 1. DATA FETCHING
  useEffect(() => {
    const fetchGalaxy = async () => {
      try {
        const galaxyData = await prefetchGalaxyData(supabase)
        setDbData(galaxyData)
        hasCompletedInitialRenderRef.current = false
        setGraphReady(false)
        setIsLoaded(true)
      } catch (e) { console.error(e) }
    }
    fetchGalaxy()
  }, [])

  const graphData = useMemo(() => ({
    nodes: dbData.nodes.map(n => ({ ...n, overview: n.overview || 'No description available.' })),
    links: dbData.links
  }), [dbData])

  const nodeById = useMemo(() => new Map(graphData.nodes.map(n => [n.id, n])), [graphData.nodes])

  // 2. ADJACENCY LOGIC
  const adjacency = useMemo(() => {
    const map = new Map()
    for (const link of graphData.links) {
      const s = getLinkEndpointId(link.source), t = getLinkEndpointId(link.target)
      if (!s || !t) continue
      if (!map.has(s)) map.set(s, [])
      if (!map.has(t)) map.set(t, [])
      map.get(s).push({ id: t, weight: link.value })
      map.get(t).push({ id: s, weight: link.value })
    }
    return map
  }, [graphData.links])

  const closestMovies = useMemo(() => {
    if (!selectedNode) return []
    const neighbors = adjacency.get(selectedNode.id) || []
    const unique = new Map()
    for (const nb of neighbors) {
      const node = nodeById.get(String(nb.id))
      if (node) unique.set(node.id, { node, weight: nb.weight })
    }
    return [...unique.values()].sort((a, b) => b.weight - a.weight).slice(0, 6)
  }, [selectedNode, adjacency, nodeById])

  const historyBounds = useMemo(() => {
    const years = graphData.nodes
      .map((node) => getReleaseYear(node.release_date))
      .filter((year) => year !== null)

    if (years.length === 0) return { min: null, max: null }

    return {
      min: Math.min(...years),
      max: Math.max(...years)
    }
  }, [graphData.nodes])

  const historyMinYear = historyBounds.min
  const historyMaxYear = historyBounds.max

  const historyDecades = useMemo(() => {
    const decades = new Set()
    for (const node of graphData.nodes) {
      const year = getReleaseYear(node.release_date)
      if (year === null) continue
      decades.add(Math.floor(year / 10) * 10)
    }
    return [...decades].sort((a, b) => a - b)
  }, [graphData.nodes])

  const historyFallbackByDecade = useMemo(() => {
    const picks = new Map()
    for (const node of graphData.nodes) {
      const year = getReleaseYear(node.release_date)
      if (year === null) continue
      const decade = Math.floor(year / 10) * 10
      const existing = picks.get(decade)
      if (!existing) {
        picks.set(decade, node)
        continue
      }

      const existingVote = Number(existing.vote_average || 0)
      const nodeVote = Number(node.vote_average || 0)
      if (nodeVote > existingVote) {
        picks.set(decade, node)
        continue
      }

      if (nodeVote === existingVote) {
        const existingPopularity = Number(existing.popularity || 0)
        const nodePopularity = Number(node.popularity || 0)
        if (nodePopularity > existingPopularity) {
          picks.set(decade, node)
        }
      }
    }
    return picks
  }, [graphData.nodes])

  const revealedDecadeSet = useMemo(() => new Set(historyRevealedDecades), [historyRevealedDecades])

  const historySpotlightIds = useMemo(() => {
    if (!isHistoryMode || !historySpotlightNodeId) return new Set()
    return new Set([String(historySpotlightNodeId)])
  }, [historySpotlightNodeId, isHistoryMode])

  const isNodeReleasedByHistory = (node) => {
    if (!isHistoryMode) return true
    const year = getReleaseYear(node.release_date)
    if (year === null) return false
    const decade = Math.floor(year / 10) * 10
    return revealedDecadeSet.has(decade) || String(node.id) === String(historySpotlightNodeId)
  }

  const getLinkEndpointNode = (endpoint) => {
    if (typeof endpoint === 'object') return endpoint
    return nodeById.get(String(endpoint))
  }

  const isLinkEndpointReleased = (endpoint) => {
    const node = getLinkEndpointNode(endpoint)
    if (!node) return false
    return isNodeReleasedByHistory(node)
  }

  const clusterProfiles = useMemo(() => {
    const buckets = new Map()

    for (const node of graphData.nodes) {
      const cluster = Number(node.cluster ?? 0)
      if (!buckets.has(cluster)) {
        buckets.set(cluster, {
          cluster,
          count: 0,
          nodes: [],
          genreCounts: new Map()
        })
      }

      const bucket = buckets.get(cluster)
      bucket.count += 1
      bucket.nodes.push(node)

      for (const genre of parseGenres(node.genres)) {
        bucket.genreCounts.set(genre, (bucket.genreCounts.get(genre) || 0) + 1)
      }
    }

    return new Map([...buckets.entries()].map(([cluster, value]) => {
      const topGenres = [...value.genreCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([genre]) => genre)

      const rankedNodes = [...value.nodes]
        .sort((a, b) => {
          const voteDelta = Number(b.vote_average || 0) - Number(a.vote_average || 0)
          if (voteDelta !== 0) return voteDelta
          return Number(b.popularity || 0) - Number(a.popularity || 0)
        })

      const topTitles = rankedNodes
        .slice(0, 5)
        .map((node) => node.title)
        .filter(Boolean)

      const metadata = CLUSTER_METADATA_BY_ID[cluster]

      const fitRankedNodes = [...value.nodes]
        .sort((a, b) => {
          const aScore = scoreNodeForClusterFit(a, metadata)
          const bScore = scoreNodeForClusterFit(b, metadata)
          if (bScore !== aScore) return bScore - aScore
          return Number(b.popularity || 0) - Number(a.popularity || 0)
        })

      const posterRankedNodes = fitRankedNodes.filter((node) => Boolean(node.poster_path))
      const fallbackRankedNodes = fitRankedNodes.filter((node) => !node.poster_path)

      const highlightMovies = [...posterRankedNodes, ...fallbackRankedNodes]
        .slice(0, 2)
        .map((node) => ({
          id: String(node.id),
          title: node.title || 'Untitled',
          poster_path: node.poster_path || null,
          release_date: node.release_date || null
        }))

      const displayName = metadata?.displayName || CLUSTER_NAME_BY_ID[cluster] || `Cluster ${cluster}`
      const coreGenre = metadata?.coreGenre || (topGenres.length > 0 ? formatNaturalList(topGenres.slice(0, 2)) : 'Mixed Genres')
      const summary = metadata?.description || buildClusterNarrative({
        cluster,
        count: value.count,
        genres: topGenres,
        topTitles,
        displayName
      })

      return [cluster, {
        cluster,
        count: value.count,
        topGenres,
        topTitles,
        highlightMovies,
        displayName,
        coreGenre,
        summary
      }]
    }))
  }, [graphData.nodes])

  const clusterLegend = useMemo(() => {
    const counts = new Map()
    for (const node of graphData.nodes) {
      const key = node.cluster ?? 0
      counts.set(key, (counts.get(key) || 0) + 1)
    }

    return [...counts.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([cluster, count]) => ({
        cluster,
        count,
        name: clusterProfiles.get(Number(cluster))?.displayName || `Cluster ${cluster}`,
        color: getClusterColor(cluster)
      }))
  }, [graphData.nodes, clusterProfiles, clusterColors])

  const getClusterDisplayLabel = (cluster) => {
    if (cluster === WATCHED_FILTER_VALUE) return 'Watched Movies'
    const profile = clusterProfiles.get(Number(cluster))
    if (!profile) return `Cluster ${cluster}`
    return `Cluster ${cluster} · ${profile.displayName}`
  }

  const formatWatchedDateLabel = (value) => {
    if (!value) return 'No date'
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return value
    return parsed.toLocaleDateString()
  }

  const selectedClusterInsightProfile = useMemo(() => {
    if (!clusterInsightOpen || clusterInsightCluster === null) return null
    return clusterProfiles.get(Number(clusterInsightCluster)) || null
  }, [clusterInsightCluster, clusterInsightOpen, clusterProfiles])

  const watchlistIdSet = useMemo(() => new Set(watchlistMovieIds.map((movieId) => String(movieId))), [watchlistMovieIds])
  const watchedMovieIdSet = useMemo(() => new Set(watchedHistoryRows.map((row) => String(row.movie_id))), [watchedHistoryRows])
  const watchedRowByMovieId = useMemo(() => {
    const map = new Map()
    for (const row of watchedHistoryRows) {
      map.set(String(row.movie_id), row)
    }
    return map
  }, [watchedHistoryRows])
  const watchedModeEnabled = activeCluster === WATCHED_FILTER_VALUE
  const dashboardNowPlaying = useMemo(() => {
    return [...graphData.nodes]
      .filter((node) => Boolean(node.is_now_playing))
      .sort((a, b) => Number(b.popularity || 0) - Number(a.popularity || 0))
      .slice(0, 50)
  }, [graphData.nodes])

  const dashboardNowPlayingSimilarById = useMemo(() => {
    const map = new Map()

    for (const movie of dashboardNowPlaying) {
      const movieId = String(movie.id)
      const neighbors = adjacency.get(movieId) || adjacency.get(movie.id) || []
      const uniqueNeighbors = new Map()

      for (const neighbor of neighbors) {
        const neighborNode = nodeById.get(String(neighbor.id))
        if (!neighborNode || String(neighborNode.id) === movieId) continue
        uniqueNeighbors.set(String(neighborNode.id), {
          node: neighborNode,
          weight: Number(neighbor.weight || 0)
        })
      }

      map.set(movieId, [...uniqueNeighbors.values()].sort((a, b) => b.weight - a.weight).slice(0, 5))
    }

    return map
  }, [adjacency, dashboardNowPlaying, nodeById])

  const dashboardWatchlistMovies = useMemo(() => {
    return watchlistMovieIds
      .map((movieId) => nodeById.get(String(movieId)))
      .filter(Boolean)
      .sort((a, b) => Number(b.popularity || 0) - Number(a.popularity || 0))
  }, [nodeById, watchlistMovieIds])

  const dashboardWatchedMovies = useMemo(() => {
    return watchedHistoryRows
      .map((row) => ({
        ...row,
        movie: nodeById.get(String(row.movie_id))
      }))
      .filter((entry) => Boolean(entry.movie))
      .sort((a, b) => {
        const aTime = a.watched_at ? new Date(a.watched_at).getTime() : 0
        const bTime = b.watched_at ? new Date(b.watched_at).getTime() : 0
        return bTime - aTime
      })
  }, [nodeById, watchedHistoryRows])

  const loadPersonalLists = async (userId) => {
    if (!userId) {
      setWatchlistMovieIds([])
      setWatchedHistoryRows([])
      return
    }

    const payload = await prefetchPersonalLists(supabase, userId)
    setWatchlistMovieIds((payload.watchRows || []).map((row) => String(row.movie_id)))
    setWatchedHistoryRows((payload.historyRows || []).map((row) => ({
      movie_id: String(row.movie_id),
      rating: row.rating ?? null,
      watched_at: typeof row.watched_at === 'string' ? row.watched_at.slice(0, 10) : null,
      review: row.review || ''
    })))
  }

  useEffect(() => {
    let mounted = true

    const bootstrapUser = async () => {
      try {
        const { data, error } = await supabase.auth.getUser()
        if (error) throw error
        if (!mounted) return
        const userId = data?.user?.id || null
        setCurrentUserId(userId)
        await loadPersonalLists(userId)
      } catch (error) {
        console.error('Failed to initialize personal movie lists', error)
        if (mounted) setPersonalListError('Could not load your watchlist data.')
      }
    }

    bootstrapUser()

    return () => {
      mounted = false
    }
  }, [])

  const toggleWatchlistMovie = async (node) => {
    if (!node || !currentUserId) {
      setPersonalListError('Sign in to save movies to your watchlist.')
      return
    }

    setPersonalListError('')
    const movieId = String(node.id)

    try {
      if (watchlistIdSet.has(movieId)) {
        const { error } = await supabase
          .from('watchlist')
          .delete()
          .eq('user_id', currentUserId)
          .eq('movie_id', movieId)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('watchlist')
          .insert({ user_id: currentUserId, movie_id: movieId })

        if (error) throw error
      }

      const payload = await refreshPersonalLists(supabase, currentUserId)
      setWatchlistMovieIds((payload.watchRows || []).map((row) => String(row.movie_id)))
      setWatchedHistoryRows((payload.historyRows || []).map((row) => ({
        movie_id: String(row.movie_id),
        rating: row.rating ?? null,
        watched_at: typeof row.watched_at === 'string' ? row.watched_at.slice(0, 10) : null,
        review: row.review || ''
      })))
    } catch (error) {
      console.error('Watchlist update failed', error)
      setPersonalListError('Could not update your watchlist right now.')
    }
  }

  const addMovieToWatchedHistory = async (node, details = {}) => {
    if (!node || !currentUserId) {
      setPersonalListError('Sign in to track watched movies.')
      return false
    }

    const movieId = String(node.id)
    const ratingValue = Number.isInteger(details.rating) ? details.rating : null
    const watchedAtValue = typeof details.watched_at === 'string' && details.watched_at.trim() ? details.watched_at : null
    const reviewValue = typeof details.review === 'string' ? details.review.trim() : ''
    setPersonalListError('')

    try {
      const { data: existingRows, error: existingError } = await supabase
        .from('watched_history')
        .select('movie_id')
        .eq('user_id', currentUserId)
        .eq('movie_id', movieId)
        .limit(1)

      if (existingError) throw existingError

      if ((existingRows || []).length > 0) {
        const { error } = await supabase
          .from('watched_history')
          .update({
            rating: ratingValue,
            watched_at: watchedAtValue,
            review: reviewValue
          })
          .eq('user_id', currentUserId)
          .eq('movie_id', movieId)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('watched_history')
          .insert({
            user_id: currentUserId,
            movie_id: movieId,
            rating: ratingValue,
            watched_at: watchedAtValue,
            review: reviewValue
          })

        if (error) throw error
      }

      // Prevent overlap: watched movies should not stay in the watchlist.
      const { error: removeWatchlistError } = await supabase
        .from('watchlist')
        .delete()
        .eq('user_id', currentUserId)
        .eq('movie_id', movieId)

      if (removeWatchlistError) {
        console.warn('Unable to remove watched movie from watchlist', removeWatchlistError)
      }

      const payload = await refreshPersonalLists(supabase, currentUserId)
      setWatchlistMovieIds((payload.watchRows || []).map((row) => String(row.movie_id)))
      setWatchedHistoryRows((payload.historyRows || []).map((row) => ({
        movie_id: String(row.movie_id),
        rating: row.rating ?? null,
        watched_at: typeof row.watched_at === 'string' ? row.watched_at.slice(0, 10) : null,
        review: row.review || ''
      })))
      return true
    } catch (error) {
      console.error('Failed to update watched history', error)
      setPersonalListError('Could not update watched history right now.')
      return false
    }
  }

  const selectedClusterInsightMovies = useMemo(() => {
    if (!selectedClusterInsightProfile) return []

    const primary = (selectedClusterInsightProfile.highlightMovies || []).filter((movie) => Boolean(movie?.poster_path))
    const fallback = clusterInsightFallbacks[String(selectedClusterInsightProfile.cluster)] || []

    const merged = [...primary]
    const seen = new Set(primary.map((movie) => String(movie.id)))

    for (const movie of fallback) {
      const id = String(movie.id)
      if (seen.has(id)) continue
      if (!movie.poster_path) continue
      merged.push(movie)
      seen.add(id)
      if (merged.length >= 2) break
    }

    return merged.slice(0, 2)
  }, [clusterInsightFallbacks, selectedClusterInsightProfile])

  const ensureClusterPosterFallbacks = async (cluster, existingMovies = []) => {
    const key = String(cluster)
    if (clusterInsightFallbacks[key]?.length > 0) return

    const existingIds = new Set(existingMovies.map((movie) => String(movie.id)))

    try {
      const { data, error } = await supabase
        .from('movie_galaxy')
        .select('id, title, release_date, poster_path, popularity, vote_average')
        .eq('cluster', cluster)
        .not('poster_path', 'is', null)
        .order('popularity', { ascending: false })
        .order('vote_average', { ascending: false })
        .limit(8)

      if (error) throw error

      const extras = (data || [])
        .map((movie) => ({
          id: String(movie.id),
          title: movie.title || 'Untitled',
          poster_path: movie.poster_path || null,
          release_date: movie.release_date || null
        }))
        .filter((movie) => movie.poster_path && !existingIds.has(String(movie.id)))

      if (extras.length > 0) {
        setClusterInsightFallbacks((prev) => ({
          ...prev,
          [key]: extras
        }))
      }
    } catch (error) {
      console.warn('Failed to fetch fallback cluster posters', error)
    }
  }

  useEffect(() => {
    if (!selectedClusterInsightProfile) return
    if (selectedClusterInsightMovies.length >= 2) return

    ensureClusterPosterFallbacks(
      selectedClusterInsightProfile.cluster,
      selectedClusterInsightProfile.highlightMovies || []
    )
  }, [selectedClusterInsightMovies.length, selectedClusterInsightProfile])

  const handleClusterLegendSelect = (cluster) => {
    if (cluster === null || cluster === undefined) {
      setActiveCluster(null)
      setClusterMenuOpen(false)
      setClusterInsightOpen(false)
      setClusterInsightCluster(null)
      return
    }

    if (cluster === WATCHED_FILTER_VALUE) {
      setActiveCluster(WATCHED_FILTER_VALUE)
      setClusterMenuOpen(false)
      setClusterInsightOpen(false)
      setClusterInsightCluster(null)
      return
    }

    const normalizedCluster = Number(cluster)
    setActiveCluster(normalizedCluster)
    setClusterMenuOpen(false)
    setClusterInsightCluster(normalizedCluster)
    setClusterInsightOpen(true)

    const profile = clusterProfiles.get(normalizedCluster)
    const posterCount = (profile?.highlightMovies || []).filter((movie) => Boolean(movie?.poster_path)).length
    if (posterCount < 2) {
      ensureClusterPosterFallbacks(normalizedCluster, profile?.highlightMovies || [])
    }
  }

  // 3. SEARCH LOGIC
  useEffect(() => {
    if (searchQuery.length < 2) return setSearchResults([])
    setSearchResults(graphData.nodes.filter(n => n.title?.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 8))
  }, [searchQuery, graphData.nodes])

  const runDescriptionSearch = async () => {
    const query = descriptionQuery.trim()
    if (query.length < 3) {
      setDescriptionError('Enter at least 3 characters.')
      setDescriptionResults([])
      return
    }

    try {
      setDescriptionLoading(true)
      setDescriptionError('')
      
      // 1. Get embedding from your proxy
        const response = await fetch('/api/get_embedding', {
            method: 'POST',
            body: JSON.stringify({ text: descriptionQuery })
        });
        
        // This is where the "Unexpected token <" fix happens:
        // Check if the response is actually JSON before parsing
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            throw new Error("Oops! The server sent back HTML instead of data. Check your Vercel logs.");
        }

        const vector = await response.json();

        console.log('Received embedding vector:', vector)



        const { data, error } = await supabase.rpc('match_movies', {
        query_embedding: vector,
        match_threshold: 0.1,
        match_count: 8
        })

      if (error) throw error

      const normalized = (data || [])
        .map((movie) => nodeById.get(String(movie.id)))
        .filter(Boolean)

      setDescriptionResults(normalized)
      if (normalized.length === 0) {
        setDescriptionError('No matches found for that description.')
      }
    } catch (error) {
      console.error(error)
      setDescriptionError('Description search failed. Please try again.')
    } finally {
      setDescriptionLoading(false)
    }
  }

  const clearDescriptionResults = () => {
    setDescriptionResults([])
    setDescriptionError('')
  }

  const loadHistorySequenceFromSupabase = async () => {
    const sequence = []

    for (const decade of historyDecades) {
      try {
        const { data, error } = await supabase
          .from('movie_galaxy')
          .select('id, title, overview, release_date, vote_average, popularity, genres, poster_path, cluster')
          .gte('release_date', `${decade}-01-01`)
          .lte('release_date', `${decade + 9}-12-31`)
          .order('vote_average', { ascending: false })
          .order('popularity', { ascending: false })
          .limit(1)

        if (error) {
          console.warn(`Failed to fetch spotlight movie for ${decade}s`, error)
        }

        const fetched = data?.[0] ? { ...data[0], id: String(data[0].id) } : null
        const graphMovie = fetched ? nodeById.get(String(fetched.id)) : null
        const fallback = historyFallbackByDecade.get(decade)
        const chosenMovie = graphMovie || fallback

        if (chosenMovie) {
          sequence.push({
            decade,
            movieId: String(chosenMovie.id),
            movie: {
              ...chosenMovie,
              ...(fetched || {})
            }
          })
        }
      } catch (error) {
        console.warn(`Unexpected history fetch failure for ${decade}s`, error)
        const fallback = historyFallbackByDecade.get(decade)
        if (fallback) {
          sequence.push({
            decade,
            movieId: String(fallback.id),
            movie: fallback
          })
        }
      }
    }

    return sequence
  }

  const startMovieHistory = async () => {
    if (historyMinYear === null) return

    setHistoryPreparing(true)
    setIsHistoryMode(true)
    setSelectedNode(null)
    setHistoryRevealedDecades([])
    setHistoryCurrentDecade(null)
    setHistorySpotlightNodeId(null)
    setHistoryFeatureCard(null)
    setHistoryStepIndex(0)
    historyStepIndexRef.current = 0

    let sequence = historyDecadeSequence
    if (sequence.length === 0) {
      sequence = await loadHistorySequenceFromSupabase()
      setHistoryDecadeSequence(sequence)
    }

    setHistoryPreparing(false)
    setHistoryPlaying(false)
  }

  const runNextHistoryStep = async () => {
    if (!isHistoryMode || historyPreparing || historyPlaying) return

    const index = historyStepIndexRef.current
    if (index >= historyDecadeSequence.length) {
      closeMovieHistory()
      return
    }

    const step = historyDecadeSequence[index]
    if (!step) return

    setHistoryPlaying(true)
    setHistoryCurrentDecade(step.decade)
    setHistorySpotlightNodeId(step.movieId)
    setHistoryFeatureCard({ decade: step.decade, movie: step.movie })

    const graphNode = nodeById.get(String(step.movieId))
    if (graphNode) {
      focusOnNode(graphNode, { select: false, duration: 900 })
    }

    await new Promise((resolve) => window.setTimeout(resolve, 700))

    setHistoryRevealedDecades((prev) => (prev.includes(step.decade) ? prev : [...prev, step.decade]))

    const nextIndex = index + 1
    historyStepIndexRef.current = nextIndex
    setHistoryStepIndex(nextIndex)

    if (nextIndex >= historyDecadeSequence.length) {
      setHistoryCurrentDecade(null)
      setHistorySpotlightNodeId(null)
    }

    setHistoryPlaying(false)
  }

  const closeMovieHistory = () => {
    setIsHistoryMode(false)
    setHistoryPreparing(false)
    setHistoryPlaying(false)
    setHistoryCurrentDecade(null)
    setHistoryRevealedDecades([])
    setHistorySpotlightNodeId(null)
    setHistoryFeatureCard(null)
    setHistoryStepIndex(0)
    historyStepIndexRef.current = 0
  }

  const ensureDecadeExplorerSequence = async () => {
    if (decadeExplorerSequence.length > 0) return decadeExplorerSequence

    setDecadeExplorerLoading(true)
    try {
      const sequence = await loadHistorySequenceFromSupabase()
      setDecadeExplorerSequence(sequence)
      return sequence
    } finally {
      setDecadeExplorerLoading(false)
    }
  }

  const openDecadeExplorer = async () => {
    setDecadeExplorerOpen(true)
    setDecadeExplorerSlideIndex(0)
    const sequence = await ensureDecadeExplorerSequence()
    if (sequence.length === 0) {
      setDecadeExplorerCard(null)
      return
    }
    setDecadeExplorerIndex((current) => {
      const nextIndex = Math.min(current, sequence.length - 1)
      setDecadeExplorerCard(sequence[nextIndex])
      return nextIndex
    })
  }

  const shiftDecadeExplorer = async (direction) => {
    const sequence = await ensureDecadeExplorerSequence()
    if (sequence.length === 0) return

    setDecadeExplorerIndex((current) => {
      const nextIndex = THREE.MathUtils.clamp(current + direction, 0, sequence.length - 1)
      setDecadeExplorerCard(sequence[nextIndex])
      setDecadeExplorerSlideIndex(0)
      return nextIndex
    })
  }

  // 4. RENDERING & FOCUS
  const focusOnNode = (node, options = {}) => {
    if (!graphRef.current || !node) return
    const { select = true, duration = 1400 } = options

    const target = {
      x: Number.isFinite(node.x) ? node.x : 0,
      y: Number.isFinite(node.y) ? node.y : 0,
      z: Number.isFinite(node.z) ? node.z : 0
    }

    const neighborNodes = (adjacency.get(node.id) || [])
      .map((neighbor) => nodeById.get(String(neighbor.id)))
      .filter(Boolean)
      .filter((neighbor) => Number.isFinite(neighbor.x) && Number.isFinite(neighbor.y) && Number.isFinite(neighbor.z))

    let radius = 4
    for (const neighbor of neighborNodes) {
      const distanceFromTarget = Math.hypot(
        neighbor.x - target.x,
        neighbor.y - target.y,
        neighbor.z - target.z
      )
      radius = Math.max(radius, distanceFromTarget)
    }

    const camera = graphRef.current.camera()
    const verticalFov = ((camera?.fov || 60) * Math.PI) / 180
    const fitDistance = radius / Math.tan(verticalFov / 2)
    const distance = Math.max(10, fitDistance * 0.95)

    const direction = new THREE.Vector3(target.x, target.y, target.z)
    if (direction.lengthSq() < 0.0001) {
      direction.set(0, 0, 1)
    }
    direction.normalize()

    graphRef.current.cameraPosition(
      {
        x: target.x + direction.x * distance,
        y: target.y + direction.y * distance,
        z: target.z + direction.z * distance
      },
      target,
      duration
    )

    if (select) {
      window.setTimeout(() => {
        setSelectedNode(node)
        setSearchQuery('')
      }, duration)
    }
  }

  const createNodeObject = (node) => {
    const isWatchedMovie = watchedMovieIdSet.has(String(node.id))
    const isMatch = activeCluster === null
      ? true
      : watchedModeEnabled
        ? isWatchedMovie
        : node.cluster === activeCluster
    const isSelected = selectedNode?.id === node.id
    const isReleased = isNodeReleasedByHistory(node)
    const isSpotlight = historySpotlightIds.has(String(node.id))

    let opacity = isSelected || isMatch ? 1 : 0.15

    if (watchedModeEnabled) {
      opacity = isSelected ? 1 : isWatchedMovie ? 0.98 : 0.08
    }

    if (isHistoryMode) {
      if (isSpotlight) {
        opacity = 1
      } else if (!isReleased) {
        opacity = 0.14
      } else {
        opacity = isMatch ? 0.72 : 0.35
      }
    }

    const group = new THREE.Group()

    if (isWatchedMovie) {
      const blockMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(isSelected ? '#8af5cc' : WATCHED_NODE_COLOR),
        transparent: true,
        opacity
      })
      const blockMesh = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.95, 0.95), blockMaterial)
      const blockScale = isSelected ? 1.45 : isMatch ? 1.15 : 0.9
      blockMesh.scale.set(blockScale, blockScale, blockScale)
      group.add(blockMesh)
    } else {
      const glowMaterial = new THREE.SpriteMaterial({
        map: glowTexture,
        color: getClusterColor(node.cluster),
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })

      const glowSprite = new THREE.Sprite(glowMaterial)
      const glowScale = isHistoryMode
        ? (isSpotlight ? 2.25 : !isReleased ? 0.32 : isSelected ? 2.6 : isMatch ? 1.05 : 0.62)
        : (isSelected ? 2.5 : isMatch ? 1.1 : 0.6)
      glowSprite.scale.set(glowScale, glowScale, 1)
      group.add(glowSprite)

      if (isSelected) {
        glowSprite.material.color = new THREE.Color(getClusterColor(node.cluster)).lerp(new THREE.Color('#ffffff'), 0.28)
        glowSprite.material.opacity = 1
        glowSprite.scale.set(2.1, 2.1, 1)
      }
    }

    return group
  }

  const glowTexture = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64
    const ctx = canvas.getContext('2d'), grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)'); grad.addColorStop(0.2, 'rgba(255, 255, 255, 0.8)'); grad.addColorStop(1, 'rgba(255, 255, 255, 0)')
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 64, 64)
    return new THREE.CanvasTexture(canvas)
  }, [])

  useEffect(() => {
    if (!graphRef.current || !isLoaded) return
    const fg = graphRef.current
    fg.d3Force('center', null)
    fg.d3Force('charge').strength(-0.16)
    fg.renderer().setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25))
    fg.cameraPosition({ x: 0, y: 0, z: 900 }, { x: 0, y: 0, z: 0 }, 1200)
    const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.45, 0.3, 0.9)
    fg.postProcessingComposer().addPass(bloom)
  }, [isLoaded])

  useEffect(() => {
    if (!isHistoryMode && historyPlaying) {
      setHistoryPlaying(false)
    }
  }, [historyPlaying, isHistoryMode])

  useEffect(() => {
    if (!graphRef.current) return
    graphRef.current.refresh()
  }, [activeCluster, historyRevealedDecades, historySpotlightIds, isHistoryMode, selectedNode, watchedMovieIdSet, watchedModeEnabled])

  const openWatchedModal = (node) => {
    if (!node) return
    if (!currentUserId) {
      setPersonalListError('Sign in to track watched movies.')
      return
    }
    setSelectedNode(node)
    const existing = watchedRowByMovieId.get(String(node.id))
    setWatchedFormRating(Number.isInteger(existing?.rating) ? String(existing.rating) : '')
    setWatchedFormDate(existing?.watched_at || '')
    setWatchedFormReview(existing?.review || '')
    setWatchedModalOpen(true)
  }

  const closeWatchedModal = () => {
    setWatchedModalOpen(false)
    setWatchedFormSaving(false)
  }

  useEffect(() => {
    if (isLoaded && graphReady) {
      setLoadingProgress(100)
      return undefined
    }

    setLoadingProgress(4)
    setLoadingMessageIndex(0)

    const progressTimer = window.setInterval(() => {
      setLoadingProgress((current) => Math.min(92, current + (current < 50 ? 3 : current < 75 ? 2 : 1)))
    }, 160)

    const messageTimer = window.setInterval(() => {
      setLoadingMessageIndex((current) => (current + 1) % loadingMessages.length)
    }, 1800)

    return () => {
      window.clearInterval(progressTimer)
      window.clearInterval(messageTimer)
    }
  }, [graphReady, isLoaded, loadingMessages.length])

  const submitWatchedModal = async () => {
    if (!selectedNode) return
    setWatchedFormSaving(true)
    const ok = await addMovieToWatchedHistory(selectedNode, {
      rating: watchedFormRating ? Number(watchedFormRating) : null,
      watched_at: watchedFormDate,
      review: watchedFormReview
    })
    setWatchedFormSaving(false)
    if (ok) setWatchedModalOpen(false)
  }

  const loadingMessage = !isLoaded
    ? 'Collecting star maps from the archive...'
    : 'Stabilizing orbits and rendering the galaxy...'

  const loadingDisplayMessage = loadingMessages[loadingMessageIndex] || loadingMessage

  const explorerTotal = decadeExplorerSequence.length
  const explorerDisplayIndex = explorerTotal === 0 ? 0 : decadeExplorerIndex + 1

  const currentTutorialStep = tutorialSteps[tutorialStepIndex]
  const currentDecadeExplorerSummary = decadeExplorerCard ? getDecadeExplorerSummary(decadeExplorerCard.decade) : ''

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <aside className={`${styles.detailPanel} ${decadeExplorerOpen ? styles.detailPanelExplorerOpen : ''}`}>
          <div className={styles.panelContent}>
            <section className={styles.panelSearches}>
              <div className={styles.clusterDropdownWrap}>
                <button
                  type="button"
                  className={styles.clusterDropdownBtn}
                  onClick={() => setClusterMenuOpen((open) => !open)}
                >
                  {activeCluster === null ? 'All Clusters' : getClusterDisplayLabel(activeCluster)}
                </button>
                {clusterMenuOpen && (
                  <div className={styles.clusterDropdownMenu}>
                    <button
                      type="button"
                      className={`${styles.clusterDropdownItem} ${activeCluster === null ? styles.activeClusterDropdownItem : ''}`}
                      onClick={() => handleClusterLegendSelect(null)}
                    >
                      <span className={styles.colorDot} style={{ color: '#e2e8f0', background: '#e2e8f0' }} />
                      <span>All Clusters</span>
                      <span className={styles.legendCount}>{graphData.nodes.length}</span>
                    </button>
                    <button
                      type="button"
                      className={`${styles.clusterDropdownItem} ${activeCluster === WATCHED_FILTER_VALUE ? styles.activeClusterDropdownItem : ''}`}
                      onClick={() => handleClusterLegendSelect(WATCHED_FILTER_VALUE)}
                    >
                      <span className={styles.colorDot} style={{ color: WATCHED_NODE_COLOR, background: WATCHED_NODE_COLOR }} />
                      <span>Watched Movies</span>
                      <span className={styles.legendCount}>{watchedMovieIdSet.size}</span>
                    </button>
                    {clusterLegend.map((item) => (
                      <button
                        type="button"
                        key={item.cluster}
                        className={`${styles.clusterDropdownItem} ${activeCluster === item.cluster ? styles.activeClusterDropdownItem : ''}`}
                        onClick={() => handleClusterLegendSelect(item.cluster)}
                      >
                        <span className={styles.colorDot} style={{ color: item.color, background: item.color }} />
                        <span>{getClusterDisplayLabel(item.cluster)}</span>
                        <span className={styles.legendCount}>{item.count}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className={styles.searchBlock}>
                <label className={styles.searchLabel}>Search By Title</label>
                <div className={styles.searchContainer}>
                  <input className={styles.searchInput} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search..." />
                  {searchResults.length > 0 && (
                    <div className={styles.searchDropdown}>
                      {searchResults.map(n => <button key={n.id} className={styles.searchItem} onClick={() => focusOnNode(n)}>{n.title}</button>)}
                    </div>
                  )}
                </div>
              </div>

              <div className={styles.dashboardOptionsRow}>
                <button
                  type="button"
                  className={styles.dashboardOptionBtn}
                  onClick={() => setDashboardNowPlayingOpen(true)}
                >
                  Now Playing
                </button>
                <button
                  type="button"
                  className={styles.dashboardOptionBtn}
                  onClick={() => setDashboardWatchPlannerOpen(true)}
                >
                  My Watchlist
                </button>
              </div>
            </section>

            {selectedNode && !decadeExplorerOpen ? (
              <div className={styles.scrollArea}>
                <header className={styles.movieHeader}>
                  {selectedNode.poster_path && <img src={`https://image.tmdb.org/t/p/w200${selectedNode.poster_path}`} className={styles.posterSmall} alt="" />}
                  <div className={styles.headerInfo}>
                    <h2 className={styles.panelTitle}>{selectedNode.title}</h2>
                    <div className={styles.clusterPill} style={{ background: getClusterColor(selectedNode.cluster) }}>
                      {clusterProfiles.get(Number(selectedNode.cluster))?.displayName || `Sector ${selectedNode.cluster}`}
                    </div>
                    {watchedMovieIdSet.has(String(selectedNode.id)) ? (
                      <div className={styles.watchedPill}>Watched</div>
                    ) : null}
                  </div>
                </header>
                <p className={styles.overview}>{selectedNode.overview}</p>
                <section className={styles.infoBlock}>
                  <h3 className={styles.infoTitle}>Genres</h3>
                  <div className={styles.genreList}>
                    {parseGenres(selectedNode.genres).length > 0 ? (
                      parseGenres(selectedNode.genres).map((genre) => (
                        <span key={`${selectedNode.id}-${genre}`} className={styles.genreChip}>{genre}</span>
                      ))
                    ) : (
                      <span className={styles.emptyHint}>Genres unavailable.</span>
                    )}
                  </div>
                </section>
                <section className={styles.infoBlock}>
                  <h3 className={styles.infoTitle}>Thematic Neighbors</h3>
                  <div className={styles.neighborList}>
                    {closestMovies.map(m => (
                      <button key={m.node.id} onClick={() => focusOnNode(m.node)} className={styles.neighborButton}>
                        <span>{m.node.title}</span>
                      </button>
                    ))}
                  </div>
                </section>
                <div className={styles.quickActionRow}>
                  <button
                    type="button"
                    className={`${styles.iconActionBtn} ${watchlistIdSet.has(String(selectedNode.id)) ? styles.iconActionBtnActive : ''}`}
                    onClick={() => toggleWatchlistMovie(selectedNode)}
                    aria-label={watchlistIdSet.has(String(selectedNode.id)) ? 'Remove from watchlist' : 'Add to watchlist'}
                    title={watchlistIdSet.has(String(selectedNode.id)) ? 'Remove from watchlist' : 'Add to watchlist'}
                  >
                    <svg viewBox="0 0 24 24" className={styles.iconActionSvg} aria-hidden="true">
                      <path d="M7 4.5A1.5 1.5 0 0 1 8.5 3h7A1.5 1.5 0 0 1 17 4.5V21l-5-3-5 3V4.5z" fill="currentColor" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    className={`${styles.iconActionBtn} ${styles.iconActionBtnWatched}`}
                    onClick={() => openWatchedModal(selectedNode)}
                    aria-label={watchedMovieIdSet.has(String(selectedNode.id)) ? 'Update watched details' : 'Mark as watched'}
                    title={watchedMovieIdSet.has(String(selectedNode.id)) ? 'Update watched details' : 'Mark as watched'}
                  >
                    <svg viewBox="0 0 24 24" className={styles.iconActionSvg} aria-hidden="true">
                      <path d="M9.5 16.2L5.3 12l1.4-1.4 2.8 2.8 7.8-7.8 1.4 1.4-9.2 9.2z" fill="currentColor" />
                    </svg>
                  </button>
                </div>
                {personalListError ? <p className={styles.searchHintError}>{personalListError}</p> : null}
                <button className={styles.closeBtn} onClick={() => setSelectedNode(null)}>Unfocus</button>
              </div>
            ) : (
              <div className={styles.emptyHint}>
                {descriptionResults.length > 0 ? "Select a result to focus the camera." : "Search or select a star to begin."}
              </div>
            )}
          </div>
        </aside>

        <div
          className={styles.graphWrap}
        >
          <ForceGraph3D
            ref={graphRef}
            graphData={graphData}
            warmupTicks={60}
            cooldownTicks={90}
            cooldownTime={5000}
            d3VelocityDecay={0.35}
            d3AlphaMin={0.02}
            nodeResolution={5}
            linkResolution={3}
            showNavInfo={false}
            enableNavigationControls={!isHistoryMode}
            enablePointerInteraction={!isHistoryMode}
            nodeVisibility={(node) => {
              if (watchedModeEnabled) return true
              return activeCluster === null || node.cluster === activeCluster
            }}
            linkVisibility={(link) => {
              if (watchedModeEnabled) return true
              if (activeCluster === null) return true
              const sourceNode = typeof link.source === 'object' ? link.source : nodeById.get(String(link.source))
              const targetNode = typeof link.target === 'object' ? link.target : nodeById.get(String(link.target))
              return sourceNode?.cluster === activeCluster && targetNode?.cluster === activeCluster
            }}
            nodeThreeObject={createNodeObject}
            nodeLabel={(n) => {
              const outlineColor = getClusterColor(n.cluster)
              const poster = n.poster_path
                ? `<img class="scene-tooltip-poster" src="https://image.tmdb.org/t/p/w92${n.poster_path}" alt="" />`
                : '<div class="scene-tooltip-poster scene-tooltip-poster-fallback">No Poster</div>'
              return `<div class="scene-tooltip" style="border-color:${outlineColor}; box-shadow: 0 0 10px ${outlineColor}55;"><div class="scene-tooltip-row">${poster}<div class="scene-tooltip-title">${n.title}</div></div></div>`
            }}
            linkWidth={(l) => {
              if (isHistoryMode && (!isLinkEndpointReleased(l.source) || !isLinkEndpointReleased(l.target))) {
                return 0.0005
              }

              if (watchedModeEnabled) {
                const sourceId = getLinkEndpointId(l.source)
                const targetId = getLinkEndpointId(l.target)
                const watchedLink = watchedMovieIdSet.has(String(sourceId)) && watchedMovieIdSet.has(String(targetId))
                return watchedLink ? 0.08 : 0.0005
              }

              return (selectedNode && (getLinkEndpointId(l.source) === selectedNode.id || getLinkEndpointId(l.target) === selectedNode.id)) ? 0.25 : 0.001
            }}
            linkColor={(l) => {
              if (isHistoryMode && (!isLinkEndpointReleased(l.source) || !isLinkEndpointReleased(l.target))) {
                return 'rgba(130, 150, 190, 0.025)'
              }

              if (watchedModeEnabled) {
                const sourceId = getLinkEndpointId(l.source)
                const targetId = getLinkEndpointId(l.target)
                const watchedLink = watchedMovieIdSet.has(String(sourceId)) && watchedMovieIdSet.has(String(targetId))
                return watchedLink ? 'rgba(52, 211, 153, 0.45)' : 'rgba(80, 80, 100, 0.02)'
              }

              return (selectedNode && (getLinkEndpointId(l.source) === selectedNode.id || getLinkEndpointId(l.target) === selectedNode.id))
                ? getClusterColor(selectedNode.cluster)
                : 'rgba(80, 80, 100, 0.05)'
            }}
            backgroundColor="rgba(0,0,0,0)"
            onNodeClick={isHistoryMode ? undefined : focusOnNode}
            onEngineStop={() => {
              if (hasCompletedInitialRenderRef.current) return
              hasCompletedInitialRenderRef.current = true
              setGraphReady(true)
            }}
          />
        </div>

        <aside className={styles.descriptionPanel}>
          <div className={styles.descriptionPanelHeader}>
            <h3 className={styles.panelRightTitle}>Search By Description</h3>
            {(descriptionResults.length > 0 || descriptionError) && (
              <button
                type="button"
                className={styles.clearResultsBtn}
                onClick={clearDescriptionResults}
              >
                Close Results
              </button>
            )}
          </div>

          <div className={styles.searchInlineRow}>
            <input
              className={styles.searchInput}
              value={descriptionQuery}
              onChange={(e) => setDescriptionQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') runDescriptionSearch()
              }}
              placeholder="e.g. scary space thriller"
            />
            <button
              type="button"
              className={styles.searchSubmitBtn}
              onClick={runDescriptionSearch}
              disabled={descriptionLoading}
            >
              Enter
            </button>
          </div>
          {descriptionLoading && <div className={styles.searchHint}>Scanning...</div>}
          {descriptionError && <div className={styles.searchHintError}>{descriptionError}</div>}
          {descriptionResults.length > 0 && (
            <div className={styles.resultList}>
              {descriptionResults.map((movie) => {
                const genres = parseGenres(movie.genres)
                const release = movie.release_date || 'Unknown date'
                return (
                  <button
                    type="button"
                    key={`d-${movie.id}`}
                    className={styles.resultCard}
                    onClick={() => focusOnNode(movie)}
                  >
                    {movie.poster_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w92${movie.poster_path}`}
                        className={styles.resultPoster}
                        alt=""
                      />
                    ) : (
                      <div className={styles.resultPosterFallback}>No Poster</div>
                    )}
                    <div className={styles.resultMeta}>
                      <div className={styles.resultTitle}>{movie.title}</div>
                      <div className={styles.resultDate}>{release}</div>
                      <div className={styles.resultGenres}>
                        {genres.length > 0 ? genres.join(' / ') : 'Genres unavailable'}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </aside>
      </main>

      {(!isLoaded || !graphReady) && (
        <div className={styles.renderOverlay}>
          <div className={styles.loadingCard}>
            <div className={styles.loadingProgressShell} aria-hidden="true">
              <div className={styles.loadingProgressBar} style={{ width: `${loadingProgress}%` }} />
            </div>
            <p className={styles.loadingTitle}>Movie Galaxy</p>
            <p className={styles.loadingSubtitle}>{loadingDisplayMessage}</p>
            <p className={styles.loadingDetail}>{Math.round(loadingProgress)}% complete</p>
          </div>
        </div>
      )}

      <div className={styles.floatingControls}>
        <button
          type="button"
          className={`${styles.floatingHistoryBtn} ${decadeExplorerOpen ? styles.utilityBtnActive : ''}`}
          onClick={() => {
            if (decadeExplorerOpen) {
              setDecadeExplorerOpen(false)
              return
            }
            openDecadeExplorer()
          }}
          disabled={decadeExplorerLoading}
        >
          {decadeExplorerLoading ? 'Loading...' : decadeExplorerOpen ? 'Close Explorer' : 'Decade Explorer'}
        </button>

        <button
          type="button"
          className={styles.tutorialFab}
          onClick={() => {
            setTutorialStepIndex(0)
            setTutorialOpen(true)
          }}
          aria-label="Open tutorial"
        >
          ?
        </button>
      </div>

      {selectedClusterInsightProfile && (
        <section className={styles.clusterInsightModal} role="dialog" aria-label={`${selectedClusterInsightProfile.displayName} details`}>
          <div className={styles.clusterInsightBody}>
            <div className={styles.clusterInsightHeader}>
              <div>
                <p className={styles.clusterInsightEyebrow}>Cluster Snapshot</p>
                <h4 className={styles.clusterInsightTitle}>
                  {selectedClusterInsightProfile.displayName}
                </h4>
              </div>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => setClusterInsightOpen(false)}
              >
                Close
              </button>
            </div>

            <p className={styles.clusterInsightSummary}>{selectedClusterInsightProfile.summary}</p>

            <p className={styles.clusterInsightCoreGenre}>
              {selectedClusterInsightProfile.coreGenre}
            </p>

            <div className={styles.clusterInsightGenres}>
              {(selectedClusterInsightProfile.topGenres.length > 0 ? selectedClusterInsightProfile.topGenres : ['Mixed Genres']).map((genre) => (
                <span key={`${selectedClusterInsightProfile.cluster}-${genre}`} className={styles.genreChip}>
                  {genre}
                </span>
              ))}
            </div>
          </div>

          <div className={styles.clusterInsightMovieGrid}>
            {selectedClusterInsightMovies.map((movie) => (
              <button
                type="button"
                key={`${selectedClusterInsightProfile.cluster}-${movie.id}`}
                className={styles.clusterInsightMovieCard}
                onClick={() => {
                  const graphNode = nodeById.get(String(movie.id))
                  if (graphNode) focusOnNode(graphNode)
                }}
              >
                {movie.poster_path ? (
                  <img
                    src={`https://image.tmdb.org/t/p/w92${movie.poster_path}`}
                    className={styles.clusterInsightPoster}
                    alt=""
                  />
                ) : (
                  <div className={styles.clusterInsightPosterFallback}>No Poster</div>
                )}
              </button>
            ))}
          </div>
        </section>
      )}

      {dashboardNowPlayingOpen && (
        <div className={styles.dashboardOverlay} onClick={() => setDashboardNowPlayingOpen(false)}>
          <section
            className={styles.dashboardModal}
            role="dialog"
            aria-modal="true"
            aria-label="Now playing dashboard"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.dashboardModalHeader}>
              <h4 className={styles.dashboardModalTitle}>Now Playing</h4>
              <button type="button" className={styles.closeBtn} onClick={() => setDashboardNowPlayingOpen(false)}>Close</button>
            </div>

            {dashboardNowPlaying.length === 0 ? (
              <p className={styles.dashboardEmpty}>No now-playing movies available.</p>
            ) : (
              <div className={styles.dashboardList}>
                {dashboardNowPlaying.map((movie) => (
                  <article key={`np-${movie.id}`} className={styles.dashboardItem}>
                    <button
                      type="button"
                      className={styles.dashboardItemMain}
                      onClick={() => {
                        focusOnNode(movie)
                        setDashboardNowPlayingOpen(false)
                      }}
                    >
                      <div className={styles.dashboardMovieRow}>
                        {movie.poster_path ? (
                          <img
                            src={`https://image.tmdb.org/t/p/w92${movie.poster_path}`}
                            className={styles.dashboardPoster}
                            alt={movie.title || 'Movie poster'}
                          />
                        ) : (
                          <div className={styles.dashboardPosterFallback}>No Poster</div>
                        )}
                        <div className={styles.dashboardMovieMeta}>
                          <p className={styles.dashboardItemTitle}>{movie.title}</p>
                          <p className={styles.dashboardItemMeta}>{movie.release_date || 'Unknown date'}</p>
                        </div>
                      </div>
                      <p className={styles.dashboardItemOverview}>
                        {(movie.overview || 'No overview available.').slice(0, 220)}
                      </p>
                      {(dashboardNowPlayingSimilarById.get(String(movie.id)) || []).length > 0 ? (
                        <div className={styles.dashboardSimilarWrap}>
                          <p className={styles.dashboardSimilarLabel}>Similar Movies</p>
                          <div className={styles.dashboardSimilarList}>
                            {(dashboardNowPlayingSimilarById.get(String(movie.id)) || []).map(({ node: similarMovie }) => (
                              <button
                                key={`np-${movie.id}-sim-${similarMovie.id}`}
                                type="button"
                                className={styles.dashboardSimilarItem}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  focusOnNode(similarMovie)
                                  setDashboardNowPlayingOpen(false)
                                }}
                              >
                                {similarMovie.poster_path ? (
                                  <img
                                    src={`https://image.tmdb.org/t/p/w92${similarMovie.poster_path}`}
                                    className={styles.dashboardSimilarPoster}
                                    alt={similarMovie.title || 'Similar movie poster'}
                                  />
                                ) : (
                                  <div className={styles.dashboardSimilarPosterFallback}>No Poster</div>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </button>
                    <div className={styles.dashboardItemActions}>
                      <button
                        type="button"
                        className={styles.dashboardItemActionBtn}
                        onClick={() => toggleWatchlistMovie(movie)}
                      >
                        {watchlistIdSet.has(String(movie.id)) ? 'Remove Watchlist' : 'Add Watchlist'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {dashboardWatchPlannerOpen && (
        <div className={styles.dashboardOverlay} onClick={() => setDashboardWatchPlannerOpen(false)}>
          <section
            className={styles.dashboardModal}
            role="dialog"
            aria-modal="true"
            aria-label="Watch planner dashboard"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.dashboardModalHeader}>
              <h4 className={styles.dashboardModalTitle}>My Watch Planner</h4>
              <button type="button" className={styles.closeBtn} onClick={() => setDashboardWatchPlannerOpen(false)}>Close</button>
            </div>

            <section className={styles.dashboardSection}>
              <div className={styles.dashboardSectionHeader}>
                <p className={styles.dashboardSectionTitle}>Watchlist</p>
                <span className={styles.dashboardSectionCount}>{dashboardWatchlistMovies.length}</span>
              </div>
              {dashboardWatchlistMovies.length === 0 ? (
                <p className={styles.dashboardEmpty}>No movies in your watchlist yet.</p>
              ) : (
                <div className={styles.dashboardList}>
                  {dashboardWatchlistMovies.map((movie) => (
                    <article key={`wl-${movie.id}`} className={styles.dashboardItem}>
                      <button
                        type="button"
                        className={styles.dashboardItemMain}
                        onClick={() => {
                          focusOnNode(movie)
                          setDashboardWatchPlannerOpen(false)
                        }}
                      >
                        <div className={styles.dashboardMovieRow}>
                          {movie.poster_path ? (
                            <img
                              src={`https://image.tmdb.org/t/p/w92${movie.poster_path}`}
                              className={styles.dashboardPoster}
                              alt={movie.title || 'Movie poster'}
                            />
                          ) : (
                            <div className={styles.dashboardPosterFallback}>No Poster</div>
                          )}
                          <div className={styles.dashboardMovieMeta}>
                            <p className={styles.dashboardItemTitle}>{movie.title}</p>
                            <p className={styles.dashboardItemMeta}>{movie.release_date || 'Unknown date'}</p>
                          </div>
                        </div>
                      </button>
                      <div className={styles.dashboardItemActions}>
                        <button
                          type="button"
                          className={styles.dashboardItemActionBtn}
                          onClick={() => toggleWatchlistMovie(movie)}
                        >
                          Remove
                        </button>
                        <button
                          type="button"
                          className={styles.dashboardItemActionBtn}
                          onClick={() => openWatchedModal(movie)}
                        >
                          Mark Watched
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className={styles.dashboardSection}>
              <div className={styles.dashboardSectionHeader}>
                <p className={styles.dashboardSectionTitle}>Watched</p>
                <span className={styles.dashboardSectionCount}>{dashboardWatchedMovies.length}</span>
              </div>
              {dashboardWatchedMovies.length === 0 ? (
                <p className={styles.dashboardEmpty}>No watched movies yet.</p>
              ) : (
                <div className={styles.dashboardList}>
                  {dashboardWatchedMovies.map((entry) => (
                    <article key={`wh-${entry.movie_id}`} className={styles.dashboardItem}>
                      <button
                        type="button"
                        className={styles.dashboardItemMain}
                        onClick={() => {
                          focusOnNode(entry.movie)
                          setDashboardWatchPlannerOpen(false)
                        }}
                      >
                        <div className={styles.dashboardMovieRow}>
                          {entry.movie.poster_path ? (
                            <img
                              src={`https://image.tmdb.org/t/p/w92${entry.movie.poster_path}`}
                              className={styles.dashboardPoster}
                              alt={entry.movie.title || 'Movie poster'}
                            />
                          ) : (
                            <div className={styles.dashboardPosterFallback}>No Poster</div>
                          )}
                          <div className={styles.dashboardMovieMeta}>
                            <p className={styles.dashboardItemTitle}>{entry.movie.title}</p>
                            <p className={styles.dashboardItemMeta}>
                              {`Watched ${formatWatchedDateLabel(entry.watched_at)}${entry.rating ? ` · ${entry.rating}/5` : ''}`}
                            </p>
                          </div>
                        </div>
                        {entry.review ? <p className={styles.dashboardItemReview}>{entry.review}</p> : null}
                      </button>
                      <div className={styles.dashboardItemActions}>
                        <button
                          type="button"
                          className={styles.dashboardItemActionBtn}
                          onClick={() => openWatchedModal(entry.movie)}
                        >
                          Edit
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </section>
        </div>
      )}

      {watchedModalOpen && selectedNode && (
        <div className={styles.watchedModalOverlay} onClick={closeWatchedModal}>
          <section
            className={styles.watchedModal}
            role="dialog"
            aria-modal="true"
            aria-label="Mark movie as watched"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.watchedModalHeader}>
              <h4 className={styles.watchedModalTitle}>Mark As Watched</h4>
              <button type="button" className={styles.closeBtn} onClick={closeWatchedModal}>Close</button>
            </div>

            <p className={styles.watchedModalMovie}>{selectedNode.title || 'Untitled'}</p>

            <label className={styles.watchedModalLabel} htmlFor="watched-rating">Rating</label>
            <select
              id="watched-rating"
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

            <label className={styles.watchedModalLabel} htmlFor="watched-date">Watch Date</label>
            <input
              id="watched-date"
              type="date"
              className={styles.watchedModalInput}
              value={watchedFormDate}
              onChange={(event) => setWatchedFormDate(event.target.value)}
            />

            <label className={styles.watchedModalLabel} htmlFor="watched-review">Review</label>
            <textarea
              id="watched-review"
              className={styles.watchedModalTextarea}
              value={watchedFormReview}
              onChange={(event) => setWatchedFormReview(event.target.value)}
              placeholder="Write your thoughts..."
              rows={4}
            />

            <div className={styles.watchedModalActions}>
              <button type="button" className={styles.utilityBtn} onClick={closeWatchedModal}>Cancel</button>
              <button
                type="button"
                className={`${styles.utilityBtn} ${styles.utilityBtnActive}`}
                onClick={submitWatchedModal}
                disabled={watchedFormSaving}
              >
                {watchedFormSaving ? 'Saving...' : 'Save Watched'}
              </button>
            </div>
          </section>
        </div>
      )}

      {decadeExplorerOpen && (
        <div className={styles.decadeExplorerOverlay} onClick={() => setDecadeExplorerOpen(false)}>
          <section
            className={styles.decadeExplorerModal}
            role="dialog"
            aria-modal="true"
            aria-label="Decade Explorer"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.decadeExplorerModalHeader}>
              <p className={styles.decadeExplorerTitle}>Decade Explorer</p>
              <button type="button" className={styles.closeBtn} onClick={() => setDecadeExplorerOpen(false)}>
                Close
              </button>
            </div>

            {decadeExplorerLoading ? (
              <p className={styles.decadeExplorerEmpty}>Loading decade highlights...</p>
            ) : decadeExplorerCard ? (
              decadeExplorerSlideIndex === 0 ? (
                <>
                  <p className={styles.decadeExplorerSubtitle}>
                    {decadeExplorerCard.decade}s · {explorerDisplayIndex}/{explorerTotal}
                  </p>
                  <h4 className={styles.decadeExplorerModalTitle}>{decadeExplorerCard.decade}s in Movies</h4>
                  <p className={styles.decadeExplorerModalOverview}>{currentDecadeExplorerSummary}</p>
                  <div className={styles.decadeExplorerActions}>
                    <button
                      type="button"
                      className={styles.utilityBtn}
                      onClick={() => shiftDecadeExplorer(-1)}
                      disabled={decadeExplorerIndex === 0 || decadeExplorerLoading}
                    >
                      Prev Decade
                    </button>
                    <button
                      type="button"
                      className={`${styles.utilityBtn} ${styles.utilityBtnActive}`}
                      onClick={() => setDecadeExplorerSlideIndex(1)}
                    >
                      Next: Featured Movie
                    </button>
                    <button
                      type="button"
                      className={styles.utilityBtn}
                      onClick={() => setDecadeExplorerOpen(false)}
                    >
                      Close
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className={styles.decadeExplorerSubtitle}>
                    {decadeExplorerCard.decade}s · {explorerDisplayIndex}/{explorerTotal}
                  </p>
                  <p className={styles.decadeExplorerMovie}>{decadeExplorerCard.movie.title || 'Untitled'}</p>
                  <p className={styles.decadeExplorerOverview}>
                    {(decadeExplorerCard.movie.overview || 'No description available.').slice(0, 180)}
                  </p>
                  <p className={styles.decadeExplorerMeta}>
                    {getReleaseYear(decadeExplorerCard.movie.release_date) || 'Unknown year'}
                  </p>
                  <div className={styles.decadeExplorerActions}>
                    <button
                      type="button"
                      className={styles.utilityBtn}
                      onClick={() => setDecadeExplorerSlideIndex(0)}
                    >
                      Back to Decade
                    </button>
                    <button
                      type="button"
                      className={`${styles.utilityBtn} ${styles.utilityBtnActive}`}
                      onClick={() => {
                        const graphNode = nodeById.get(String(decadeExplorerCard.movieId))
                        if (graphNode) focusOnNode(graphNode)
                      }}
                    >
                      Focus Node
                    </button>
                    <button
                      type="button"
                      className={styles.utilityBtn}
                      onClick={() => shiftDecadeExplorer(1)}
                      disabled={decadeExplorerIndex >= explorerTotal - 1 || decadeExplorerLoading}
                    >
                      Next Decade
                    </button>
                  </div>
                </>
              )
            ) : (
              <p className={styles.decadeExplorerEmpty}>No decade highlights available.</p>
            )}
          </section>
        </div>
      )}

      {tutorialOpen && (
        <div className={styles.tutorialOverlay}>
          <div className={styles.tutorialModal}>
            <p className={styles.tutorialStepCounter}>
              Step {tutorialStepIndex + 1} of {tutorialSteps.length}
            </p>
            <h3 className={styles.tutorialTitle}>{currentTutorialStep.title}</h3>
            <p className={styles.tutorialBody}>{currentTutorialStep.body}</p>
            <div className={styles.tutorialActions}>
              <button
                type="button"
                className={styles.utilityBtn}
                onClick={() => setTutorialOpen(false)}
              >
                Close
              </button>
              <button
                type="button"
                className={styles.utilityBtn}
                disabled={tutorialStepIndex === 0}
                onClick={() => setTutorialStepIndex((step) => Math.max(0, step - 1))}
              >
                Back
              </button>
              <button
                type="button"
                className={`${styles.utilityBtn} ${styles.utilityBtnActive}`}
                onClick={() => {
                  if (tutorialStepIndex === tutorialSteps.length - 1) {
                    setTutorialOpen(false)
                    return
                  }
                  setTutorialStepIndex((step) => Math.min(tutorialSteps.length - 1, step + 1))
                }}
              >
                {tutorialStepIndex === tutorialSteps.length - 1 ? 'Finish' : 'Next'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}