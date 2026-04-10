# Solaris - Movie Galaxy Dashboard

Solaris is a React + Vite movie discovery app with a 3D movie graph, semantic search, Supabase-backed personal tracking, and dashboard overlays for Now Playing and watch planning.

## What It Does

- Visualizes movies as an interactive 3D galaxy with cluster exploration
- Supports title search and description-based semantic search
- Includes authenticated personal movie tracking (watchlist and watched history)
- Renders watched movies differently in the graph (distinct color + cube nodes)
- Provides a watched-only filter mode in the cluster selector
- Exposes in-dashboard overlays for:
  - `Now Playing`: poster cards, overview text, and similar movie poster strip
  - `My Watch Planner`: watchlist and watched sections with posters and actions

## Dashboard Interaction Notes

- Left movie detail panel actions are icon-based and side-by-side:
  - Bookmark icon: add/remove watchlist
  - Check icon: mark watched / update watched details
- Similar movies in Now Playing are displayed as poster-only chips in a horizontal row.
- Dashboard and watched-detail modals are intentionally larger to use more of the viewport.

## Run

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Project Structure

```text
src/
  App.jsx
  main.jsx
  lib/
    supabase.js
    dataPrefetch.js
  pages/
    HomePage.jsx
    HomePage.module.css
    LandingPage.jsx
    LandingPage.module.css
    NowPlayingPage.jsx
    NowPlayingPage.module.css
    WatchlistPage.jsx
    WatchlistPage.module.css
  styles/
    global.css

api/
  get_embedding.js
  semantic_search.js
```
