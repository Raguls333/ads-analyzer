# Ad Analyzer

A personal AI advertising strategy intelligence tool and swipe-file builder powered by Google Gemini (`gemini-3.8-flash`).

Available as both a **Sleek React Web Application** (with instant `Ctrl+V` clipboard pasting) and a **Lightweight CLI Script**.

---

## Features

- **React Web App**:
  - **Instant Clipboard Paste (`Ctrl + V`)**: Copy any screenshot (`Win + Shift + S`) from Meta Ad Library, Twitter, TikTok, etc., press `Ctrl + V` in the app, and analyze immediately without saving image files to disk!
  - **Drag & Drop**: Drop ad screenshots right onto the dropzone.
  - **Landing Page URLs**: Input any web URL to extract copy, headlines, offers, and proof elements.
  - **Interactive Strategy Breakdown**: Visual cards with color-coded tags for Observed facts and Strategic Inferences.
  - **1-Click Copy**: Copy analysis as formatted Markdown for Notion/Docs or JSON.
  - **Swipe File Archive**: Search and filter past analyses logged in `ad_log.csv` by keyword, angle, or buyer awareness stage.
- **Python CLI Tool**:
  - `python ad_analyzer.py screenshot.png` or `python ad_analyzer.py https://example.com`
  - Formatted terminal output + auto-logging to `ad_log.csv`.
- **Strict Strategy Schema**:
  - **Observed**: Hook, Offer, CTA, Proof Elements, Price Shown, Creative Format (literal visual facts).
  - **Inference**: Target Audience, Positioning, Psychological Angle, Awareness Level (reasoned hypotheses).
  - **Notes**: Conversion mechanism without unsubstantiated performance claims.

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
