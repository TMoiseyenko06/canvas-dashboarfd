import httpx
import os
import re
import logging

logger = logging.getLogger(__name__)

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = "mistralai/mistral-7b-instruct-v0.1"


def _api_key():
    return os.getenv("OPENROUTER_API_KEY", "")


def _parse_duration(text: str) -> float | None:
    """Parse NhNmNs format (e.g. '2h30m0s') into decimal hours."""
    match = re.fullmatch(r"(\d+)h(\d+)m(\d+)s", text.strip())
    if match:
        h, m, s = int(match.group(1)), int(match.group(2)), int(match.group(3))
        return round(h + m / 60 + s / 3600, 2)
    return None


def estimate_hours(assignment_name: str, description: str, points: float) -> tuple[float | None, str]:
    key = _api_key()
    if not key:
        return None, "OPENROUTER_API_KEY is not set"

    prompt = (
        "You are an academic assistant. Estimate how many hours a typical college student "
        "would need to complete this assignment.\n"
        "RULES:\n"
        "- Reply with ONLY a duration in the format: NhNmNs\n"
        "- N must be a non-negative integer, no spaces, no other text\n"
        "- Examples of valid replies: 2h0m0s   0h45m0s   1h30m0s\n"
        "- Do NOT write anything else — not a word, not a period, nothing\n\n"
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
                    "max_tokens": 16,
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

            hours = _parse_duration(content)
            if hours is not None:
                return hours, ""

            msg = f"Unexpected format: {content!r}"
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
                    "messages": [{
                        "role": "user",
                        "content": (
                            "Reply with ONLY a duration in the format NhNmNs (e.g. 2h30m0s). "
                            "No other text. Estimate: a short 10-question quiz."
                        ),
                    }],
                    "max_tokens": 16,
                    "temperature": 0.1,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            content = (data.get("choices", [{}])[0]
                       .get("message", {})
                       .get("content") or "").strip()
            hours = _parse_duration(content)
            return {
                "ok": hours is not None,
                "raw_content": content,
                "parsed_hours": hours,
                "model": MODEL,
            }
    except Exception as exc:
        return {"ok": False, "error": str(exc)}
