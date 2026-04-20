import hashlib
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv, set_key
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

load_dotenv(Path(__file__).parent.parent / ".env")

from backend import canvas_client, openrouter_client, database, scheduler
from backend.models import EstimateOverride, SettingsUpdate

app = FastAPI(title="Canvas Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

ENV_PATH = Path(__file__).parent.parent / ".env"

# ── in-memory assignment cache (refreshed by scheduler) ──────────────────────
_assignment_cache: list[dict] = []
_course_cache: list[dict] = []


def _assignment_hash(a: dict) -> str:
    key = f"{a.get('id')}|{a.get('name')}|{a.get('description', '')}|{a.get('points_possible')}"
    return hashlib.md5(key.encode()).hexdigest()


def _strip_html(text: str) -> str:
    if not text:
        return ""
    return re.sub(r"<[^>]+>", " ", text).strip()


def _sync_canvas():
    global _assignment_cache, _course_cache
    try:
        courses = canvas_client.get_courses()
        enriched_courses = []
        all_assignments = []

        for course in courses:
            cid = course["id"]
            cname = course.get("name", f"Course {cid}")

            # grade info lives in enrollments
            grade_info = {"current_grade": None, "current_score": None}
            try:
                enrollments = canvas_client.get_enrollments(cid)
                for e in enrollments:
                    g = e.get("grades", {})
                    grade_info = {
                        "current_grade": g.get("current_grade"),
                        "current_score": g.get("current_score"),
                        "final_grade": g.get("final_grade"),
                        "final_score": g.get("final_score"),
                    }
                    break
            except Exception:
                pass

            # assignment groups (weights)
            groups = []
            try:
                groups = canvas_client.get_assignment_groups(cid)
            except Exception:
                pass

            enriched_courses.append({
                "id": cid,
                "name": cname,
                "course_code": course.get("course_code", ""),
                **grade_info,
                "assignment_groups": [
                    {
                        "id": g["id"],
                        "name": g["name"],
                        "group_weight": g.get("group_weight"),
                    }
                    for g in groups
                ],
            })

            # assignments
            try:
                assignments = canvas_client.get_assignments(cid)
                for a in assignments:
                    sub = a.get("submission") or {}
                    submitted = sub.get("workflow_state") not in (None, "unsubmitted")
                    a_hash = _assignment_hash(a)
                    cached = database.get_estimate(a["id"])
                    override = database.get_override(a["id"])

                    # fetch AI estimate if needed
                    if override:
                        estimated_hours = override["hours"]
                        source = "manual"
                    elif cached and cached["assignment_hash"] == a_hash:
                        estimated_hours = cached["hours"]
                        source = cached.get("source", "ai")
                    else:
                        hours = openrouter_client.estimate_hours(
                            a.get("name", ""),
                            _strip_html(a.get("description", "")),
                            a.get("points_possible") or 0,
                        )
                        estimated_hours = hours
                        source = "ai" if hours is not None else "unknown"
                        database.set_estimate(a["id"], hours, a_hash, source)

                    all_assignments.append({
                        "id": a["id"],
                        "course_id": cid,
                        "course_name": cname,
                        "name": a.get("name", ""),
                        "description": _strip_html(a.get("description", "")),
                        "due_at": a.get("due_at"),
                        "points_possible": a.get("points_possible"),
                        "submitted": submitted,
                        "submission_state": sub.get("workflow_state"),
                        "estimated_hours": estimated_hours,
                        "estimate_source": source,
                        "html_url": a.get("html_url", ""),
                    })
            except Exception as exc:
                pass

        _course_cache = enriched_courses
        _assignment_cache = all_assignments
    except Exception as exc:
        pass


def _get_wiggle():
    db_val = database.get_setting("wiggle_room_hours")
    if db_val is not None:
        return float(db_val)
    return float(os.getenv("WIGGLE_ROOM_HOURS", "2"))


@app.on_event("startup")
def startup():
    database.init_db()
    load_dotenv(ENV_PATH, override=True)
    _sync_canvas()
    scheduler.start_scheduler(_sync_canvas)


@app.on_event("shutdown")
def shutdown():
    scheduler.stop_scheduler()


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/api/courses")
def get_courses():
    return _course_cache


@app.get("/api/assignments")
def get_assignments():
    return _assignment_cache


@app.get("/api/alerts")
def get_alerts():
    wiggle = _get_wiggle()
    now = datetime.now(timezone.utc)
    alerts = []
    for a in _assignment_cache:
        if a.get("submitted"):
            continue
        due_str = a.get("due_at")
        if not due_str:
            continue
        try:
            due = datetime.fromisoformat(due_str.replace("Z", "+00:00"))
        except ValueError:
            continue

        hours = a.get("estimated_hours") or 0
        alert_time = due.timestamp() - (hours + wiggle) * 3600
        now_ts = now.timestamp()
        due_ts = due.timestamp()

        if now_ts > due_ts:
            urgency = "overdue"
        elif now_ts >= alert_time:
            urgency = "alert_active"
        elif due_ts - now_ts <= 24 * 3600:
            urgency = "within_24h"
        elif due_ts - now_ts <= 72 * 3600:
            urgency = "within_72h"
        else:
            continue  # not urgent yet

        alerts.append({**a, "urgency": urgency, "alert_time": datetime.fromtimestamp(alert_time, tz=timezone.utc).isoformat()})

    urgency_order = {"overdue": 0, "alert_active": 1, "within_24h": 2, "within_72h": 3}
    alerts.sort(key=lambda x: (urgency_order.get(x["urgency"], 9), x.get("due_at") or ""))
    return alerts


@app.post("/api/estimates/override")
def save_override(body: EstimateOverride):
    database.set_override(body.assignment_id, body.hours)
    # update in-memory cache
    for a in _assignment_cache:
        if a["id"] == body.assignment_id:
            a["estimated_hours"] = body.hours
            a["estimate_source"] = "manual"
    return {"status": "ok"}


@app.post("/api/settings")
def update_settings(body: SettingsUpdate):
    load_dotenv(ENV_PATH, override=True)
    if body.canvas_base_url is not None:
        set_key(str(ENV_PATH), "CANVAS_BASE_URL", body.canvas_base_url)
        os.environ["CANVAS_BASE_URL"] = body.canvas_base_url
    if body.canvas_api_token is not None:
        set_key(str(ENV_PATH), "CANVAS_API_TOKEN", body.canvas_api_token)
        os.environ["CANVAS_API_TOKEN"] = body.canvas_api_token
    if body.openrouter_api_key is not None:
        set_key(str(ENV_PATH), "OPENROUTER_API_KEY", body.openrouter_api_key)
        os.environ["OPENROUTER_API_KEY"] = body.openrouter_api_key
    if body.wiggle_room_hours is not None:
        database.set_setting("wiggle_room_hours", str(body.wiggle_room_hours))
    return {"status": "ok"}


@app.get("/api/settings")
def read_settings():
    return {
        "canvas_base_url": os.getenv("CANVAS_BASE_URL", ""),
        "wiggle_room_hours": _get_wiggle(),
    }


@app.delete("/api/cache")
def clear_cache():
    database.clear_cache()
    _sync_canvas()
    return {"status": "ok", "message": "Cache cleared and re-sync triggered"}


@app.post("/api/sync")
def manual_sync():
    _sync_canvas()
    return {"status": "ok", "assignments": len(_assignment_cache), "courses": len(_course_cache)}
