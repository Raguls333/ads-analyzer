# Ad Analyzer

A personal AI advertising strategy intelligence tool and swipe-file builder powered by Google Gemini (`gemini-3.8-flash`).

Available as both a **Sleek React Web Application** (with instant `Ctrl+V` clipboard pasting) and a **Lightweight CLI Script**.

---

## Features & Modules

1. **Ad Creative Analyzer**:
   - **Instant Clipboard Paste (`Ctrl + V`)**: Copy any screenshot (`Win + Shift + S`) from Meta Ad Library, TikTok, etc., press `Ctrl + V` in the app, and analyze immediately.
   - **Video Ads & Reels**: Input Instagram Reels, YouTube Shorts, or upload MP4/MOV files to analyze pacing, visual scenes, and 0-3s hook.
   - **Landing Page URLs**: Input any web URL to extract headlines, offers, and proof elements.
   - **Swipe File Archive**: Search and filter past analyses logged in `ad_log.csv`.

2. **Autonomous Ad Strategy Agent**:
   - **4-Stage Pipeline**: Market Gap Discovery (Reddit/Forums) → Alex Hormozi Offer Engineering → Direct-Response Creative (Visual Prompts & Video Scripts) → Meta Ads Campaign Architecture.
   - Multi-language script generation (English, Tamil, Tanglish, Hindi, Hinglish).

3. **Instagram Profile Auditor**:
   - 5-stage competitive profile teardown from a single Instagram handle/URL.
   - Formats distribution, 5-10 top post hook patterns, the Good vs Bad diagnostic, niche content gaps, and 5 ready-to-shoot Reel ideas.

4. **Instagram Niche Competitive Intelligence (Multi-Account Cohort Intel)**:
   - **Auto-Discovery of High-Performing Accounts**: Type any niche keyword (e.g., *"B2B SaaS", "AI Video Tools", "Direct-To-Consumer Fitness"*) and click **Auto-Discover Top Accounts** to instantly locate 4–6 active, high-performing accounts with follower counts, tiers, bio hooks, growth secrets, and top hook samples via Google Search Grounding.
   - **1-Click Import**: Instantly import discovered accounts into your multi-account cohort teardown or jump directly into a full 5-stage **Profile Audit**.
   - **Stage 1: Account Tiers & Optimization Matrix** (grouping by reach, trust, sales, community vs vanity metrics).
   - **Stage 2: Cross-Account Content Pillar Map** (identifying recurring themes and engagement correlations).
   - **Stage 3: Top 10 Hook Teardowns & Formulas** (naming psychological copywriting patterns and swipe formulas).
   - **Stage 4: Format vs Performance Benchmark** (distinguishing niche-wide trends from single-account outliers).
   - **Stage 5: Monetization & Funnel Architecture** (bio paths, lead magnets, value vs pitch ratio).
   - **Stage 6: Saturation vs Gap Analysis** (identifying audience fatigue and formulating 5 untouched high-intent angles).
   - **Stage 7: 30-Day Content Plan Built from Gaps** (4-week calendar with hooks, formats, beats, and CTAs).
   - Instant 1-click sample datasets (B2B SaaS & Fitness) and structured data template.

---

## 1. Setup Your Gemini API Key

1. Get a free API key at [Google AI Studio](https://aistudio.google.com) (click **"Get API key"**).
2. Set the environment variable in your terminal:

### Windows (PowerShell)
```powershell
$env:GEMINI_API_KEY="your-api-key-here"
```

> **Tip:** To save the key permanently for your user account on Windows:
> ```powershell
> [System.Environment]::SetEnvironmentVariable('GEMINI_API_KEY', 'your-api-key-here', 'User')
> ```

### Windows (CMD)
```cmd
set GEMINI_API_KEY=your-api-key-here
```

### macOS / Linux
```bash
export GEMINI_API_KEY="your-api-key-here"
```

---

## 2. Running the React Web UI (Recommended)

Start the local server with a single command:

```bash
py server.py
```
*(or `python server.py`)*

Then open your browser to:
👉 **[http://localhost:5000](http://localhost:5000)**

### Development Mode (Optional)
If you want to edit the React frontend with hot module reloading:
1. Start the backend: `py server.py`
2. In another terminal: `cd ui && npm run dev`
3. Open `http://localhost:5173`

---

## 3. Running via Command Line (CLI)

You can also run the CLI script directly anytime:

### Analyze an Image Screenshot:
```bash
py ad_analyzer.py "path/to/screenshot.png"
```

### Analyze a Landing Page:
```bash
py ad_analyzer.py https://example.com/special-offer
```

---

## 4. `ad_log.csv` Columns

Every analysis—whether run through the React UI or the CLI—is automatically recorded to `ad_log.csv`:

| Column | Description |
|---|---|
| `timestamp` | Date and time (`YYYY-MM-DD HH:MM:SS`) |
| `source` | Filename or URL analyzed |
| `hook` | The literal opening hook or headline |
| `offer` | Literal offer or value exchange |
| `cta` | Call-to-action button or phrasing |
| `proof_elements` | Semicolon-separated list of testimonials, ratings, stats, logos |
| `price_shown` | Price or discount visibly present |
| `creative_format` | Format observed (e.g. UGC, static graphic, testimonial card) |
| `audience` | Inferred target demographic or persona |
| `positioning` | Inferred market positioning |
| `psychological_angle` | Persuasion trigger (e.g. Social Proof, FOMO, Authority) |
| `awareness_level` | Buyer awareness stage (Unaware, Problem-Aware, Solution-Aware, etc.) |
| `notes` | Mechanistic hypothesis and conversion logic |
