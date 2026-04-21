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
    key = _api_key()
    if not key:
        return None, "OPENROUTER_API_KEY is not set"

    prompt = (
        "You are an academic assistant. Estimate how many hours a typical college student "
        "would need to complete this assignment. Respond with ONLY a single number, no words "
        "(e.g. 2 or 2.5).\n\n"
        f"Assignment: {assignment_name}\n"
        f"Points: {points}\n"
        f"Description: {description[:800] if description else 'No description provided.'}"
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
                    "max_tokens": 32,
                    "temperature": 0.1,
                },
            )
            resp.raise_for_status()
            data = resp.json()

            if "error" in data:
                msg = f"OpenRouter error: {data['error'].get('message', data['error'])}"
                logger.warning(msg)
                return None, msg

            content = (data.get("choices", [{}])[0]
                       .get("message", {})
                       .get("content") or "").strip()

            logger.info("OpenRouter response for %r: %r", assignment_name, content)

            match = re.search(r"\d+(\.\d+)?", content)
            if match:
                return float(match.group()), ""

            msg = f"No number in response: {content!r}"
            logger.warning("Parse failed for %r — %s", assignment_name, msg)
            return None, msg

    except httpx.HTTPStatusError as exc:
        msg = f"HTTP {exc.response.status_code}: {exc.response.text[:200]}"
        logger.error(msg)
        return None, msg
    except Exception as exc:
        logger.error("estimate_hours exception: %s", exc)
        return None, str(exc)


def test_connection() -> dict:
    """Sends a trivial prompt and returns the raw response for diagnosis."""
    key = _api_key()
    if not key:
        return {"ok": False, "error": "OPENROUTER_API_KEY is not set"}
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
                    "messages": [{"role": "user", "content": "Respond with only the number 3"}],
                    "max_tokens": 32,
                    "temperature": 0.1,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            content = (data.get("choices", [{}])[0]
                       .get("message", {})
                       .get("content") or "").strip()
            match = re.search(r"\d+(\.\d+)?", content)
            return {
                "ok": match is not None,
                "raw_content": content,
                "parsed_number": float(match.group()) if match else None,
                "model": MODEL,
                "full_response": data,
            }
    except Exception as exc:
        return {"ok": False, "error": str(exc)}
