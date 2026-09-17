#!/usr/bin/env python3
"""
Ad Analyzer Web Server:
Lightweight Python API bridge (standard library http.server) that connects
the React UI with the ad_analyzer Gemini engine and ad_log.csv.
"""

import base64
import csv
import json
import os
import sys
from datetime import datetime
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse

from google import genai
from google.genai import types

# ---------------------------------------------------------------------------
# Load .env file automatically if present
# ---------------------------------------------------------------------------
def _load_dotenv():
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    if os.path.isfile(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    key = key.strip()
                    val = val.strip().strip("'\"")
                    if key:
                        os.environ[key] = val

_load_dotenv()

# Import helpers and engine from ad_analyzer
import ad_analyzer

PORT = int(os.environ.get("PORT", 5000))
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DIST_DIR = os.path.join(SCRIPT_DIR, "ui", "dist")


STRATEGY_AGENT_SYSTEM_INSTRUCTION = """You are an Ad Strategy Agent. Given a niche, product, or service, you run a
4-stage research-to-creative pipeline and return a complete, ready-to-execute
ad strategy. Do not skip stages. Do not ask the user for information you can
find yourself via search — only ask if the input is too vague to search at all.

INPUT REQUIRED FROM USER:
- Niche / product / service
- Platform(s) to advertise on (Instagram, Facebook, TikTok, etc.)
- Primary CTA / conversion goal (call, purchase, trial, download)
- (Optional) creative format preference: static/design or short-video script

=====================================================
STAGE 1 — CROSS-PLATFORM GAP RESEARCH
=====================================================
Search Reddit, Facebook groups, Google (reviews/forums/Q&A), niche blogs, and
TikTok comments for real discussions about the given niche. Pull direct
language people use when they complain, ask questions, or express frustration
about existing solutions.

Return:
1. Top 5 recurring gaps/frustrations, ranked by frequency and emotional intensity
2. For each: 2-3 representative quotes (paraphrased if needed), source platform,
   and why it matters to this audience
3. Which single gap is most underserved by current market leaders
4. A one-line "gap statement" per gap, written in the customer's own words

Prioritize recency (last 12 months) and specificity over generic complaints.
Present all 5, then select the highest-priority gap to carry forward — state
your reasoning for the pick in one sentence, but let the user override it.

=====================================================
STAGE 2 — ICP, SEGMENTATION & OFFER ENGINEERING
=====================================================
Using the selected gap, act as Alex Hormozi and build:

1. IDEAL CUSTOMER AVATAR
   - Demographics, current situation, previously failed solutions
   - The exact trigger moment that starts their search for a solution
   - Their underlying fear (behind the stated problem)
   - Their actual desired outcome (not the feature — the transformation)

2. AUDIENCE SEGMENTATION
   - 2-3 sub-segments within this ICA (by awareness level, urgency, or budget)
   - Which segment to target first, and why

3. OFFER ENGINEERING (Value Equation: Dream Outcome x Perceived Likelihood of
   Success / Time Delay x Effort & Sacrifice)
   - Core offer definition
   - Dream outcome in the customer's own words
   - 3 levers to increase perceived likelihood (guarantees, proof, transparency)
   - 3 levers to reduce time delay (fast wins, milestones)
   - 3 levers to reduce effort/sacrifice (done-for-you elements, simplicity)
   - Value-adding bonus stack
   - Risk reversal / guarantee structure
   - Final one-sentence irresistible offer statement

Be direct about weak points in the offer. Do not soften — the offer must be
genuinely hard to refuse.

=====================================================
STAGE 3 — CREATIVE OUTPUT (branch by format)
=====================================================
If format = static/design:
  Act as a direct-response creative director. Generate a Canva/Gemini
  image-generation prompt that:
  - Visually represents the "before" frustration or "after" transformation
    (produce both options)
  - Uses proof elements as visual anchors, not just text
  - Matches native platform content style (not corporate/stock-photo)
  - Includes exact copy overlay text (headline, subhead, CTA), mobile-sized
  - Specifies color psychology and composition for the offer's positioning
  Output as one copy-pasteable prompt block, plus 2 alternate headline variants.

If format = short-video:
  Act as a short-form direct-response scriptwriter with Tarantino's sense of
  tension/pacing and Billy Wilder's economical, sharp dialogue, disciplined by
  direct-response principles (every line earns its place toward the CTA).
  Write a 30-second script:
  1. HOOK (0-3s): tension/curiosity line in the customer's own vernacular
  2. TENSION (3-6s): the stat/contrast that raises stakes
  3. PROOF (6-20s): 3 beats, each a visual + one spoken line, showing not
     claiming transformation
  4. OBJECTION HANDLE (20-25s): pre-empt the single biggest purchase hesitation
  5. CTA (25-30s): one action, urgent but not desperate
  For each beat specify: spoken line, visual direction, on-screen text overlay,
  shot type. Write it shootable by a solo creator on a phone — no production
  budget required. Language must sound spoken, not written.

If format is unspecified, generate both.

=====================================================
STAGE 4 — CAMPAIGN STRUCTURE & BUDGET
=====================================================
Recommend, based on the CTA and awareness level established above:
- Meta campaign objective (Leads / Conversions / Traffic) and why
- Funnel structure (single-stage cold vs TOF/retargeting split) and why
- Ad set structure: CBO vs ABO, number of ad sets, creatives per ad set,
  broad vs interest targeting
- Testing budget: daily spend per creative batch, number of hook variants to
  test (3-4), minimum run length before declaring a winner (7 days minimum)
- Scaling cadence once a winner is found (20-30% increases every 3 days)
- Any Meta ad policy considerations relevant to this niche

=====================================================
OUTPUT FORMAT
=====================================================
Return all 4 stages in order, clearly headed. End with a one-paragraph
executive summary: the gap chosen, the offer, the creative format, and the
recommended starting budget — so the user can execute without re-reading
everything."""


GAPS_RESEARCH_SYSTEM_INSTRUCTION = """You are a direct-response market research specialist discovering real customer gaps & pain points.
Given a niche, product, or service, search Reddit, Facebook groups, Google reviews/forums, niche blogs, and TikTok comments for real discussions.
Pull direct emotional language people use when they complain, ask questions, or express frustration about existing solutions.

Return ONLY a valid JSON object matching this schema:
{
  "recommended_gap_id": "gap_1",
  "recommended_reason": "One-sentence explanation of why this gap is most underserved and highest-converting.",
  "gaps": [
    {
      "id": "gap_1",
      "title": "Short punchy title of the frustration/gap",
      "gap_statement": "A one-line statement written in the customer's own first-person emotional words",
      "intensity": "High" | "Very High" | "Extreme",
      "frequency_rank": 1,
      "why_it_matters": "Why this problem costs them money, time, or emotional peace",
      "quotes": [
        {
          "quote": "Direct or paraphrased representative quote from real discussions",
          "source": "Reddit / TikTok / Google Reviews / Forum"
        }
      ]
    }
  ]
}

Rules:
1. Return 5 distinct, recurring gaps ranked by emotional intensity and frequency.
2. Prioritize recency (last 12 months) and specificity over generic complaints.
3. Every quote must sound like a real human expressing raw frustration.
4. Output ONLY valid JSON, no surrounding commentary or markdown fences.
"""


class AdAnalyzerHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        # Serve static files from ui/dist if it exists, otherwise current dir
        serve_dir = DIST_DIR if os.path.isdir(DIST_DIR) else SCRIPT_DIR
        super().__init__(*args, directory=serve_dir, **kwargs)

    def _send_json(self, status_code: int, payload: dict):
        response_bytes = json.dumps(payload).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(response_bytes)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(response_bytes)

    def do_OPTIONS(self):
        """Handle CORS preflight requests."""
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Gemini-API-Key")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/health":
            api_key_set = bool(os.environ.get("GEMINI_API_KEY"))
            self._send_json(200, {
                "status": "ok",
                "apiKeySet": api_key_set,
                "model": ad_analyzer.MODEL_NAME,
            })
            return

        if path == "/api/logs":
            csv_path = os.path.join(SCRIPT_DIR, ad_analyzer.CSV_FILENAME)
            records = []
            if os.path.isfile(csv_path) and os.path.getsize(csv_path) > 0:
                try:
                    with open(csv_path, mode="r", encoding="utf-8") as f:
                        reader = csv.DictReader(f)
                        for row in reader:
                            # Parse proof_elements back into list for frontend badges
                            proof_raw = row.get("proof_elements", "")
                            proof_list = [p.strip() for p in proof_raw.split(";") if p.strip()] if proof_raw else []
                            records.append({
                                "timestamp": row.get("timestamp", ""),
                                "source": row.get("source", ""),
                                "hook": row.get("hook", ""),
                                "offer": row.get("offer", ""),
                                "cta": row.get("cta", ""),
                                "proof_elements": proof_list,
                                "price_shown": row.get("price_shown", ""),
                                "creative_format": row.get("creative_format", ""),
                                "audience": row.get("audience", ""),
                                "positioning": row.get("positioning", ""),
                                "psychological_angle": row.get("psychological_angle", ""),
                                "awareness_level": row.get("awareness_level", ""),
                                "notes": row.get("notes", ""),
                            })
                    # Newest first
                    records.reverse()
                except Exception as e:
                    self._send_json(500, {"error": f"Failed reading log: {e}"})
                    return

            self._send_json(200, {"logs": records})
            return

        # Fallback to serving static frontend build or 404
        if os.path.isdir(DIST_DIR):
            file_path = os.path.join(DIST_DIR, path.lstrip("/"))
            if not os.path.exists(file_path):
                # SPA fallback: serve index.html for client-side routing
                self.path = "/index.html"
            return super().do_GET()

        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)

        if parsed.path == "/api/benchmark":
            content_length = int(self.headers.get("Content-Length", 0))
            post_body = self.rfile.read(content_length)
            try:
                payload = json.loads(post_body.decode("utf-8"))
            except Exception as e:
                self._send_json(400, {"error": f"Invalid JSON payload: {e}"})
                return

            custom_key = self.headers.get("X-Gemini-API-Key") or payload.get("apiKey")
            api_key = (custom_key.strip() if custom_key else None) or os.environ.get("GEMINI_API_KEY")
            if not api_key:
                self._send_json(400, {
                    "error": "No Gemini API key provided. Set GEMINI_API_KEY on the server or enter your API key in the app."
                })
                return

            prompt = payload.get("prompt", "").strip()
            if not prompt:
                self._send_json(400, {"error": "Benchmark research prompt cannot be empty."})
                return

            try:
                client = genai.Client(api_key=api_key)
                config = types.GenerateContentConfig(
                    system_instruction=(
                        "You are an elite Meta Ads (Facebook & Instagram) media buyer and growth strategist. "
                        "When requested for benchmark data, provide rigorous, realistic 2026 Meta Ads benchmarks, "
                        "CPL, CPC, and CTR estimates, CBO vs ABO ad set structures, budget calculations to exit the learning phase, "
                        "creative format retention benchmarks, funnel architecture, and compliance guidelines. "
                        "Cite specific agency benchmarks, Meta documentation, and industry case studies from 2025-2026. "
                        "Format your response with clear Markdown headings, tables, and bullet points."
                    )
                )
                raw_text, used_model = ad_analyzer._call_with_fallback(client, [prompt], config)
                self._send_json(200, {
                    "success": True,
                    "result": raw_text,
                    "model": used_model,
                })
                return
            except Exception as e:
                err_str = str(e)
                self._send_json(500, {"error": f"Failed running benchmark research: {err_str}", "details": err_str})
                return

        if parsed.path == "/api/strategy-agent/gaps":
            content_length = int(self.headers.get("Content-Length", 0))
            post_body = self.rfile.read(content_length)
            try:
                payload = json.loads(post_body.decode("utf-8"))
            except Exception as e:
                self._send_json(400, {"error": f"Invalid JSON payload: {e}"})
                return

            custom_key = self.headers.get("X-Gemini-API-Key") or payload.get("apiKey")
            api_key = (custom_key.strip() if custom_key else None) or os.environ.get("GEMINI_API_KEY")
            if not api_key:
                self._send_json(400, {
                    "error": "No Gemini API key provided. Set GEMINI_API_KEY on the server or enter your API key in the app."
                })
                return

            niche = payload.get("niche", "").strip()
            if not niche:
                self._send_json(400, {"error": "Niche, product, or service topic is required."})
                return

            platforms = payload.get("platforms", "Instagram, Facebook")
            exclude_gaps = payload.get("excludeGaps", [])

            user_msg = (
                f"NICHE / PRODUCT / SERVICE: {niche}\n"
                f"TARGET PLATFORMS: {platforms}\n"
            )
            if exclude_gaps and isinstance(exclude_gaps, list) and len(exclude_gaps) > 0:
                avoid_list = "; ".join([f'"{str(g)}"' for g in exclude_gaps if g])
                user_msg += (
                    f"\nCRITICAL: The user was not fully satisfied with previous angles. "
                    f"Do NOT repeat any of these previously found gaps or pain points:\n[{avoid_list}]\n"
                    f"Dig deeper into different subreddits, forums, TikTok comments, and niche reviews to uncover 5 brand new, distinct, high-intensity pain points and gaps."
                )

            try:
                client = genai.Client(api_key=api_key)
                raw_text = None
                used_model = None

                try:
                    search_tool = types.Tool(google_search=types.GoogleSearch())
                    config_with_search = types.GenerateContentConfig(
                        system_instruction=GAPS_RESEARCH_SYSTEM_INSTRUCTION,
                        tools=[search_tool],
                        response_mime_type="application/json",
                    )
                    raw_text, used_model = ad_analyzer._call_with_fallback(client, [user_msg], config_with_search)
                except Exception as e_search:
                    print(f"Search grounding unavailable for gaps ({e_search}). Retrying with direct config ...")
                    config_direct = types.GenerateContentConfig(
                        system_instruction=GAPS_RESEARCH_SYSTEM_INSTRUCTION,
                        response_mime_type="application/json",
                    )
                    raw_text, used_model = ad_analyzer._call_with_fallback(client, [user_msg], config_direct)

                parsed_data = ad_analyzer.extract_json(raw_text)
                self._send_json(200, {
                    "success": True,
                    "data": parsed_data,
                    "model": used_model,
                    "niche": niche,
                })
                return
            except Exception as e:
                err_str = str(e)
                self._send_json(500, {"error": f"Failed researching gaps: {err_str}", "details": err_str})
                return

        if parsed.path == "/api/strategy-agent":
            content_length = int(self.headers.get("Content-Length", 0))
            post_body = self.rfile.read(content_length)
            try:
                payload = json.loads(post_body.decode("utf-8"))
            except Exception as e:
                self._send_json(400, {"error": f"Invalid JSON payload: {e}"})
                return

            custom_key = self.headers.get("X-Gemini-API-Key") or payload.get("apiKey")
            api_key = (custom_key.strip() if custom_key else None) or os.environ.get("GEMINI_API_KEY")
            if not api_key:
                self._send_json(400, {
                    "error": "No Gemini API key provided. Set GEMINI_API_KEY on the server or enter your API key in the app."
                })
                return

            niche = payload.get("niche", "").strip()
            if not niche:
                self._send_json(400, {"error": "Niche, product, or service topic is required."})
                return

            platforms = payload.get("platforms", "Instagram, Facebook")
            goal = payload.get("goal", "Book Free Demo / Consultation")
            format_pref = payload.get("formatPreference", "both")
            selected_gap = payload.get("selectedGap", "").strip()
            script_lang = payload.get("scriptLanguage", "english").lower().strip()

            lang_instructions = {
                "tamil": (
                    "CRITICAL SCRIPT LANGUAGE INSTRUCTION (STAGE 3 SHORT-VIDEO SCRIPT):\n"
                    "- Write the spoken dialogue lines of the 30-second video script in authentic, natural spoken TAMIL (தமிழ்).\n"
                    "- Do NOT use stiff textbook/literary Tamil. It must sound conversational, exactly like a native Tamil content creator speaking passionately to their audience.\n"
                    "- Visual scene directions, text overlays, and shot types can remain in English for the production crew, but the SPOKEN DIALOGUE lines must be in Tamil (தமிழ்)."
                ),
                "tanglish": (
                    "CRITICAL SCRIPT LANGUAGE INSTRUCTION (STAGE 3 SHORT-VIDEO SCRIPT):\n"
                    "- Write the spoken dialogue lines of the 30-second video script in colloquial TANGLISH (Tamil words transliterated into English/Latin script, the predominant conversational format for South Indian Instagram Reels & YouTube Shorts ads).\n"
                    "- Example style: 'Neenga innum manual-ah Excel-la data enter panreengala? Daily 2 hours waste aagudha? Stop panunga! Orey click-la invoice generate pannunga...'\n"
                    "- It must sound 100% natural, energetic, and relatable like an authentic South Indian creator speaking to a friend, avoiding formal corporate language."
                ),
                "hinglish": (
                    "CRITICAL SCRIPT LANGUAGE INSTRUCTION (STAGE 3 SHORT-VIDEO SCRIPT):\n"
                    "- Write the spoken dialogue lines of the 30-second video script in conversational HINGLISH (Hindi spoken dialogue written in Roman/English alphabet, widely used in Indian D2C & social ads).\n"
                    "- Example style: 'Kya aap bhi har roz client follow-ups se pareshan ho? Daily 4 ghante waste ho rahe hain? Stop doing this manually...'"
                ),
                "hindi": (
                    "CRITICAL SCRIPT LANGUAGE INSTRUCTION (STAGE 3 SHORT-VIDEO SCRIPT):\n"
                    "- Write the spoken dialogue lines of the 30-second video script in spoken HINDI (हिंदी), punchy and conversational for social media reels."
                ),
                "english": (
                    "CRITICAL SCRIPT LANGUAGE INSTRUCTION (STAGE 3 SHORT-VIDEO SCRIPT):\n"
                    "- Write the spoken dialogue lines in punchy, direct-response English with tension and economical dialogue (Tarantino/Wilder style)."
                ),
            }
            lang_prompt = lang_instructions.get(script_lang, lang_instructions["english"])

            gap_prompt = ""
            if selected_gap:
                gap_prompt = (
                    f"\nCRITICAL: USER HAS REVIEWED STAGE 1 MARKET GAPS AND EXPLICITLY CHOSEN THIS SPECIFIC GAP:\n"
                    f">>> \"{selected_gap}\"\n"
                    f"Engineer Stage 2 (Alex Hormozi Offer & Value Equation) and Stage 3 (Creative Visuals & Video Script) specifically around THIS selected gap as the core hook and problem!\n"
                )

            user_message = (
                f"INPUT PROVIDED BY USER:\n"
                f"- Niche / product / service: {niche}\n"
                f"- Platform(s) to advertise on: {platforms}\n"
                f"- Primary CTA / conversion goal: {goal}\n"
                f"- Creative format preference: {format_pref}\n"
                f"- Script Language: {script_lang.upper()}\n"
                f"{gap_prompt}\n"
                f"{lang_prompt}\n\n"
                f"Execute the 4-stage research-to-creative pipeline now without skipping any stage. "
                f"If a specific gap was selected above, carry it forward into the Hormozi offer and creative output. "
                f"Ground your market research in real discussions and language from Reddit, forums, TikTok, and reviews. "
                f"Follow all instructions and output formats strictly."
            )

            try:
                client = genai.Client(api_key=api_key)

                # Attempt with Google Search grounding tool for real-time web intelligence
                raw_text = None
                used_model = None
                try:
                    search_tool = types.Tool(google_search=types.GoogleSearch())
                    config_with_search = types.GenerateContentConfig(
                        system_instruction=STRATEGY_AGENT_SYSTEM_INSTRUCTION,
                        tools=[search_tool],
                    )
                    raw_text, used_model = ad_analyzer._call_with_fallback(client, [user_message], config_with_search)
                except Exception as e_search:
                    print(f"Search grounding unavailable or errored ({e_search}). Retrying with direct reasoning fallback ...")
                    config_direct = types.GenerateContentConfig(
                        system_instruction=STRATEGY_AGENT_SYSTEM_INSTRUCTION,
                    )
                    raw_text, used_model = ad_analyzer._call_with_fallback(client, [user_message], config_direct)

                self._send_json(200, {
                    "success": True,
                    "result": raw_text,
                    "model": used_model,
                    "niche": niche,
                    "platforms": platforms,
                    "goal": goal,
                    "formatPreference": format_pref,
                })
                return
            except Exception as e:
                err_str = str(e)
                self._send_json(500, {"error": f"Failed executing Ad Strategy Agent pipeline: {err_str}", "details": err_str})
                return

        if parsed.path != "/api/analyze":
            self._send_json(404, {"error": "Not found"})
            return

        content_length = int(self.headers.get("Content-Length", 0))
        post_body = self.rfile.read(content_length)
        try:
            payload = json.loads(post_body.decode("utf-8"))
        except Exception as e:
            self._send_json(400, {"error": f"Invalid JSON payload: {e}"})
            return

        # Check for custom API key passed from UI header or body; fall back to server env
        custom_key = self.headers.get("X-Gemini-API-Key") or payload.get("apiKey")
        api_key = (custom_key.strip() if custom_key else None) or os.environ.get("GEMINI_API_KEY")
        if not api_key:
            self._send_json(400, {
                "error": "No Gemini API key provided. Set GEMINI_API_KEY on the server or enter your API key in the app."
            })
            return

        input_type = payload.get("type", "url")
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        try:
            client = genai.Client(api_key=api_key)
            temp_video_cleanup = None

            if input_type == "video_url":
                url = payload.get("url", "").strip()
                if not url:
                    self._send_json(400, {"error": "Video URL cannot be empty."})
                    return
                source_display = url
                temp_video_cleanup = ad_analyzer.download_video_clip(url)
                data, raw_response = ad_analyzer.analyze_video_ad(client, temp_video_cleanup)

            elif input_type == "video_file":
                raw_data = payload.get("data", "")
                filename = payload.get("filename", "Uploaded Video")
                source_display = filename

                if not raw_data:
                    self._send_json(400, {"error": "Video data cannot be empty."})
                    return

                if "," in raw_data:
                    raw_data = raw_data.split(",", 1)[1]

                import tempfile
                temp_fd, temp_video_cleanup = tempfile.mkstemp(suffix=".mp4", prefix="ad_upload_")
                os.close(temp_fd)
                with open(temp_video_cleanup, "wb") as f:
                    f.write(base64.b64decode(raw_data))

                data, raw_response = ad_analyzer.analyze_video_ad(client, temp_video_cleanup)

            elif input_type == "url":
                url = payload.get("url", "").strip()
                if not url:
                    self._send_json(400, {"error": "URL cannot be empty."})
                    return
                source_display = url
                page_text = ad_analyzer.fetch_url_text(url)
                prompt = (
                    f"Analyze the following landing page text according to the system instructions:\n\n"
                    f"--- BEGIN LANDING PAGE TEXT ---\n{page_text}\n--- END LANDING PAGE TEXT ---"
                )
                data, raw_response = ad_analyzer.analyze_ad(client, [prompt])

            elif input_type == "image":
                raw_data = payload.get("data", "")
                mime_type = payload.get("mimeType", "image/png")
                filename = payload.get("filename", "Pasted Screenshot")
                source_display = filename

                if not raw_data:
                    self._send_json(400, {"error": "Image data cannot be empty."})
                    return

                # Strip base64 data URL header if present (e.g. data:image/png;base64,...)
                if "," in raw_data:
                    header, base64_str = raw_data.split(",", 1)
                    if "image/" in header:
                        extracted_mime = header.split(";")[0].replace("data:", "")
                        if extracted_mime:
                            mime_type = extracted_mime
                else:
                    base64_str = raw_data

                image_bytes = base64.b64decode(base64_str)
                part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)
                prompt = "Analyze this advertisement image according to the system instructions."
                data, raw_response = ad_analyzer.analyze_ad(client, [prompt, part])
            else:
                self._send_json(400, {"error": f"Unknown input type: {input_type}"})
                return

            if data:
                observed = data.get("observed", {})
                inference = data.get("inference", {})
                proof_list = observed.get("proof_elements", [])
                if isinstance(proof_list, list):
                    proof_str = "; ".join(str(p).strip() for p in proof_list if p)
                else:
                    proof_str = str(proof_list or "")

                row = {
                    "timestamp": timestamp,
                    "source": source_display,
                    "hook": observed.get("hook", ""),
                    "offer": observed.get("offer", ""),
                    "cta": observed.get("cta", ""),
                    "proof_elements": proof_str,
                    "price_shown": observed.get("price_shown", ""),
                    "creative_format": observed.get("creative_format", ""),
                    "audience": inference.get("audience", ""),
                    "positioning": inference.get("positioning", ""),
                    "psychological_angle": inference.get("psychological_angle", ""),
                    "awareness_level": inference.get("awareness_level", ""),
                    "notes": data.get("notes", ""),
                }
                ad_analyzer.append_to_csv(row)

                self._send_json(200, {
                    "success": True,
                    "data": data,
                    "timestamp": timestamp,
                    "source": source_display,
                })
            else:
                # Log error row without crashing
                error_row = {
                    "timestamp": timestamp,
                    "source": source_display,
                    "hook": "",
                    "offer": "",
                    "cta": "",
                    "proof_elements": "",
                    "price_shown": "",
                    "creative_format": "ERROR",
                    "audience": "",
                    "positioning": "",
                    "psychological_angle": "",
                    "awareness_level": "",
                    "notes": f"[ERROR: Invalid JSON] Raw response: {raw_response}",
                }
                ad_analyzer.append_to_csv(error_row)

                self._send_json(502, {
                    "success": False,
                    "error": "Failed to parse structured JSON from Gemini after retry.",
                    "raw_response": raw_response,
                    "timestamp": timestamp,
                    "source": source_display,
                })

        except Exception as e:
            err_str = str(e)
            err_lower = err_str.lower()
            if "503" in err_str or "unavailable" in err_lower or "high demand" in err_lower:
                user_msg = "Google Gemini API is currently experiencing a temporary demand surge (503 Unavailable). Automatic retries were attempted across Flash models. Please wait 30-60 seconds and try again."
            elif any(k in err_lower for k in ["per day", "daily", "requests per day"]):
                user_msg = (
                    "Gemini API Free Tier daily quota reached (RPD limit reached for today). "
                    "Google AI Studio resets daily quotas at midnight Pacific Time (PT). "
                    "To continue analyzing immediately, create a new API key under a fresh Google Cloud project in AI Studio or link a billing account for Pay-As-You-Go."
                )
            elif "429" in err_str or "quota" in err_lower or "rate" in err_lower or "resource_exhausted" in err_lower:
                user_msg = (
                    f"Gemini API rate limit reached (429). {err_str} "
                    "Free tier accounts have strict RPM/TPM limits (especially with video analysis). "
                    "Please wait 60 seconds and try again, or switch to a fresh API key."
                )
            elif "404" in err_str or "not_found" in err_lower or "no longer available" in err_lower:
                user_msg = f"Model configuration notice: {err_str}"
            else:
                user_msg = err_str
            self._send_json(500, {"error": user_msg, "details": err_str})
        finally:
            if temp_video_cleanup and os.path.isfile(temp_video_cleanup):
                try:
                    os.remove(temp_video_cleanup)
                except Exception:
                    pass


def main():
    server_address = ("", PORT)
    httpd = HTTPServer(server_address, AdAnalyzerHandler)
    print(f"Ad Analyzer API server running at http://localhost:{PORT}")
    print("Press Ctrl+C to stop.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
        httpd.server_close()


if __name__ == "__main__":
    main()
