import httpx
import os
import re
import logging

logger = logging.getLogger(__name__)

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = "mistralai/mistral-7b-instruct-v0.1"


def _api_key():
    return os.getenv("OPENROUTER_API_KEY", "")


def estimate_hours(assignment_name: str, description: str, points: float) -> tuple[float | None, str]:
    """
    Returns (hours, error_message). hours is None on failure.
    """
    key = _api_key()
    if not key:
        return None, "OPENROUTER_API_KEY is not set"

    prompt = (
        "You are an academic assistant. Estimate how many hours a typical college student "
        "would need to complete this assignment. Respond with ONLY a number (decimal allowed, e.g. 2.5).\n\n"
        f"Assignment: {assignment_name}\n"
        f"Points: {points}\n"
        f"Description: {description[:1000] if description else 'No description provided.'}"
    )
    try:
        with httpx.Client(timeout=30) as client:
            resp = client.post(
                OPENROUTER_URL,
                headers={
                    "Authorization": f"Bearer {key}",
                    "HTTP-Referer": "https://canvas-dashboard.local",
                    "X-Title": "Canvas Student Dashboard",
                },
                json={
                    "model": MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 16,
                    "temperature": 0.2,
                },
            )
            resp.raise_for_status()
            data = resp.json()

            # OpenRouter may return an error body with HTTP 200
            if "error" in data:
                return None, f"OpenRouter error: {data['error'].get('message', data['error'])}"

            content = data["choices"][0]["message"]["content"].strip()
            match = re.search(r"\d+(\.\d+)?", content)
            if match:
                return float(match.group()), ""
            return None, f"Could not parse number from response: {content!r}"

    except httpx.HTTPStatusError as exc:
        return None, f"HTTP {exc.response.status_code}: {exc.response.text[:200]}"
    except Exception as exc:
        return None, str(exc)


def test_connection() -> dict:
    hours, err = estimate_hours("Short quiz", "Answer 5 multiple choice questions.", 10)
    return {"ok": hours is not None, "hours": hours, "error": err}
