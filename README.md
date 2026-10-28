# Ghostlight

**A small home for the notes you almost forgot.** Ghostlight searches short personal fragments by meaning, using an open-weight sentence embedding model that runs in the browser. It was started on October 28, 2026 for the Hacktoberfest Open-Source AI Challenge, Week 4: Ghost in the Machine.

## Try it

The app contains six explicitly fictional sample notes. Add a fragment, then describe a detail in the search box. The model ranks the best passage from each note and shows the top three. The similarity value is not a probability, and the model can get things wrong. English works best.

To run the source locally, serve this directory over HTTP or HTTPS with any static server; modern browsers restrict JavaScript modules and workers on `file://`. The first search downloads a quantized model of approximately 23 MB plus the library, tokenizer, and runtime. No API key or model account is needed. The initial download can take time and requires an internet connection.

## How it works

1. Split each note into overlapping passages of at most 120 words, stepping by 90 words.
2. In a browser Web Worker, use [Transformers.js](https://huggingface.co/docs/transformers.js) and the Apache-2.0-licensed [Xenova/all-MiniLM-L6-v2](https://huggingface.co/Xenova/all-MiniLM-L6-v2) model to produce normalized sentence embeddings.
3. Embed the query with the same model. A dot product ranks passages by cosine similarity; only the best passage per note appears in the results. Embeddings remain in memory and are rebuilt if the archive changes.
4. Store notes in this browser's local storage, with manual JSON export and import for backups. Clearing site data removes stored notes. No synchronization is provided.

## Privacy and limitations

The app does not send note or query text to a model-inference server. It does download site assets, fonts, the library, and model files from hosting and third-party providers, which can observe normal network information such as IP addresses. CDN code and model assets are third-party dependencies. The browser and device are part of the trust boundary; don't enter sensitive information on a shared device. Availability, browser cache, and storage vary. This demo is not an encrypted vault, and it has not been verified to work completely offline. Model similarity can miss relevant passages or surface irrelevant ones.

## Development and credit

The project was built during the challenge window. OpenAI Codex designed and implemented the app and tested local browser searches and storage. GitHub Copilot Student reviewed the search worker; its suggestions informed request-local vector snapshots, input checks, and cache reset on failure. The sample fragments are fictional. No user archives were sent to Copilot.

Original application code is MIT-licensed; third-party models, libraries, and fonts retain their own licenses.
