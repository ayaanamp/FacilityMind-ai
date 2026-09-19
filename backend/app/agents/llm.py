"""LLM Client interface with Gemini API integration and JSON schema validation."""

import json
import os
import re
from typing import Any

import httpx
from backend.app.core.config import get_settings
from backend.app.core.logging import logging

logger = logging.getLogger("FacilityMind.LLM")
settings = get_settings()


def _clean_json_string(text: str) -> str:
    """Extract and sanitize JSON substring from model output."""
    text = text.strip()
    # Remove markdown code fences if present
    if text.startswith("```"):
        lines = text.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    # Find outermost JSON object
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        return match.group(0)
    return text


class LLMClient:
    """Centralized LLM service with Google Gemini API and structured JSON generation."""

    def __init__(self):
        self.model = settings.DEFAULT_MODEL or "gemini-2.5-flash"

    @property
    def api_key(self) -> str:
        s = get_settings()
        return s.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY", "")

    @property
    def is_available(self) -> bool:
        key = self.api_key
        return bool(key and len(key) > 10)

    async def generate_json(
        self, prompt: str, system_instruction: str = ""
    ) -> dict[str, Any] | None:
        """Call Gemini API and return validated JSON object, or None if unavailable/error."""
        if not self.is_available:
            return None

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"

        contents = []
        if system_instruction:
            contents.append(
                {
                    "role": "user",
                    "parts": [{"text": f"System Context: {system_instruction}\n\nTask: {prompt}"}],
                }
            )
        else:
            contents.append({"role": "user", "parts": [{"text": prompt}]})

        payload = {
            "contents": contents,
            "generationConfig": {
                "responseMimeType": "application/json",
                "temperature": 0.2,
                "topP": 0.9,
            },
        }

        try:
            async with httpx.AsyncClient(timeout=12.0) as client:
                response = await client.post(url, json=payload)
                if response.status_code == 200:
                    data = response.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts:
                            raw_text = parts[0].get("text", "")
                            clean_text = _clean_json_string(raw_text)
                            return json.loads(clean_text)
                else:
                    logger.warning(
                        f"Gemini API returned status {response.status_code}: {response.text}"
                    )
        except Exception as e:
            logger.warning(
                f"Gemini API request failed: {e}. Falling back to deterministic agent engine."
            )

        return None


llm_client = LLMClient()
