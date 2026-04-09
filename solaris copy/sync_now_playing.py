import os
import json
import time
import requests
import numpy as np
import joblib
import httpx
from sentence_transformers import SentenceTransformer
from supabase import create_client, ClientOptions
from dotenv import load_dotenv

# Load environment variables from .env.local
load_dotenv(dotenv_path=".env.local")

class GalaxySyncer:
    def __init__(self):
        print("🌌 Initializing Cineverse Galaxy Syncer...")
        
        # 1. Setup Stable Supabase Client (HTTP/1.1 for network stability)
        custom_client = httpx.Client(
            http1=True,
            http2=False,
            timeout=httpx.Timeout(60.0, read=None)
        )
        opts = ClientOptions(
            postgrest_client_timeout=60,
            httpx_client=custom_client
        )
        self.supabase = create_client(
            os.getenv("VITE_SUPABASE_URL"),
            os.getenv("SUPABASE_SECRET_KEY"),
            options=opts
        )

        # 2. Setup TMDB Headers (Using Bearer Token for security)
        self.tmdb_headers = {
            "accept": "application/json",
            "Authorization": f"Bearer {os.getenv('MOVIE_API_KEY')}" 
        }

        # 3. Load ML Models (Ensure these .joblib files are in the script directory)
        print("🤖 Loading Embedding and Projection models...")
        self.model = SentenceTransformer('all-MiniLM-L6-v2')
        self.reducer = joblib.load("reducer_model.joblib") 
        self.scaler = joblib.load("scaler_model.joblib")   
        self.kmeans = joblib.load("kmeans_model.joblib")
        
        # 4. Fetch Master Genre Map for ID-to-Name resolution
        self.genre_map = self.fetch_genre_map()

    def fetch_genre_map(self):
        url = "https://api.themoviedb.org/3/genre/movie/list?language=en-US"
        try:
            r = requests.get(url, headers=self.tmdb_headers).json()
            return {g['id']: g['name'] for g in r.get('genres', [])}
        except Exception as e:
            print(f"⚠️ Could not fetch genre map: {e}")
            return {}

    def reset_now_playing_flags(self):
        """Resets all is_now_playing flags to False before the new sync."""
        print("🧹 Cleaning old Now Playing flags...")
        try:
            # Matches all rows where ID is not empty
            self.supabase.table("movie_galaxy").update({"is_now_playing": False}).neq("id", "0").execute()
            print("✅ Database reset successful.")
        except Exception as e:
            print(f"❌ Failed to reset flags: {e}")

    def get_top_now_playing(self):
        print("🎬 Fetching 5 pages of current movies from TMDB...")
        all_candidates = []
        for page in range(1, 6):
            url = f"https://api.themoviedb.org/3/movie/now_playing?language=en-US&page={page}"
            try:
                r = requests.get(url, headers=self.tmdb_headers)
                if r.status_code == 200:
                    all_candidates.extend(r.json().get('results', []))
                time.sleep(0.2)
            except Exception as e:
                print(f"⚠️ Error on TMDB page {page}: {e}")
        
        # Sort by popularity score and take the top 50
        top_50 = sorted(all_candidates, key=lambda x: x.get('popularity', 0), reverse=True)[:50]
        return top_50

    def get_movie_keywords(self, movie_id):
        url = f"https://api.themoviedb.org/3/movie/{movie_id}/keywords"
        try:
            r = requests.get(url, headers=self.tmdb_headers).json()
            return [k['name'] for k in r.get('keywords', [])]
        except:
            return []

    def sync_links(self, movie_id, embedding):
        """Calls SQL function to find top 5 nearest neighbors and creates links."""
        try:
            rpc_res = self.supabase.rpc("match_movies", {
                "query_embedding": embedding,
                "match_threshold": 0.4, # Adjust based on how 'loose' you want connections
                "match_count": 6        # Returns 6 because 1 is usually the movie itself
            }).execute()
            
            links = []
            for neighbor in rpc_res.data:
                if str(neighbor['id']) != str(movie_id):
                    links.append({
                        "source_id": str(movie_id),
                        "target_id": str(neighbor['id']),
                        "value": float(neighbor['similarity'])
                    })
            
            if links:
                self.supabase.table("movie_links").upsert(links).execute()
                print(f"🔗 Created {len(links)} connections for {movie_id}")
        except Exception as e:
            print(f"⚠️ Link sync error: {e}")

    def process_and_upload(self, movies):
        print(f"🚀 Processing and Upserting {len(movies)} stars...")
        
        for movie in movies:
            m_id = str(movie['id'])
            print(f"✨ Syncing: {movie['title']}")
            
            # Resolve Genre names and Keywords
            genre_names = [self.genre_map.get(gid) for gid in movie.get('genre_ids', []) if gid in self.genre_map]
            keywords = self.get_movie_keywords(m_id)
            
            # Build Semantic Text for Vector Embedding
            combined_text = f"{movie['title']} {movie['overview']} {' '.join(keywords)} {' '.join(genre_names)}"
            
            # Generate Embedding & 3D Coordinates
            embedding = self.model.encode(combined_text).tolist()
            reduced = self.reducer.transform([embedding])
            coords = self.scaler.transform(reduced)[0]
            
            # Determine Sector
            cluster_id = int(self.kmeans.predict([embedding])[0])

            payload = {
                "id": m_id,
                "title": movie['title'],
                "overview": movie['overview'],
                "release_date": movie.get('release_date'),
                "poster_path": movie.get('poster_path'),
                "genres": genre_names,
                "keywords": keywords,
                "x": float(coords[0]),
                "y": float(coords[1]),
                "z": float(coords[2]),
                "embedding": embedding,
                "cluster": cluster_id,
                "is_now_playing": True,
                "popularity": float(movie.get('popularity', 0))
            }

            try:
                # 1. Upsert Node
                self.supabase.table("movie_galaxy").upsert(payload).execute()
                # 2. Sync Similarity Links
                self.sync_links(m_id, embedding)
                print(f"✅ {movie['title']} is now live in Sector {cluster_id}.")
            except Exception as e:
                print(f"❌ Failed to process {movie['title']}: {e}")

    def run(self):
        # Full sync cycle
        self.reset_now_playing_flags()
        top_movies = self.get_top_now_playing()
        self.process_and_upload(top_movies)
        print("🌌 All systems go. Galaxy update complete.")

if __name__ == "__main__":
    syncer = GalaxySyncer()
    syncer.run()