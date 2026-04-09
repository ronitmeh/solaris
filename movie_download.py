import requests
import json
import umap
from tqdm import tqdm
from sentence_transformers import SentenceTransformer
import time
import os
from dotenv import load_dotenv
from sklearn.preprocessing import MinMaxScaler
from sklearn.cluster import KMeans
from sklearn.neighbors import NearestNeighbors
from supabase import create_client, ClientOptions
import joblib
import numpy as np
import httpx

load_dotenv(dotenv_path=".env.local")
MOVIE_API_KEY = os.getenv("MOVIE_API_KEY").strip()
if not MOVIE_API_KEY:
    raise ValueError("MOVIE_API_KEY not found in environment variables.")


custom_client = httpx.Client(
    http1=True,
    http2=False,
    timeout=httpx.Timeout(120.0, read=None)
)

# 2. Use ClientOptions to pass the custom client
opts = ClientOptions(
    postgrest_client_timeout=120,
    storage_client_timeout=120,
    httpx_client=custom_client  # This is where the magic happens
)

# 3. Initialize Supabase with the options object
supabase = create_client(
    os.getenv("VITE_SUPABASE_URL"),
    os.getenv("SUPABASE_SECRET_KEY"),
    options=opts
)

class MovieNet:
    def __init__(self):
        self.api_key = MOVIE_API_KEY
        self.movies = []
        self.headers = {"accept": "application/json", "Authorization": f"Bearer {self.api_key}"}
        self.genres = {}
        self.final_data = {"nodes": [], "links": []}
        self.multi_dim_embeddings = None
        self.clusters = None

    def get_genres(self):
        with tqdm(total=1, desc="Fetching genres") as pbar:
            url = "https://api.themoviedb.org/3/genre/movie/list"
            response = requests.get(url, headers=self.headers).json()
            print(response)
            self.genres = {item['id']: item['name'] for item in response['genres']}
            pbar.update(1)

    def download_movies(self):
        page = 1
        target_count = 5000
        with tqdm(total=target_count, desc="Downloading movies") as pbar:
            while len(self.movies) < target_count:
                url = f"https://api.themoviedb.org/3/discover/movie?include_adult=false&include_video=false&language=en-US&page={page}&sort_by=revenue.desc&with_original_language=en"
                response = requests.get(url, headers=self.headers).json()
                if not response.get("results"):
                    break
                
                for movie in response["results"]:
                    if len(self.movies) >= target_count: break
                    
                    kw_url = f"https://api.themoviedb.org/3/movie/{movie['id']}/keywords"
                    kw_res = requests.get(kw_url, headers=self.headers).json()
                    keywords = [word["name"] for word in kw_res.get("keywords", [])]
                    
                    self.movies.append({
                        "id": movie["id"],
                        "title": movie["title"],
                        "release_date": movie.get("release_date", ""),
                        "overview": movie.get("overview", ""),
                        "poster_path": movie.get("poster_path", ""),
                        "genres": [self.genres.get(gid, "Unknown") for gid in movie.get("genre_ids", [])],
                        "keywords": keywords
                    })
                    pbar.update(1)
                    time.sleep(0.02) # Adjusted for slightly faster fetching
                page += 1
                time.sleep(0.05)

    def create_embedding_text(self, movie):
        g = ' '.join(movie['genres'])
        k = ' '.join(movie['keywords'])
        return f"{movie['title']} {g} {g} {k} {k} {k} {movie['overview']}"

    def create_embeddings(self, model_name="all-MiniLM-L6-v2"):
        model = SentenceTransformer(model_name)
        text_inputs = [self.create_embedding_text(m) for m in self.movies]
        
        # 1. High-dim Embeddings
        multi_dim = model.encode(text_inputs, show_progress_bar=True)
        self.multi_dim_embeddings = multi_dim
        
        # 2. UMAP Projection
        reducer = umap.UMAP(n_components=3, metric='cosine', n_neighbors=15, min_dist=0.05, random_state=42)
        reduced = reducer.fit_transform(multi_dim)
        
        # 3. Scaling
        scaler = MinMaxScaler(feature_range=(-1, 1))
        scaled = scaler.fit_transform(reduced)
        
        # 4. Clustering
        kmeans = KMeans(n_clusters=12, random_state=42, n_init=10)
        self.clusters = kmeans.fit_predict(scaled)
        
        # 5. Graph Links (Nearest Neighbors)
        nn = NearestNeighbors(n_neighbors=4, metric='cosine')
        nn.fit(scaled)
        _, nn_indices = nn.kneighbors(scaled)
        
        links = []
        for i, neighbors in enumerate(nn_indices):
            for neighbor in neighbors[1:]:
                links.append({
                    "source": str(self.movies[i]['id']),
                    "target": str(self.movies[neighbor]['id']),
                    "value": 1
                })

        # 6. Update Movie Objects
        for i, movie in enumerate(self.movies):
            movie['x'] = float(scaled[i, 0])
            movie['y'] = float(scaled[i, 1])
            movie['z'] = float(scaled[i, 2])
            movie['embedding'] = multi_dim[i].tolist()
            movie['cluster'] = int(self.clusters[i])
        
        self.final_data = {"nodes": self.movies, "links": links}
        
        joblib.dump(reducer, 'reducer_model.joblib')
        joblib.dump(scaler, 'scaler_model.joblib')

    def upload_to_supabase(self):
        nodes = self.final_data['nodes']
        
        # Move the check inside the loop logic
        batch_size = 25 
        
        # Total range of your 5000 movies
        for i in range(0, len(nodes), batch_size):
            batch = nodes[i:i+batch_size]
            
            # 1. Filter the batch locally first
            # We check WHICH movies in this specific batch are already there
            # This prevents the "Duplicate Key" error
            payload = []
            for node in batch:
                node_id = str(node['id'])
                # Quick check against Supabase for this specific ID
                # (Alternatively, refresh existing_ids here)
                payload.append({
                    "id": node_id,
                    "title": node['title'],
                    "overview": node['overview'],
                    "genres": node.get('genres', []),
                    "keywords": node.get('keywords', []),
                    "poster_path": node.get('poster_path'),
                    "release_date": node.get('release_date'),
                    "cluster": node.get('cluster'),
                    "x": node['x'], "y": node['y'], "z": node['z'],
                    "embedding": node['embedding']
                })

            # 2. Use 'upsert' instead of 'insert'
            # UPSERT means "Update if exists, Insert if new"
            # This is the industry standard for resuming broken uploads
            try:
                if payload:
                    # Switching to .upsert() solves the duplicate key problem forever
                    supabase.table("movie_galaxy").upsert(payload).execute()
                    print(f"✅ Batch {i//batch_size + 1} synced | Index: {i}")
                    time.sleep(1) # Small delay to be gentle on the server
            except Exception as e:
                print(f"❌ Batch failed: {e}")
                return # Stop and let you restart

    def upload_centroids(self):
        print("Calculating cluster centroids...")
        centroids_data = []
        for cluster_id in range(12):
            indices = [i for i, c in enumerate(self.clusters) if c == cluster_id]
            if indices:
                cluster_embeddings = self.multi_dim_embeddings[indices]
                centroid_vector = np.mean(cluster_embeddings, axis=0).tolist()
                centroids_data.append({
                    "cluster": cluster_id,
                    "centroid_vector": centroid_vector
                })
        
        try:
            supabase.table("cluster_centroids").insert(centroids_data).execute()
            print("Successfully uploaded cluster centroids.")
        except Exception as e:
            print(f"Error uploading centroids: {e}")

    def save_movies(self):
        with open("movies.json", "w", encoding="utf-8") as f:
            json.dump(self.movies, f, ensure_ascii=False, indent=4)
        with open("galaxy_data.json", "w", encoding="utf-8") as f:
            json.dump(self.final_data, f, ensure_ascii=False, indent=4)

    def run(self):
        self.get_genres()
        self.download_movies()
        self.create_embeddings()
        self.save_movies()
        self.upload_to_supabase()
        self.upload_centroids()
        
    def run_upload_only(self):
        print("🚀 Starting upload-only mode...")
        
        # 1. Load the data you already spent time downloading/embedding
        try:
            with open("galaxy_data.json", "r") as f:
                self.final_data = json.load(f)
                self.movies = self.final_data['nodes'] # Fill this for centroid calculation
                self.clusters = [m['cluster'] for m in self.movies]
                
                # Convert embeddings back to a numpy array for centroid calculation
                self.multi_dim_embeddings = np.array([m['embedding'] for m in self.movies])
                
            print(f"✅ Loaded {len(self.movies)} nodes from galaxy_data.json")
        except FileNotFoundError:
            print("❌ Error: galaxy_data.json not found. You need to run the full script once.")
            return

        # 2. Proceed with the database uploads
        # This uses the batching and retry logic we discussed
        self.upload_to_supabase()
        #self.upload_centroids()

if __name__ == "__main__":
    movie_net = MovieNet()
    movie_net.run_upload_only()