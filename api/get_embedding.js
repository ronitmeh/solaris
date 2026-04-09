import { pipeline, env } from '@xenova/transformers';

// 1. Tell Transformers.js where to find the model weights (Hugging Face CDN)
env.allowLocalModels = false;

// 2. Singleton pattern to prevent re-loading the model on every request
let extractor = null;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { text } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!text) return res.status(400).json({ error: 'No text provided' });

    // 3. Initialize the model if it hasn't been loaded yet
    if (!extractor) {
      extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }

    // 4. Compute the embedding (this happens on Vercel's server)
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    const vector = Array.from(output.data);

    return res.status(200).json(vector);

  } catch (err) {
    console.error("Vercel AI Error:", err);
    return res.status(500).json({ error: "Compute failed", details: err.message });
  }
}