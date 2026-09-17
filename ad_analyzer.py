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

MODEL_NAME = os.environ.get("GEMINI_MODEL", "gemini-3.8-flash")
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
# Input Preparation
# ---------------------------------------------------------------------------
def is_url(target: str) -> bool:
    """Return True if target starts with http:// or https://."""
    lower = target.lower()
    return lower.startswith("http://") or lower.startswith("https://")


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
# Gemini API & Parsing
# ---------------------------------------------------------------------------
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

    print(f"Analyzing ad with model '{MODEL_NAME}' ...")
    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=contents,
        config=config,
    )
    raw_text = response.text or ""

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
        retry_response = client.models.generate_content(
            model=MODEL_NAME,
            contents=retry_contents,
            config=config,
        )
        retry_text = retry_response.text or ""
        data = extract_json(retry_text)
        if isinstance(data, dict) and "observed" in data and "inference" in data:
            return data, retry_text
        return None, retry_text
    except Exception as e:
        print(f"Retry JSON parse also failed: {e}")
        return None, raw_text


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
        print("Usage: python ad_analyzer.py <image_path_or_url>")
        print("\nExamples:")
        print("  python ad_analyzer.py screenshot.png")
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

    # Prepare input contents
    contents = []
    if is_url(target_input):
        try:
            page_text = fetch_url_text(target_input)
            prompt = (
                f"Analyze the following landing page text according to the system instructions:\n\n"
                f"--- BEGIN LANDING PAGE TEXT ---\n{page_text}\n--- END LANDING PAGE TEXT ---"
            )
            contents.append(prompt)
        except Exception as e:
            print(f"[Error] Failed to fetch URL '{target_input}': {e}", file=sys.stderr)
            sys.exit(1)
    else:
        try:
            image_part = load_image_part(target_input)
            prompt = "Analyze this advertisement image according to the system instructions."
            contents = [prompt, image_part]
        except Exception as e:
            print(f"[Error] Failed to load image '{target_input}': {e}", file=sys.stderr)
            sys.exit(1)

    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # Call Gemini and parse
    data, raw_response = analyze_ad(client, contents)

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
