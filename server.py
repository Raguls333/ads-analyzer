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
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
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
        if parsed.path != "/api/analyze":
            self._send_json(404, {"error": "Not found"})
            return

        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            self._send_json(400, {
                "error": "GEMINI_API_KEY environment variable is not set. Please set it before analyzing."
            })
            return

        content_length = int(self.headers.get("Content-Length", 0))
        post_body = self.rfile.read(content_length)
        try:
            payload = json.loads(post_body.decode("utf-8"))
        except Exception as e:
            self._send_json(400, {"error": f"Invalid JSON payload: {e}"})
            return

        input_type = payload.get("type", "url")
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        try:
            client = genai.Client(api_key=api_key)
            contents = []
            source_display = ""

            if input_type == "url":
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
                contents.append(prompt)

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
                contents = [prompt, part]
            else:
                self._send_json(400, {"error": f"Unknown input type: {input_type}"})
                return

            # Analyze using ad_analyzer engine
            data, raw_response = ad_analyzer.analyze_ad(client, contents)

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
            if "503" in err_str or "unavailable" in err_str.lower() or "high demand" in err_str.lower():
                user_msg = "Google's Gemini API is currently experiencing a temporary demand surge (503 Unavailable). Automatic retries were attempted across Flash models. Please wait 30-60 seconds and try again."
            elif "429" in err_str or "quota" in err_str.lower() or "rate" in err_str.lower():
                user_msg = "Gemini API free tier rate limit reached (429). Please wait a minute and try again."
            else:
                user_msg = err_str
            self._send_json(500, {"error": user_msg})


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
