import os
import numpy as np
import joblib
import json  # Added this
from supabase import create_client
from sklearn.cluster import KMeans
from dotenv import load_dotenv

load_dotenv(dotenv_path=".env.local")

def recreate_kmeans():
    # 1. Connect to Supabase
    supabase = create_client(
        os.getenv("VITE_SUPABASE_URL"),
        os.getenv("SUPABASE_SECRET_KEY")
    )

    print("📡 Fetching embeddings from Supabase to reconstruct sectors...")
    res = supabase.table("movie_galaxy").select("embedding, cluster").execute()
    data = res.data

    if not data:
        print("❌ No data found in Supabase.")
        return

    # 2. Prepare data for Training
    processed_embeddings = []
    for d in data:
        emb = d['embedding']
        # If Supabase sends a string, convert it to a list
        if isinstance(emb, str):
            emb = json.loads(emb)
        processed_embeddings.append(emb)

    embeddings = np.array(processed_embeddings)

    print(f"🧠 Training KMeans on {len(embeddings)} vectors...")
    # Using 12 clusters to match your original sector count
    kmeans = KMeans(n_init=10, n_clusters=12, random_state=42)
    kmeans.fit(embeddings)

    # 3. Save the model
    joblib.dump(kmeans, "kmeans_model.joblib")
    print("✅ Success! kmeans_model.joblib has been created.")

if __name__ == "__main__":
    recreate_kmeans()