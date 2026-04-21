import httpx
import os
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

URGENCY_EMOJI = {
    "alert_active": "🟠",
    "within_24h":   "🟡",
    "within_72h":   "🔵",
}


def _creds():
    token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    chat_id = os.getenv("TELEGRAM_CHAT_ID", "")
    return token, chat_id


def _send(text: str) -> tuple[bool, str]:
    token, chat_id = _creds()
    if not token or not chat_id:
        return False, "TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set"
    try:
        resp = httpx.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={"chat_id": chat_id, "text": text, "parse_mode": "HTML"},
            timeout=10,
        )
        resp.raise_for_status()
        return True, ""
    except httpx.HTTPStatusError as exc:
        msg = f"HTTP {exc.response.status_code}: {exc.response.text[:200]}"
        logger.error("Telegram send failed: %s", msg)
        return False, msg
    except Exception as exc:
        logger.error("Telegram send exception: %s", exc)
        return False, str(exc)


def send_alert(assignment: dict, urgency: str) -> tuple[bool, str]:
    emoji = URGENCY_EMOJI.get(urgency, "📌")
    due_str = assignment.get("due_at", "")
    try:
        due = datetime.fromisoformat(due_str.replace("Z", "+00:00"))
        due_fmt = due.strftime("%a %b %-d at %-I:%M %p")
    except Exception:
        due_fmt = due_str or "No due date"

    hours = assignment.get("estimated_hours")
    from backend.openrouter_client import _parse_duration

    def fmt_hours(h):
        if h is None:
            return "Unknown"
        total_s = round(h * 3600)
        hh = total_s // 3600
        mm = (total_s % 3600) // 60
        return f"{hh}h{mm}m"

    text = (
        f"{emoji} <b>Canvas Alert</b>\n"
        f"<b>{assignment['name']}</b>\n"
        f"📚 {assignment['course_name']}\n"
        f"📅 Due: {due_fmt}\n"
        f"⏱ Estimated: {fmt_hours(hours)}"
    )
    return _send(text)


def send_test() -> tuple[bool, str]:
    return _send("✅ <b>Canvas Dashboard</b>\nTelegram notifications are working!")
