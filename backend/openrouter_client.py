import httpx
import os
import re


OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = "mistralai/mistral-7b-instruct"


def _api_key():
    return os.getenv("OPENROUTER_API_KEY", "")


def estimate_hours(assignment_name: str, description: str, points: float) -> float | None:
    prompt = (
        f"You are an academic assistant. Estimate how many hours a typical college student "
        f"would need to complete this assignment. Respond with ONLY a number (decimal allowed, e.g. 2.5).\n\n"
        f"Assignment: {assignment_name}\n"
        f"Points: {points}\n"
        f"Description: {description[:1000] if description else 'No description provided.'}"
    )
    try:
        with httpx.Client(timeout=30) as client:
            resp = client.post(
                OPENROUTER_URL,
                headers={
                    "Authorization": f"Bearer {_api_key()}",
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
            content = resp.json()["choices"][0]["message"]["content"].strip()
            match = re.search(r"\d+(\.\d+)?", content)
            if match:
                return float(match.group())
    except Exception:
        pass
    return None
