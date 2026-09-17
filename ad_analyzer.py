#!/usr/bin/env python3
"""
Ad Analyzer: A personal CLI tool to analyze advertisements and landing pages.
Takes an image path (screenshot) or landing page URL, calls the Gemini API,
parses a structured strategy breakdown, prints it to the console, and appends
the result to ad_log.csv.
"""

import csv
import json
import mimetypes
import os
import re
import sys
from datetime import datetime

import requests
from bs4 import BeautifulSoup
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
                    if key and key not in os.environ:
                        os.environ[key] = val

_load_dotenv()

MODEL_NAME = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
CSV_FILENAME = "ad_log.csv"

CSV_HEADERS = [
    "timestamp",
    "source",
    "hook",
    "offer",
    "cta",
    "proof_elements",
    "price_shown",
    "creative_format",
    "audience",
    "positioning",
    "psychological_angle",
    "awareness_level",
    "notes",
]

SCHEMA_TEMPLATE = """{
  "observed": {
    "hook": "",
    "offer": "",
    "cta": "",
    "proof_elements": [],
    "price_shown": "",
    "creative_format": ""
  },
  "inference": {
    "audience": "",
    "positioning": "",
    "psychological_angle": "",
    "awareness_level": ""
  },
  "notes": ""
}"""

SYSTEM_INSTRUCTION = f"""You are an advertising strategist analyzing an ad or landing page.
Your task is to analyze the content and return a structured JSON breakdown of the ad's strategy.

Strict Schema:
{SCHEMA_TEMPLATE}

Rules:
1. "observed" fields must ONLY contain what is literally stated or visibly shown in the ad.
   If something isn't present, leave it as an empty string ("") or empty list ([]) — do NOT guess or assume.
2. "inference" fields are your best-guess strategic interpretations, clearly based on visible cues.
3. Never claim to know whether the ad is successful, its conversion rate, or its ad spend — you have no access to that data.
   If commenting on effectiveness, phrase it strictly as a hypothesis about mechanism, not a performance claim.
4. Return ONLY valid JSON matching the exact schema above.
   Do not include markdown fences (no ```json), commentary, or text before/after the JSON.
"""


# ---------------------------------------------------------------------------
# Input Preparation & Video Extraction
# ---------------------------------------------------------------------------
def is_url(target: str) -> bool:
    """Return True if target starts with http:// or https://."""
    lower = target.lower()
    return lower.startswith("http://") or lower.startswith("https://")


def is_video_url(target: str) -> bool:
    """Return True if target is a YouTube, Instagram, TikTok, or direct video URL."""
    if not is_url(target):
        return False
    lower = target.lower()
    video_indicators = [
        "youtube.com", "youtu.be",
        "instagram.com/reel", "instagram.com/p", "instagram.com/tv", "instagram.com/share", "instagr.am",
        "tiktok.com",
        ".mp4", ".mov", ".webm"
    ]
    return any(indicator in lower for indicator in video_indicators)


def is_video_file(target: str) -> bool:
    """Return True if target is a local video file."""
    ext = os.path.splitext(target)[1].lower()
    return ext in [".mp4", ".mov", ".webm", ".m4v", ".avi", ".mkv"]


def download_video_clip(url: str, output_dir: str = None) -> str:
    """Download a video ad using yt-dlp, returning the path to the downloaded MP4."""
    import tempfile
    import yt_dlp

    if not output_dir:
        output_dir = tempfile.mkdtemp(prefix="ad_video_")

    out_template = os.path.join(output_dir, "%(id)s.%(ext)s")
    ydl_opts = {
        "format": "best[ext=mp4]/best",
        "outtmpl": out_template,
        "quiet": True,
        "no_warnings": True,
        "max_filesize": 50 * 1024 * 1024,  # 50MB max
    }

    print(f"Downloading video from {url} ...")
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        filename = ydl.prepare_filename(info)

        base, _ = os.path.splitext(filename)
        for ext in [".mp4", ".webm", ".mkv", ".mov"]:
            candidate = base + ext
            if os.path.isfile(candidate):
                return candidate
        if os.path.isfile(filename):
            return filename

        raise FileNotFoundError(f"Downloaded video file not found for {url}")


def fetch_url_text(url: str) -> str:
    """Fetch text content of a web page using requests and BeautifulSoup."""
    print(f"Fetching URL content: {url} ...")
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        )
    }
    response = requests.get(url, headers=headers, timeout=15)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")

    # Remove non-content tags
    for tag in soup(["script", "style", "noscript", "svg", "header", "footer", "nav"]):
        tag.decompose()

    text = soup.get_text(separator="\n", strip=True)
    # Clean multiple consecutive blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)

    # Truncate if overly long while keeping ample context
    max_chars = 25000
    if len(text) > max_chars:
        text = text[:max_chars] + "\n...[Content truncated for length]..."

    if not text.strip():
        raise ValueError(f"Could not extract meaningful text from URL: {url}")

    return text


def load_image_part(file_path: str) -> types.Part:
    """Load an image file and return a Gemini types.Part object."""
    if not os.path.isfile(file_path):
        raise FileNotFoundError(f"Image file not found: {file_path}")

    mime_type, _ = mimetypes.guess_type(file_path)
    if not mime_type or not mime_type.startswith("image/"):
        # Fallback based on extension
        ext = os.path.splitext(file_path)[1].lower()
        ext_map = {
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".webp": "image/webp",
            ".gif": "image/gif",
        }
        mime_type = ext_map.get(ext, "image/jpeg")

    print(f"Loading image: {file_path} (detected MIME: {mime_type}) ...")
    with open(file_path, "rb") as f:
        data = f.read()

    return types.Part.from_bytes(data=data, mime_type=mime_type)


# ---------------------------------------------------------------------------
# Gemini API & Parsing with Resilient Model Fallback
# ---------------------------------------------------------------------------
FALLBACK_MODELS = [
    os.environ.get("GEMINI_MODEL", "gemini-2.5-flash"),
    "gemini-2.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.5-flash",
    "gemini-2.5-flash-lite",
]


def extract_json(raw_text: str) -> dict:
    """Extract and parse JSON from model output, handling potential markdown fences."""
    text = raw_text.strip()

    # Strip code fences if present
    if text.startswith("```"):
        lines = text.splitlines()
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Regex search for the outermost {...}
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            return json.loads(match.group(0))
        raise


def _call_with_fallback(client: genai.Client, contents: list, config: types.GenerateContentConfig) -> tuple[str, str]:
    """
    Call Gemini with automatic model fallback and intelligent quota handling.
    Returns (raw_text, successful_model_name).
    """
    seen = set()
    models_to_try = []
    for m in FALLBACK_MODELS:
        if m and m not in seen:
            seen.add(m)
            models_to_try.append(m)

    last_error = None
    rate_limit_error = None
    import time

    for model_name in models_to_try:
        try:
            print(f"Calling Gemini API with model '{model_name}' ...")
            response = client.models.generate_content(
                model=model_name,
                contents=contents,
                config=config,
            )
            return response.text or "", model_name
        except Exception as e:
            last_error = e
            err_str = str(e).lower()

            # If project daily quota is exhausted, no model under this project will succeed today
            if any(k in err_str for k in ["per day", "daily", "rpd", "requests per day"]):
                print(f"Project daily request quota exhausted on '{model_name}': {e}")
                raise e

            # Keep track of rate limit errors so they don't get obscured by subsequent 404s
            if "429" in err_str or "quota" in err_str or "resource_exhausted" in err_str:
                rate_limit_error = e

            # If 503 (temporary high demand surge), retry this model once after 2 seconds
            if "503" in err_str or "unavailable" in err_str or "high demand" in err_str:
                print(f"Temporary 503 high demand on '{model_name}'. Retrying once in 2s ...")
                time.sleep(2)
                try:
                    response = client.models.generate_content(
                        model=model_name,
                        contents=contents,
                        config=config,
                    )
                    return response.text or "", model_name
                except Exception as e2:
                    last_error = e2
                    print(f"Retry on '{model_name}' failed: {e2}. Hopping to next fallback model ...")
                    continue

            # If 404 or 429: immediately hop to next fallback model
            print(f"Issue on '{model_name}': {e}. Hopping to next model ...")
            continue

    # If any rate limit error was encountered, prefer raising it over downstream 404s
    if rate_limit_error:
        raise rate_limit_error

    # If all models failed, raise the last exception
    raise last_error


def analyze_ad(client: genai.Client, contents: list) -> tuple[dict | None, str]:
    """
    Call the Gemini API with the ad content and parse JSON response.
    Retries once with a stricter reminder if initial parsing fails.
    Returns (parsed_dict, raw_response_text).
    """
    config = types.GenerateContentConfig(
        system_instruction=SYSTEM_INSTRUCTION,
        response_mime_type="application/json",
    )

    raw_text, used_model = _call_with_fallback(client, contents, config)

    # Attempt 1: Parse output
    try:
        data = extract_json(raw_text)
        if isinstance(data, dict) and "observed" in data and "inference" in data:
            return data, raw_text
    except Exception as e:
        print(f"Initial JSON parse failed: {e}. Retrying with strict JSON prompt ...")

    # Attempt 2: Retry with stricter reminder
    retry_prompt = (
        "CRITICAL: Your previous output was not valid JSON or was incomplete. "
        "Output ONLY raw JSON matching the required schema. "
        "Do NOT include markdown fences, comments, or extra text."
    )
    retry_contents = list(contents) + [retry_prompt]

    try:
        retry_text, _ = _call_with_fallback(client, retry_contents, config)
        data = extract_json(retry_text)
        if isinstance(data, dict) and "observed" in data and "inference" in data:
            return data, retry_text
        return None, retry_text
    except Exception as e:
        print(f"Retry JSON parse also failed: {e}")
        return None, raw_text


def analyze_video_ad(client: genai.Client, video_path: str) -> tuple[dict | None, str]:
    """Upload a video file to Gemini Files API and analyze its strategy."""
    import time
    if not os.path.isfile(video_path):
        raise FileNotFoundError(f"Video file not found: {video_path}")

    print(f"Uploading video {video_path} to Gemini Files API ...")
    uploaded_file = client.files.upload(file=video_path)

    print(f"Processing video with Gemini (file: {uploaded_file.name}) ...")
    while uploaded_file.state.name == "PROCESSING":
        time.sleep(2)
        uploaded_file = client.files.get(name=uploaded_file.name)

    if uploaded_file.state.name == "FAILED":
        raise ValueError(f"Gemini video processing failed: {uploaded_file.error}")

    prompt = (
        "You are an expert video advertising strategist. Analyze this video ad comprehensively.\n"
        "Pay special attention to:\n"
        "1. The 0-3 second hook (visual pattern interrupt + opening verbal/text hook).\n"
        "2. The creative format (e.g. UGC, talking head, product demo, split screen, b-roll montage).\n"
        "3. The offer, proof elements, and call to action.\n"
        "4. Inferred target audience, positioning, psychological angle, and buyer awareness level.\n\n"
        "Strictly adhere to the JSON schema and rules provided in the system instructions."
    )

    contents = [prompt, uploaded_file]
    try:
        data, raw_text = analyze_ad(client, contents)
        return data, raw_text
    finally:
        try:
            client.files.delete(name=uploaded_file.name)
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Logging & Display
# ---------------------------------------------------------------------------
def append_to_csv(row: dict, csv_file: str = CSV_FILENAME) -> None:
    """Append a dictionary row to the CSV file, creating headers if the file is new."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(script_dir, csv_file)

    file_exists = os.path.isfile(csv_path) and os.path.getsize(csv_path) > 0

    with open(csv_path, mode="a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_HEADERS)
        if not file_exists:
            writer.writeheader()
        writer.writerow(row)

    print(f"\n[Logged] Analysis saved to: {csv_path}")


def print_breakdown(data: dict, source: str, timestamp: str) -> None:
    """Print a clean, formatted breakdown to the terminal."""
    observed = data.get("observed", {})
    inference = data.get("inference", {})
    notes = data.get("notes", "")

    proof_list = observed.get("proof_elements", [])
    if isinstance(proof_list, list):
        proof_str = "; ".join(str(p).strip() for p in proof_list if p)
    else:
        proof_str = str(proof_list or "")

    print("\n" + "=" * 65)
    print(" AD ANALYZER BREAKDOWN")
    print("=" * 65)
    print(f"Source:    {source}")
    print(f"Timestamp: {timestamp}")
    print("-" * 65)
    print("OBSERVED (Literally stated or visibly shown in ad):")
    print(f"  • Hook:            {observed.get('hook', '') or '(None)'}")
    print(f"  • Offer:           {observed.get('offer', '') or '(None)'}")
    print(f"  • CTA:             {observed.get('cta', '') or '(None)'}")
    print(f"  • Proof Elements:  {proof_str or '(None)'}")
    print(f"  • Price Shown:     {observed.get('price_shown', '') or '(None)'}")
    print(f"  • Creative Format: {observed.get('creative_format', '') or '(None)'}")
    print("-" * 65)
    print("INFERENCE (Strategic interpretation - best guess):")
    print(f"  • Audience:            {inference.get('audience', '') or '(None)'}")
    print(f"  • Positioning:         {inference.get('positioning', '') or '(None)'}")
    print(f"  • Psychological Angle: {inference.get('psychological_angle', '') or '(None)'}")
    print(f"  • Awareness Level:     {inference.get('awareness_level', '') or '(None)'}")
    print("-" * 65)
    print(f"NOTES: {notes or '(None)'}")
    print("=" * 65)


# ---------------------------------------------------------------------------
# Main Routine
# ---------------------------------------------------------------------------
def main():
    if len(sys.argv) < 2:
        print("Usage: python ad_analyzer.py <image_path_or_video_url_or_landing_page>")
        print("\nExamples:")
        print("  python ad_analyzer.py screenshot.png")
        print("  python ad_analyzer.py https://www.instagram.com/reel/C2.../")
        print("  python ad_analyzer.py https://www.youtube.com/shorts/...")
        print("  python ad_analyzer.py https://example.com/landing-page")
        sys.exit(1)

    target_input = sys.argv[1].strip()

    # Check for GEMINI_API_KEY
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("\n[Error] GEMINI_API_KEY environment variable is not set.", file=sys.stderr)
        print("Please set your Gemini API key before running Ad Analyzer:", file=sys.stderr)
        print("  Windows PowerShell: $env:GEMINI_API_KEY=\"your-api-key-here\"", file=sys.stderr)
        print("  Windows CMD:        set GEMINI_API_KEY=your-api-key-here", file=sys.stderr)
        print("  macOS / Linux:      export GEMINI_API_KEY=\"your-api-key-here\"", file=sys.stderr)
        print("Get a free API key at: https://aistudio.google.com\n", file=sys.stderr)
        sys.exit(1)

    # Initialize Gemini client
    client = genai.Client(api_key=api_key)
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    data = None
    raw_response = ""
    temp_video_cleanup = None

    try:
        if is_video_url(target_input):
            print(f"Detected video ad URL: {target_input}")
            temp_video_cleanup = download_video_clip(target_input)
            data, raw_response = analyze_video_ad(client, temp_video_cleanup)
        elif is_video_file(target_input):
            print(f"Detected local video file: {target_input}")
            data, raw_response = analyze_video_ad(client, target_input)
        elif is_url(target_input):
            page_text = fetch_url_text(target_input)
            prompt = (
                f"Analyze the following landing page text according to the system instructions:\n\n"
                f"--- BEGIN LANDING PAGE TEXT ---\n{page_text}\n--- END LANDING PAGE TEXT ---"
            )
            data, raw_response = analyze_ad(client, [prompt])
        else:
            image_part = load_image_part(target_input)
            prompt = "Analyze this advertisement image according to the system instructions."
            data, raw_response = analyze_ad(client, [prompt, image_part])
    except Exception as e:
        print(f"[Error] Failed analyzing target '{target_input}': {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        if temp_video_cleanup and os.path.isfile(temp_video_cleanup):
            try:
                os.remove(temp_video_cleanup)
            except Exception:
                pass

    if data:
        # Successful parse
        print_breakdown(data, target_input, timestamp)

        observed = data.get("observed", {})
        inference = data.get("inference", {})
        proof_list = observed.get("proof_elements", [])
        if isinstance(proof_list, list):
            proof_str = "; ".join(str(p).strip() for p in proof_list if p)
        else:
            proof_str = str(proof_list or "")

        row = {
            "timestamp": timestamp,
            "source": target_input,
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
        append_to_csv(row)
    else:
        # Failed to parse JSON after retry — log raw text with error flag without crashing
        print("\n" + "!" * 65)
        print("WARNING: Could not parse Gemini response as valid JSON.")
        print("Raw response will be saved to ad_log.csv with an error flag.")
        print("!" * 65)
        print(f"\nRaw response:\n{raw_response}\n")

        error_row = {
            "timestamp": timestamp,
            "source": target_input,
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
        append_to_csv(error_row)


if __name__ == "__main__":
    main()
