const MOVIES = [
  {
    id: 'interstellar',
    title: 'Interstellar',
    year: 2014,
    genre: 'Sci-Fi, Drama',
    director: 'Christopher Nolan',
    rating: 8.7,
    runtime: '169 min',
    poster: 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&w=900&q=80',
    blurb: 'A crew travels through a wormhole in search of humanity\'s next home.',
  },
  {
    id: 'arrival',
    title: 'Arrival',
    year: 2016,
    genre: 'Sci-Fi, Mystery',
    director: 'Denis Villeneuve',
    rating: 7.9,
    runtime: '116 min',
    poster: 'https://images.unsplash.com/photo-1502134249126-9f3755a50d78?auto=format&fit=crop&w=900&q=80',
    blurb: 'A linguist races to decode alien language before global conflict erupts.',
  },
  {
    id: 'gravity',
    title: 'Gravity',
    year: 2013,
    genre: 'Sci-Fi, Thriller',
    director: 'Alfonso Cuaron',
    rating: 7.7,
    runtime: '91 min',
    poster: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=900&q=80',
    blurb: 'Two astronauts struggle to survive after catastrophe leaves them adrift in orbit.',
  },
  {
    id: 'blade-runner-2049',
    title: 'Blade Runner 2049',
    year: 2017,
    genre: 'Sci-Fi, Neo-noir',
    director: 'Denis Villeneuve',
    rating: 8.0,
    runtime: '164 min',
    poster: 'https://images.unsplash.com/photo-1495567720989-cebdbdd97913?auto=format&fit=crop&w=900&q=80',
    blurb: 'A young blade runner uncovers a secret that could upend what remains of society.',
  },
  {
    id: 'moon',
    title: 'Moon',
    year: 2009,
    genre: 'Sci-Fi, Psychological',
    director: 'Duncan Jones',
    rating: 7.8,
    runtime: '97 min',
    poster: 'https://images.unsplash.com/photo-1517976487492-5750f3195933?auto=format&fit=crop&w=900&q=80',
    blurb: 'A lunar worker nearing the end of his contract makes a disturbing discovery.',
  },
  {
    id: 'the-martian',
    title: 'The Martian',
    year: 2015,
    genre: 'Sci-Fi, Adventure',
    director: 'Ridley Scott',
    rating: 8.0,
    runtime: '144 min',
    poster: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=900&q=80',
    blurb: 'An astronaut stranded on Mars engineers his own survival while Earth mounts a rescue.',
  },
]

export function searchMovies(query, limit = 12) {
  if (!query?.trim()) return []

  const q = query.trim().toLowerCase()
  return MOVIES.filter((movie) => {
    return (
      movie.title.toLowerCase().includes(q) ||
      movie.director.toLowerCase().includes(q) ||
      movie.genre.toLowerCase().includes(q) ||
      String(movie.year).includes(q)
    )
  }).slice(0, Math.max(1, limit))
}

export function getFeaturedMovies(limit = 4) {
  return MOVIES.slice(0, Math.max(1, limit))
}
