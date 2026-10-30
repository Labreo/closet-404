# Closet 404

A 3D digital mausoleum and archival experience for dead websites—memorializing dot-com crash casualties, GeoCities neighborhoods, and early web experiments as tactile physical media boxes on archival shelves.

Built with **Next.js App Router**, **TypeScript strict**, **React Three Fiber (R3F)**, **Three.js**, and **Tailwind CSS**.

---

## What It Is

When websites die, their servers go dark, domains get squatted, and their cultural memory dissolves. *Closet 404* transforms digital archaeology into a physical, interactive space:

- **3D Archival Closet (`/closet`)**: Tight U-shaped room with dark walnut shelves, warm strip lighting, procedural canvas spine textures with authentic typography, and atmospheric postprocessing (Bloom, Vignette, Noise).
- **Physical Interaction**: Case meshes slide out smoothly on hover (`maath/easing damp3`), fly to camera on click, spin 360° on pointer drag, and return on `Esc` or click-away.
- **Séance Terminal**: Each site features an interactive terminal drawer where users can commune with the site's ghost. The ghost's responses are constrained strictly to verbatim forensics extracted from real historical HTML (HTML comments, image filenames, ALT tags, meta generator, and body text).
- **Live "Resurrect a URL" (`/api/resurrect`)**: A live archaeology pipeline querying the Wayback Machine CDX API with a 12-second total timeout, server-wide concurrency lock, in-memory ephemeral caching, and honest telemetry.
- **BM25 Search (`/api/search`)**: Zero-dependency deterministic keyword search across titles, eulogies, vibe tags, and body text.

---

## Why Open Weights Matter Here

A digital archive cannot depend on proprietary cloud APIs that may themselves become 404 dead services tomorrow.

1. **Perpetual Preservation**: Closed-source commercial AI APIs routinely deprecate model endpoints, alter system prompt behaviors, or shut down entirely. Open-weight models (such as Google Gemma) ensure this software can run offline and remain reproducible 20 years from now.
2. **Sovereignty & Offline Operation**: Running open weights locally guarantees zero telemetry, zero ongoing API subscription costs, zero third-party content filtering of historical web artifacts, and zero network dependencies.
3. **Faithfulness**: When resurrecting deceased sites, open-weight models running local deterministic inference provide verifiable, reproducible outputs without opaque server-side alterations.

---

## Running Fully Local with Ollama (Zero API Keys)

Closet 404 can run 100% locally on your machine with zero external network requests and zero API keys.

### 1. Install & Run Ollama
Download and start [Ollama](https://ollama.ai/), then pull the open-weight model:
```bash
ollama pull gemma4:e4b
```
*(Alternatively, any standard OpenAI-compatible local model tag such as `gemma2:2b` or `llama3.2` can be used).*

### 2. Configure Environment
Copy the example environment template:
```bash
cp .env.example .env.local
```
The default `.env.example` is preconfigured for local Ollama out of the box:
```env
LLM_BASE_URL=http://127.0.0.1:11434/v1
LLM_MODEL=gemma4:e4b
LLM_API_KEY=ollama
```
*(No account, payment method, or API key is required—`LLM_API_KEY=ollama` satisfies the standard OpenAI-compatible authorization header).*

### 3. Install Dependencies & Build
```bash
npm ci
npm run build
```

### 4. Start Production Server
```bash
npm start
```
Open [http://localhost:3000](http://localhost:3000) or [http://localhost:3000/closet](http://localhost:3000/closet) in your browser.

---

## Running Hosted (Cloud Endpoints & Render)

### Hosted Environment Variables
To connect Closet 404 to a hosted OpenAI-compatible provider (e.g. Google AI Studio):

```env
LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
LLM_MODEL=gemini-3.5-flash-lite
LLM_API_KEY=your_google_ai_studio_api_key_here
```

### Deploying to Render
A [`render.yaml`](render.yaml) blueprint is included in the repository.

#### Option A: Deploy via Render Blueprint
1. Connect your repository in the Render Dashboard.
2. Render detects `render.yaml` automatically and configures the web service.
3. Add `LLM_BASE_URL`, `LLM_MODEL`, and `LLM_API_KEY` under the service's Environment settings.

#### Option B: Manual Render Dashboard Configuration
- **Runtime**: `Node`
- **Build Command**: `npm ci && npm run build`
- **Start Command**: `npm start`
- **Environment Variables**:
  - `NODE_ENV`: `production`
  - `LLM_BASE_URL`: `https://generativelanguage.googleapis.com/v1beta/openai/`
  - `LLM_MODEL`: `gemini-3.5-flash-lite`
  - `LLM_API_KEY`: *(Your API key)*

---

## How the Data Was Built

**NEVER INVENT DATA**: All data in `data/archive.json` is generated strictly by automated scripts from real HTTP fetches to the Wayback Machine. Nothing is hand-written or synthesized.

### The Pipeline (`scripts/build-archive.ts`)
Input seed URLs are read sequentially from `data/seed-urls.txt`:
1. **Polite Crawling & Rate Limits**:
   - Enforces a strict 4-second sleep between any two requests to `web.archive.org`.
   - Sends `User-Agent: Closet404/1.0 (hackathon)`.
   - On HTTP 429 or 503, backs off for 30 seconds and retries up to 3 times before logging and skipping.
2. **CDX Indexing**:
   - Queries `https://web.archive.org/cdx/search/cdx?url=<u>&output=json&filter=statuscode:200&filter=mimetype:text/html&collapse=timestamp:6&limit=200`.
   - Extracts `firstCaptured` and `lastCaptured` years from the boundary rows.
   - Selects the earliest capture in the first third of the range whose HTML exceeds 2KB (testing up to 3 candidates).
3. **Accurate Character Set Decoding**:
   - Fetches raw bytes and detects charset from the `Content-Type` header or `<meta>` tags (decoding legacy Windows-1252 / CP1252 / ISO-8859-1 via `TextDecoder` rather than corrupting text with naive UTF-8).
4. **Cheerio Forensics Extraction**:
   - Title and meta description.
   - Meta generator tag.
   - Up to 8 real HTML comments (excluding archive.org wrappers and boilerplate).
   - Up to 8 images `{src, alt}`.
   - Up to 8 outbound links (excluding web.archive.org).
   - Visible body text (stripping scripts, styles, svgs, and iframes; max 2500 characters).
   - Integrity check: If body text is under 200 characters (e.g. image-only pages or framesets), the site is skipped with the reason logged.
5. **Live Status Verification**:
   - Sends a HEAD request (with GET fallback and 6s timeout) to the modern URL.
   - Records live HTTP status code and redirect targets.
6. **Constrained AI Synthesis**:
   - Calls the model with temperature 0.4 and JSON mode.
   - Enforces system instruction: *"Use only the SOURCE provided. If something is not in SOURCE, write 'unknown'. Do not invent names, dates, or events."*
   - Validates response schema against Zod (`title`, `category`, `eulogy`, `ghostPersona`, `vibeTags`, `accentColor`).
7. **Storage & Resumability**:
   - Saves raw historical HTML snapshots to `data/raw/<id>.html`.
   - Writes verified metadata to `data/archive.json` (committed in repo).
   - Supports resume: skips sites already indexed in `data/archive.json`.

---

## Known Limitations

- **Image-Only & Flash/Frameset Sites**: Early web pages with under 200 characters of visible text or HTML <= 2KB are intentionally rejected by the pipeline to avoid guessing or hallucinating facts.
- **Wayback Machine Rate Limits**: The live resurrection API (`/api/resurrect`) operates with a strict 12-second total timeout. If the Internet Archive returns HTTP 429/503 during peak traffic, the route returns an honest error message (`"archive.org rate limited, try again in a minute"`) rather than failing silently or substituting fake data.
- **Hardware Acceleration**: The 3D archival closet uses Three.js and React Three Fiber, requiring WebGL support in the user's browser.

---

## Available Repository Commands

All commands below exist and run directly in this codebase:

```bash
# Start Next.js development server
npm run dev

# Run ESLint quality checks
npm run lint

# Compile and typecheck production build
npm run build

# Start production server
npm start

# TypeScript static typecheck
npx tsc --noEmit

# Test LLM connectivity and verify configuration
npx tsx scripts/ping-llm.ts

# Run the archival builder script across seed URLs
npx tsx scripts/build-archive.ts

# Optional offline embeddings generator
npx tsx scripts/embed.ts
```
