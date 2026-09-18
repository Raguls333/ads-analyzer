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


INSTA_AUDIT_SYSTEM_INSTRUCTION = """You are an elite Instagram growth strategist, direct-response creative director, and competitive intelligence analyst.
Given an Instagram profile URL or handle, conduct a deep, rigorous competitive audit by searching Google, public Instagram discussions, creator benchmarks, and social data.

Analyze the profile thoroughly and structure your response into EXACTLY 5 distinct numbered stages, followed by an Executive Summary:

=====================================================
STAGE 1 — CONTENT FORMATS & ENGAGEMENT ANALYSIS
=====================================================
- Identify all content formats used (Reels, Carousels, Static image posts, Stories/Highlights).
- Approximate format distribution (e.g. 70% Reels, 20% Carousels, 10% Static).
- Determine which specific format performs BEST based on visible engagement signals (views, likes, comments, save/share intent).
- Identify which format is neglected or underperforming, and why.

=====================================================
STAGE 2 — 5-10 TOP PERFORMING POSTS & PATTERNS
=====================================================
Identify 5 to 10 of their highest-performing recent posts/reels and deconstruct the core patterns:
- Hook Patterns: Opening 0-3s visual cues, audio questions, or text overlays that stop the scroll.
- Topic Themes: The exact problem statements or transformations that generate the highest engagement.
- Tone & Delivery: Energy level, pacing, personality style (e.g., authoritative mentor, entertaining skeptic, vulnerable founder).
- Editing & Production Style: Fast cuts vs single-take, B-roll usage, music/trending audio, on-screen captions.
- Thumbnail / Cover Style: Visual contrast, text font, facial expressions, and feed aesthetic consistency.

=====================================================
STAGE 3 — THE GOOD & THE BAD AUDIT
=====================================================
Provide an honest, unvarnished diagnostic breakdown:
1. WHAT'S WORKING WELL (The "Good"):
   - Clear positioning, authentic creator presence, strong visual identity, social proof, high comment velocity, or authority signals.
2. WHAT'S WEAK OR INCONSISTENT (The "Bad"):
   - Inconsistent posting cadence, generic/buried captions, weak or missing CTAs, lack of community replies, low engagement relative to follower count, or lack of clear lead funnel.

=====================================================
STAGE 4 — NICHE CONTENT GAPS & COMPETITOR ADVANTAGES
=====================================================
- Uncover specific topics, sub-themes, and questions in their niche that competitors or viral creators cover, but this profile completely ignores.
- Identify underserved audience segments or pain points left on the table.
- Identify format gaps (e.g., lack of green-screen case studies, lack of step-by-step swipe carousels, lack of teardowns or behind-the-scenes failures).

=====================================================
STAGE 5 — OUTPERFORMING CONTENT PLAN & SPECIFIC REEL IDEAS
=====================================================
Deliver an actionable, ready-to-execute content strategy to build a page that out-competes them in this exact niche.
CRITICAL: Ground every suggestion in their actual top videos — do NOT give generic social media advice!
1. Profile Positioning & Optimization:
   - Bio structure, clear transformation hook, and recommended lead magnet / bio link.
2. Weekly Posting Cadence & Format Mix:
   - Weekly breakdown (e.g. 4 Reels, 2 Carousels, daily Stories).
3. 5 Ready-to-Shoot Reel Ideas (Grounded in their winning patterns, upgraded with better hooks & pacing):
   - Reel 1: Title, Exact 0-3s Hook, Visual Action, 3 Story Beats, CTA.
   - Reel 2: Title, Exact 0-3s Hook, Visual Action, 3 Story Beats, CTA.
   - Reel 3: Title, Exact 0-3s Hook, Visual Action, 3 Story Beats, CTA.
   - Reel 4: Title, Exact 0-3s Hook, Visual Action, 3 Story Beats, CTA.
   - Reel 5: Title, Exact 0-3s Hook, Visual Action, 3 Story Beats, CTA.

=====================================================
EXECUTIVE SUMMARY
=====================================================
A concise, punchy 1-paragraph summary: their core secret to growth, their single biggest vulnerability, and the #1 strategic lever to outperform them in the next 90 days.
"""


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


INSTA_NICHE_INTEL_SYSTEM_INSTRUCTION = """You are an elite social media strategist, direct-response copywriter, and competitive intelligence director specializing in Instagram growth and monetization.
You will be provided with:
1. A specific NICHE / industry.
2. The user's STRATEGIC GOAL (e.g. launch a new page, position a SaaS, find monetization gaps, scale organic reach).
3. Competitive data collected across N accounts (handles, follower counts, bios, link-in-bio destinations, recent post captions/hooks, post formats, engagement metrics, posting cadence).

Conduct a deep, rigorous cohort analysis and structure your output into EXACTLY 7 numbered stages, followed by an Executive Summary:

=====================================================
STAGE 1 — ACCOUNT TIERS & OPTIMIZATION MATRIX
=====================================================
- Group accounts into strategic tiers based on size AND what they are actually optimizing for (Reach, Trust/Authority, Direct Sales, or Community). Do NOT just rank by follower count.
- Include a Markdown comparison table with columns: Account Handle, Follower Count, Primary Optimization Goal (Reach/Trust/Sales/Community), Visible Funnel Vehicle, and Verdict (Vanity vs Real Business Traction).
- Be completely blunt about what looks like vanity metrics (high followers with low comment quality or engagement pods) vs authentic commercial traction.

=====================================================
STAGE 2 — CROSS-ACCOUNT CONTENT PILLAR MAP
=====================================================
- Identify the recurring content themes each account posts.
- Map which specific pillars correlate with the highest engagement across accounts (not just within one isolated account).
- Contrast high-reach pillars (top-of-funnel viral content) with high-conversion pillars (bottom-of-funnel proof and case studies).
- Flag any contradictions between accounts (e.g., if one account wins on educational carousels while another wins on raw personal rants).

=====================================================
STAGE 3 — TOP 10 HOOK TEARDOWN & PSYCHOLOGICAL PATTERNS
=====================================================
- Extract the 10 highest-performing opening lines/hooks from the provided post data across all accounts.
- For each of the 10 hooks, specify:
  1. Exact Hook Line (quoted)
  2. Source Account (@handle)
  3. Copywriting Pattern Name (e.g., Contrarian Pattern Interrupt, Numbered Listicle / Curiosity Gap, Direct Audience Callout, Vulnerable Story Open, Negative Constraint / "Stop Doing This", Insider Industry Secret)
  4. Why It Worked (the psychological trigger: FOMO, loss aversion, status signaling, cognitive dissonance, simplicity)
  5. Adaptation Formula: A plug-and-play template formula the user can swipe and apply to their own offer.

=====================================================
STAGE 4 — FORMAT VS PERFORMANCE BENCHMARK
=====================================================
- Evaluate engagement across post formats (Reels, Carousels, Static image posts).
- Determine which format definitively outperforms in this niche.
- Explicitly evaluate whether outperformance is a niche-wide pattern or merely an outlier driven by a single account's unique creator personality or production budget.
- Provide a recommended weekly format split (e.g. 60% Reels / 30% Carousels / 10% Stories).

=====================================================
STAGE 5 — MONETIZATION & FUNNEL ARCHITECTURE
=====================================================
- Dissect what each competitor account is actually selling: freebie opt-ins, courses, community subscriptions, SaaS free trials, high-ticket agency services, affiliate links, or nothing visible.
- Deconstruct the Bio -> Link-in-Bio -> CTA conversion path for each account.
- Assess the Value-to-Pitch ratio: how aggressively do they sell in captions/stories vs providing pure standalone value?
- Identify the smoothest, highest-converting funnel pattern present in the dataset.

=====================================================
STAGE 6 — SATURATION VS GAP ANALYSIS (5 UNTOUCHED ANGLES)
=====================================================
- Identify topics, hooks, and formats that are exhausted and oversaturated in this niche (what everybody is posting and audiences are tired of seeing).
- Formulate EXACTLY 5 specific, high-intent content angles that NOBODY in this competitor set is covering, but which are deeply relevant and in-demand for this audience.
- For each of the 5 gap angles, provide:
  - Angle Title
  - The Core Unaddressed Problem or Frustration
  - Example Hook & Working Title
  - Why Competitors Avoid It & Why It Wins for You

=====================================================
STAGE 7 — 30-DAY CONTENT PLAN BUILT FROM GAPS
=====================================================
- Build a full 4-week (30-day) content roadmap engineered specifically around the 5 identified gap angles—NOT an imitation of what the competitors are doing.
- Structure by week (Week 1: Foundations & Contrarian Positioning, Week 2: Deep Dives & Proof, Week 3: Objection Handling & Systems, Week 4: Conversion & Offer Launch).
- For each key post (aim for 3-5 high-impact posts per week across the 30 days), specify:
  - Day & Week
  - Target Content Pillar / Gap Angle
  - Recommended Format (Reel, Carousel, or Story sequence)
  - Exact Opening Hook
  - 3 Core Delivery Beats
  - Call-to-Action (CTA)

=====================================================
EXECUTIVE SUMMARY & IMMEDIATE 7-DAY ACTIONS
=====================================================
- A concise, punchy executive summary:
  1. The single biggest vulnerability across these competitors.
  2. The primary competitive moat the user should build.
  3. Top 3 non-negotiable actions to take in the first 7 days to establish market presence.

CRITICAL RULES:
- Always cite which account each observation came from (using @handle).
- Explicitly flag whenever the provided sample data is too small to draw a definitive conclusion.
- If two accounts contradict each other, explicitly contrast them instead of averaging them out.
- Be blunt about vanity metrics (huge followers, zero comments) vs genuine commercial traction.
"""


DISCOVER_ACCOUNTS_SYSTEM_INSTRUCTION = """You are an elite Instagram competitive intelligence researcher, creator scout, and social media strategist.
Your mission is to find 6 to 10 REAL, LIVE, HIGH-PERFORMING public Instagram creator or business accounts in the specified niche and geographic location (Country, State/Region).

CRITICAL VERIFICATION RULES FOR REAL INSTAGRAM PROFILES (PREVENTING BROKEN 404 LINKS):
1. EVERY SINGLE ACCOUNT MUST BE A REAL, CURRENTLY ACTIVE PUBLIC INSTAGRAM ACCOUNT that exists at https://www.instagram.com/<handle>/.
2. ABSOLUTELY ZERO GUESSING OR FABRICATION OF HANDLES:
   - Do NOT concatenate a person's name with invented suffixes like '_official', '_hq', '_app', '_co', '_inc', or '_global' unless you have verified that this is their exact live Instagram handle.
   - Do NOT include creators or brands that only operate on LinkedIn, Twitter/X, or YouTube. They MUST have an active Instagram account with public posts/Reels.
   - If you are not 100% confident in an exact username, DO NOT GUESS — pick another prominent creator in this niche whose exact Instagram handle you are 100% certain of.
3. HANDLE FORMAT INTEGRITY:
   - Handles MUST be valid Instagram usernames: only letters, numbers, periods (.), and underscores (_). No spaces, no punctuation, no colons, no parentheses.
   - Always format as '@exact_handle' (e.g., '@hubspot', '@anuragaggarwalofficial', '@alexhormozi', '@thefutur', '@garyvee').
4. GEOGRAPHIC PRECISION:
   - If a Country and/or State/Region is specified (e.g., Country: India, State: Tamil Nadu; or Country: United States, State: California):
     Search for and prioritize real creators, founders, businesses, and influencers who are based in, originate from, or explicitly cater to that Country / State / Region.
     If regional accounts are limited, include the top national creators in that country who have high penetration in that region.
     Clearly indicate their geographic base in the "location" field (e.g., "Chennai, Tamil Nadu, India" or "Los Angeles, CA, USA").
   - If location is Global / Worldwide:
     Identify the top global category leaders and viral creators in that niche.
5. DIVERSE STRATEGIC COHORT:
   Include a balanced mix of:
   - Market Leaders (Macro / Authority accounts, >150K followers)
   - Growth Challengers (Mid-tier breakout creators with high Reel velocity, 25K-150K followers)
   - Boutique Specialists (Micro / High-Conversion creators with dedicated community and strong funnels, 5K-25K followers)
6. RICH STRATEGIC DATA:
   - "handle": Real Instagram username starting with '@'.
   - "name": Creator or brand actual display name.
   - "follower_count": Realistic follower magnitude (e.g. '1.2M', '340K', '68K').
   - "tier": "Leader (Macro)" | "Challenger (Mid-Tier)" | "Boutique (High-Conversion)".
   - "location": "City, State, Country" (or "Country" / "Global").
   - "instagram_url": "https://www.instagram.com/<username>/".
   - "bio": Authentic positioning statement or bio excerpt.
   - "link_in_bio": Funnel destination (e.g., "Linktree -> Free Guide", "Newsletter opt-in", "Course / Community", "Direct App Install").
   - "primary_format": Dominant content formats (e.g., "Reels (80%) + Carousels (20%)").
   - "rough_engagement": Estimated engagement rate or average view magnitude (e.g., "High (~4.5%)", "Viral Reels (50K-200K views)").
   - "posting_frequency": Estimated publishing cadence (e.g., "1 Reel/day", "4-5 posts/week").
   - "growth_secret": 1-2 sentences on their specific content hook, visual format, or pacing edge.
   - "top_hooks": Array of 2 to 3 real or representative viral hook opening lines from their high-performing posts.

Output your response strictly inside a ```json ... ``` code block conforming to this schema:
{
  "niche": "Target Niche",
  "location": "Target Location",
  "total_found": 8,
  "accounts": [
    {
      "handle": "@exact_handle",
      "name": "Creator Real Name",
      "follower_count": "320K",
      "tier": "Leader (Macro)",
      "location": "City, State, Country",
      "instagram_url": "https://www.instagram.com/exact_handle/",
      "bio": "Creator bio line",
      "link_in_bio": "Funnel destination",
      "primary_format": "Reels (75%) & Carousels (25%)",
      "rough_engagement": "High (~4.2%)",
      "posting_frequency": "5 Reels / week",
      "growth_secret": "Concise explanation of what makes their content stop the scroll",
      "top_hooks": [
        "Opening hook line #1",
        "Opening hook line #2",
        "Opening hook line #3"
      ]
    }
  ]
}
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

        if parsed.path == "/api/strategy-agent/rewrite-script":
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
            selected_gap = payload.get("selectedGap", "").strip()
            offer = payload.get("offer", "").strip()
            script_lang = payload.get("scriptLanguage", "tanglish").lower().strip()
            existing_script = payload.get("existingScript", "").strip()
            custom_instructions = payload.get("customInstructions", "").strip()

            lang_instructions = {
                "tamil": (
                    "CRITICAL SCRIPT LANGUAGE INSTRUCTION:\n"
                    "- Write the spoken dialogue lines of the 30-second video script in authentic, natural spoken TAMIL (தமிழ்).\n"
                    "- Do NOT use stiff textbook/literary Tamil. It must sound conversational, exactly like a native Tamil content creator speaking passionately to their audience.\n"
                    "- Visual scene directions, text overlays, and shot types can remain in English for the production crew, but the SPOKEN DIALOGUE lines must be in Tamil (தமிழ்)."
                ),
                "tanglish": (
                    "CRITICAL SCRIPT LANGUAGE INSTRUCTION:\n"
                    "- Write the spoken dialogue lines of the 30-second video script in colloquial TANGLISH (Tamil words transliterated into English/Latin script, the predominant conversational format for South Indian Instagram Reels & YouTube Shorts ads).\n"
                    "- Example style: 'Neenga innum manual-ah Excel-la data enter panreengala? Daily 2 hours waste aagudha? Stop panunga! Orey click-la invoice generate pannunga...'\n"
                    "- It must sound 100% natural, energetic, and relatable like an authentic South Indian creator speaking to a friend, avoiding formal corporate language."
                ),
                "hinglish": (
                    "CRITICAL SCRIPT LANGUAGE INSTRUCTION:\n"
                    "- Write the spoken dialogue lines of the 30-second video script in conversational HINGLISH (Hindi spoken dialogue written in Roman/English alphabet, widely used in Indian D2C & social ads).\n"
                    "- Example style: 'Kya aap bhi har roz client follow-ups se pareshan ho? Daily 4 ghante waste ho rahe hain? Stop doing this manually...'"
                ),
                "hindi": (
                    "CRITICAL SCRIPT LANGUAGE INSTRUCTION:\n"
                    "- Write the spoken dialogue lines of the 30-second video script in spoken HINDI (हिंदी), punchy and conversational for social media reels."
                ),
                "english": (
                    "CRITICAL SCRIPT LANGUAGE INSTRUCTION:\n"
                    "- Write the spoken dialogue lines in punchy, direct-response English with tension and economical dialogue (Tarantino/Wilder style)."
                ),
            }
            lang_prompt = lang_instructions.get(script_lang, lang_instructions["english"])

            rewrite_system_prompt = (
                "You are an elite direct-response short-form scriptwriter with Quentin Tarantino's sense of pacing, "
                "tension, and conversational bite, and Billy Wilder's economical, sharp dialogue. "
                "You write 30-second high-converting social media scripts (Instagram Reels, YouTube Shorts, TikTok) "
                "designed to be filmed on a phone by a solo creator with zero production budget.\n\n"
                "Structure requirements:\n"
                "1. HOOK (0-3s): Tension/curiosity line in the customer's own vernacular that stops the scroll immediately.\n"
                "2. TENSION (3-6s): The contrast, painful statistic, or realization that raises the stakes.\n"
                "3. PROOF (6-20s): 3 rapid beats, each a visual scene + one punchy spoken line, showing the transformation.\n"
                "4. OBJECTION HANDLE (20-25s): Pre-emptively crush the single biggest hesitation or skepticism.\n"
                "5. CTA (25-30s): Clear, urgent, low-friction next step.\n\n"
                "For every beat specify:\n"
                "- Shot Type (e.g. Close-up selfie, Screen record, Rapid cut)\n"
                "- Visual Direction (action on screen)\n"
                "- Spoken Line (spoken aloud in the specified language)\n"
                "- On-Screen Text Overlay (bold caption for sound-off viewers)\n\n"
                "Language must sound spoken, visceral, and authentic—never corporate or like a staged TV ad."
            )

            user_msg = (
                f"REWRITE REQUEST — 30-SECOND DIRECT-RESPONSE SHORT-VIDEO SCRIPT\n"
                f"NICHE / PRODUCT: {niche or 'General Product'}\n"
                f"TARGETED CUSTOMER GAP: {selected_gap or 'Top market frustration'}\n"
            )
            if offer:
                user_msg += f"CORE OFFER / VALUE PROPOSITION: {offer}\n"
            user_msg += f"SCRIPT LANGUAGE: {script_lang.upper()}\n"

            if existing_script:
                user_msg += (
                    f"\nCURRENT SCRIPT TO REWRITE (DO NOT REPEAT THIS HOOK OR ANGLE):\n"
                    f"\"\"\"\n{existing_script[:800]}\n\"\"\"\n"
                    f"Create a COMPLETELY FRESH, alternative hook angle (e.g. if the previous hook was a negative question, use a contrarian statement, a 'stop doing this' pattern interrupt, or an insider reveal).\n"
                )

            if custom_instructions:
                user_msg += f"\nSPECIFIC CREATIVE DIRECTION FROM USER: {custom_instructions}\n"

            user_msg += f"\n{lang_prompt}\n\nExecute the rewritten 30-second script now with full beat breakdown."

            try:
                client = genai.Client(api_key=api_key)
                config_direct = types.GenerateContentConfig(
                    system_instruction=rewrite_system_prompt,
                )
                raw_text, used_model = ad_analyzer._call_with_fallback(client, [user_msg], config_direct)

                self._send_json(200, {
                    "success": True,
                    "script": raw_text,
                    "model": used_model,
                    "scriptLanguage": script_lang,
                })
                return
            except Exception as e:
                err_str = str(e)
                self._send_json(500, {"error": f"Failed rewriting script: {err_str}", "details": err_str})
                return

        if parsed.path == "/api/insta-audit":
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

            raw_input = payload.get("url", "").strip()
            if not raw_input:
                self._send_json(400, {"error": "Instagram profile URL or username handle is required."})
                return

            # Clean and normalize handle & URL
            clean_url = raw_input
            clean_handle = raw_input
            if "instagram.com/" in clean_url:
                try:
                    parts = clean_url.split("instagram.com/")[1].split("/")[0].split("?")[0]
                    clean_handle = "@" + parts.lstrip("@")
                    clean_url = f"https://www.instagram.com/{parts.lstrip('@')}/"
                except Exception:
                    clean_handle = raw_input
            else:
                stripped = raw_input.lstrip("@").strip()
                clean_handle = "@" + stripped
                clean_url = f"https://www.instagram.com/{stripped}/"

            user_query = (
                f"Analyze this Instagram profile: {clean_url} (Username / Handle: {clean_handle})\n\n"
                "Search Google, public Instagram discussions, reels indexes, and social databases to perform a complete 5-stage competitive audit strictly following these requirements:\n"
                "1. Identify what content formats they use (reels, carousels, static posts) and which ones seem to perform best based on visible engagement signals.\n"
                "2. Pull out 5-10 of their best-performing recent posts/reels and identify common patterns: hooks, topics, tone, posting style, thumbnail/cover style.\n"
                "3. Tell me what's working well (the 'good') and what's weak or inconsistent (the 'bad') — e.g. posting frequency, caption quality, niche focus, engagement-to-follower ratio if visible.\n"
                "4. Identify content gaps: topics or formats in their niche that they haven't covered but competitors/similar accounts have.\n"
                "5. Based on all of the above, suggest a content plan/direction I could use to build a similar or better-performing page in the same niche — specific reel ideas, formats, and posting cadence, not generic advice.\n\n"
                "Use their actual top videos as reference points when making suggestions — ground every recommendation in something specific you found on their profile, not generic social media tips."
            )

            try:
                client = genai.Client(api_key=api_key)
                raw_text = None
                used_model = None

                # Attempt search grounding tool first for real-time web intelligence
                try:
                    search_tool = types.Tool(google_search=types.GoogleSearch())
                    config_with_search = types.GenerateContentConfig(
                        system_instruction=INSTA_AUDIT_SYSTEM_INSTRUCTION,
                        tools=[search_tool],
                    )
                    raw_text, used_model = ad_analyzer._call_with_fallback(client, [user_query], config_with_search)
                except Exception as e_search:
                    print(f"Search grounding unavailable for insta audit ({e_search}). Retrying with direct config ...")
                    config_direct = types.GenerateContentConfig(
                        system_instruction=INSTA_AUDIT_SYSTEM_INSTRUCTION,
                    )
                    raw_text, used_model = ad_analyzer._call_with_fallback(client, [user_query], config_direct)

                self._send_json(200, {
                    "success": True,
                    "result": raw_text,
                    "handle": clean_handle,
                    "url": clean_url,
                    "model": used_model,
                })
                return
            except Exception as e:
                err_str = str(e)
                self._send_json(500, {"error": f"Failed analyzing Instagram profile: {err_str}", "details": err_str})
                return

        if parsed.path == "/api/insta-niche-intel":
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
            goal = payload.get("goal", "").strip() or "Find content gaps and build a competitive advantage"
            accounts_data = (payload.get("accountsData") or payload.get("data") or "").strip()

            if not niche:
                self._send_json(400, {"error": "Target niche or industry is required."})
                return
            if not accounts_data:
                self._send_json(400, {"error": "Competitor accounts data cannot be empty."})
                return

            user_query = (
                f"You're acting as a social media strategist doing competitive intelligence on Instagram for the [{niche}] niche. "
                f"My goal is: {goal}\n\n"
                f"Below is data I've collected on competitor accounts in this niche:\n"
                f"--- BEGIN COMPETITIVE DATA ---\n"
                f"{accounts_data}\n"
                f"--- END COMPETITIVE DATA ---\n\n"
                "Analyze this and give me the complete 7-stage competitive intelligence breakdown and Executive Summary strictly following all instructions."
            )

            try:
                client = genai.Client(api_key=api_key)
                raw_text = None
                used_model = None

                # Attempt search grounding tool first for supplemental real-time context
                try:
                    search_tool = types.Tool(google_search=types.GoogleSearch())
                    config_with_search = types.GenerateContentConfig(
                        system_instruction=INSTA_NICHE_INTEL_SYSTEM_INSTRUCTION,
                        tools=[search_tool],
                    )
                    raw_text, used_model = ad_analyzer._call_with_fallback(client, [user_query], config_with_search)
                except Exception as e_search:
                    print(f"Search grounding unavailable for niche intel ({e_search}). Retrying with direct config ...")
                    config_direct = types.GenerateContentConfig(
                        system_instruction=INSTA_NICHE_INTEL_SYSTEM_INSTRUCTION,
                    )
                    raw_text, used_model = ad_analyzer._call_with_fallback(client, [user_query], config_direct)

                self._send_json(200, {
                    "success": True,
                    "result": raw_text,
                    "niche": niche,
                    "goal": goal,
                    "model": used_model,
                })
                return
            except Exception as e:
                err_str = str(e)
                self._send_json(500, {"error": f"Failed running Niche Competitive Intelligence: {err_str}", "details": err_str})
                return

        if parsed.path == "/api/insta-niche-intel/discover":
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
            goal = payload.get("goal", "").strip()
            country = payload.get("country", "").strip()
            state = payload.get("state", "").strip()
            custom_location = payload.get("custom_location", "").strip()

            if not niche:
                self._send_json(400, {"error": "Target niche or industry is required to discover accounts."})
                return

            # Construct targeted location string
            location_parts = []
            if custom_location:
                location_parts.append(custom_location)
            else:
                if state and state not in ("All States / Nationwide", "All Regions", "All Provinces", "All Emirates", "All States", "All Regions / Worldwide"):
                    location_parts.append(state)
                if country and country not in ("Global", "Global / Worldwide (All Locations)", "Global / Worldwide (Any Location)"):
                    location_parts.append(country)

            location_str = ", ".join(location_parts) if location_parts else "Global / Worldwide"

            user_query = f"TARGET NICHE / INDUSTRY: {niche}\n"
            user_query += f"TARGET GEOGRAPHY / LOCATION: {location_str}\n"
            if goal:
                user_query += f"STRATEGIC GOAL: {goal}\n"
            user_query = f"TARGET NICHE / INDUSTRY: {niche}\n"
            user_query += f"TARGET GEOGRAPHY / LOCATION: {location_str}\n"
            if goal:
                user_query += f"STRATEGIC GOAL: {goal}\n"
            user_query += (
                f"Execute targeted Google Search queries to discover 6 to 10 REAL, LIVE, ACTIVE Instagram accounts:\n"
                f"1. Search 'site:instagram.com {niche} {location_str}' and 'top instagram creators in {niche} {location_str}'.\n"
                f"2. Extract the exact public handle from the real 'instagram.com/<handle>' URLs in search results.\n"
                f"3. CRITICAL ANTI-404 INSTRUCTION: Do NOT guess handles, and do NOT fabricate suffixes like '_official', '_app', '_hq', '_co' unless that is the exact live handle on Instagram. If an entity only exists on LinkedIn or Twitter, omit them and choose active Instagram creators.\n"
                f"4. Format the output strictly inside a ```json ... ``` code block matching the schema."
            )

            try:
                client = genai.Client(api_key=api_key)
                raw_text = None
                used_model = None

                # Search Grounding: NOTE - do NOT set response_mime_type="application/json" with google_search tool
                # as Gemini API rejects or fails when search grounding is mixed with strict JSON mime types.
                try:
                    search_tool = types.Tool(google_search=types.GoogleSearch())
                    config_with_search = types.GenerateContentConfig(
                        system_instruction=DISCOVER_ACCOUNTS_SYSTEM_INSTRUCTION,
                        tools=[search_tool],
                    )
                    raw_text, used_model = ad_analyzer._call_with_fallback(client, [user_query], config_with_search)
                except Exception as e_search:
                    print(f"Search grounding unavailable for discover accounts ({e_search}). Retrying with direct knowledge ...")
                    config_direct = types.GenerateContentConfig(
                        system_instruction=DISCOVER_ACCOUNTS_SYSTEM_INSTRUCTION,
                    )
                    raw_text, used_model = ad_analyzer._call_with_fallback(client, [user_query], config_direct)

                # Parse JSON with multi-layered extraction
                parsed_data = None
                try:
                    parsed_data = ad_analyzer.extract_json(raw_text)
                except Exception:
                    # Markdown code fence regex match
                    m_fence = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw_text, re.DOTALL)
                    if m_fence:
                        try:
                            parsed_data = json.loads(m_fence.group(1))
                        except Exception:
                            pass
                    if not parsed_data:
                        m_brace = re.search(r"(\{.*\})", raw_text, re.DOTALL)
                        if m_brace:
                            try:
                                parsed_data = json.loads(m_brace.group(1))
                            except Exception:
                                pass

                accounts_raw = []
                if isinstance(parsed_data, dict):
                    accounts_raw = parsed_data.get("accounts", [])
                elif isinstance(parsed_data, list):
                    accounts_raw = parsed_data

                # Sanitize and verify handles with strict Instagram username specification (alphanumeric, dot, underscore only)
                clean_accounts = []
                seen_handles = set()
                for acc in accounts_raw:
                    if not isinstance(acc, dict):
                        continue
                    handle_raw = str(acc.get("handle", "")).strip()
                    if not handle_raw:
                        continue

                    # Strip URL prefixes, query parameters, trailing slashes, and path elements
                    clean_raw = re.sub(r"https?://(?:www\.)?instagram\.com/", "", handle_raw).strip()
                    clean_raw = clean_raw.split("?")[0].split("/")[0].split("&")[0].strip()

                    # Extract the pure username token (alphanumeric, dot, underscore, 1-30 chars)
                    m_user = re.search(r"@?([a-zA-Z0-9._]{1,30})", clean_raw)
                    if not m_user:
                        continue

                    clean_username = m_user.group(1).strip("._")
                    if not clean_username or len(clean_username) < 2:
                        continue

                    # Filter out obvious fake placeholders
                    if clean_username.lower() in ("example", "handle", "creator", "placeholder", "yourbrand", "yourhandle", "profile", "user", "instagram", "explore"):
                        continue

                    full_handle = f"@{clean_username}"
                    if full_handle.lower() in seen_handles:
                        continue
                    seen_handles.add(full_handle.lower())

                    creator_name = acc.get("name") or clean_username
                    acc["handle"] = full_handle
                    acc["instagram_url"] = f"https://www.instagram.com/{clean_username}/"
                    acc["instagram_search_url"] = f"https://www.instagram.com/explore/search/keyword/?q={urllib.parse.quote_plus(creator_name)}"
                    acc["google_search_url"] = f"https://www.google.com/search?q={urllib.parse.quote_plus('site:instagram.com ' + creator_name + ' ' + full_handle)}"
                    if not acc.get("location"):
                        acc["location"] = location_str
                    clean_accounts.append(acc)

                # If fewer than 3 accounts were found, run a focused secondary fallback to guarantee rich results
                if len(clean_accounts) < 3:
                    print(f"Only {len(clean_accounts)} accounts parsed from search; triggering high-authority fallback query ...")
                    direct_prompt = (
                        f"Provide 6 to 8 of the most famous, verified, and universally recognized real Instagram creator and brand accounts "
                        f"in the '{niche}' space for {location_str}. "
                        f"Output ONLY a valid JSON object in a ```json ``` code block following the exact schema with authentic @handles."
                    )
                    config_fallback = types.GenerateContentConfig(
                        system_instruction=DISCOVER_ACCOUNTS_SYSTEM_INSTRUCTION,
                    )
                    fallback_text, _ = ad_analyzer._call_with_fallback(client, [direct_prompt], config_fallback)
                    try:
                        fallback_json = ad_analyzer.extract_json(fallback_text)
                        fb_accounts = fallback_json.get("accounts", []) if isinstance(fallback_json, dict) else []
                        for acc in fb_accounts:
                            if not isinstance(acc, dict):
                                continue
                            raw_u = str(acc.get("handle", "")).strip()
                            clean_raw = re.sub(r"https?://(?:www\.)?instagram\.com/", "", raw_u).strip()
                            clean_raw = clean_raw.split("?")[0].split("/")[0].split("&")[0].strip()
                            m_fb = re.search(r"@?([a-zA-Z0-9._]{1,30})", clean_raw)
                            if not m_fb:
                                continue
                            u = m_fb.group(1).strip("._")
                            if not u or len(u) < 2 or u.lower() in ("example", "placeholder"):
                                continue
                            fh = f"@{u}"
                            if fh.lower() not in seen_handles:
                                seen_handles.add(fh.lower())
                                c_name = acc.get("name") or u
                                acc["handle"] = fh
                                acc["instagram_url"] = f"https://www.instagram.com/{u}/"
                                acc["instagram_search_url"] = f"https://www.instagram.com/explore/search/keyword/?q={urllib.parse.quote_plus(c_name)}"
                                acc["google_search_url"] = f"https://www.google.com/search?q={urllib.parse.quote_plus('site:instagram.com ' + c_name + ' ' + fh)}"
                                if not acc.get("location"):
                                    acc["location"] = location_str
                                clean_accounts.append(acc)
                    except Exception as e_fb:
                        print(f"Fallback parse notice: {e_fb}")

                self._send_json(200, {
                    "success": True,
                    "niche": niche,
                    "location": location_str,
                    "accounts": clean_accounts,
                    "model": used_model,
                })
                return
            except Exception as e:
                err_str = str(e)
                self._send_json(500, {"error": f"Failed discovering high-performing accounts: {err_str}", "details": err_str})
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
