import hashlib
import json
import os
import re
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv, set_key
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

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
_syncing: bool = False
_last_sync_error: str = ""


def _assignment_hash(a: dict) -> str:
    key = f"{a.get('id')}|{a.get('name')}|{a.get('description', '')}|{a.get('points_possible')}"
    return hashlib.md5(key.encode()).hexdigest()


def _strip_html(text: str) -> str:
    if not text:
        return ""
    return re.sub(r"<[^>]+>", " ", text).strip()


def _sync_canvas():
    global _assignment_cache, _course_cache, _syncing, _last_sync_error
    _syncing = True
    _last_sync_error = ""
    try:
        courses = canvas_client.get_courses()

        # Fetch all grades in one call via /users/self/enrollments
        grade_map: dict[int, dict] = {}
        try:
            for e in canvas_client.get_self_enrollments():
                cid = e.get("course_id")
                if cid and cid not in grade_map:
                    g = e.get("grades", {})
                    grade_map[cid] = {
                        "current_grade": g.get("current_grade"),
                        "current_score": g.get("current_score"),
                        "final_grade": g.get("final_grade"),
                        "final_score": g.get("final_score"),
                    }
        except Exception:
            pass

        enriched_courses = []
        all_assignments = []

        for course in courses:
            cid = course["id"]
            cname = course.get("name", f"Course {cid}")

            # Prefer separate enrollment grades; fall back to inline if present
            grade_info = grade_map.get(cid, {
                "current_grade": None, "current_score": None,
                "final_grade": None, "final_score": None,
            })
            for e in course.get("enrollments", []):
                if grade_info["current_score"] is None:
                    grade_info = {
                        "current_grade": e.get("computed_current_grade"),
                        "current_score": e.get("computed_current_score"),
                        "final_grade": e.get("computed_final_grade"),
                        "final_score": e.get("computed_final_score"),
                    }
                break

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
            course_assignments = []
            try:
                raw_assignments = canvas_client.get_assignments(cid)
                for a in raw_assignments:
                    sub = a.get("submission") or {}
                    submitted = sub.get("workflow_state") not in (None, "unsubmitted")
                    a_hash = _assignment_hash(a)
                    cached = database.get_estimate(a["id"])
                    override = database.get_override(a["id"])

                    if override:
                        estimated_hours = override["hours"]
                        source = "manual"
                    elif cached and cached["assignment_hash"] == a_hash and cached["hours"] is not None:
                        estimated_hours = cached["hours"]
                        source = cached.get("source", "ai")
                    else:
                        hours, err = openrouter_client.estimate_hours(
                            a.get("name", ""),
                            _strip_html(a.get("description", "")),
                            a.get("points_possible") or 0,
                        )
                        if hours is not None:
                            estimated_hours = hours
                            source = "ai"
                            database.set_estimate(a["id"], hours, a_hash, "ai")
                        else:
                            estimated_hours = None
                            source = "unknown"
                            # Don't cache failures — retry on next sync

                    entry = {
                        "id": a["id"],
                        "course_id": cid,
                        "course_name": cname,
                        "name": a.get("name", ""),
                        "description": _strip_html(a.get("description", "")),
                        "due_at": a.get("due_at"),
                        "points_possible": a.get("points_possible"),
                        "submitted": submitted,
                        "submission_state": sub.get("workflow_state"),
                        "score": sub.get("score"),
                        "estimated_hours": estimated_hours,
                        "estimate_source": source,
                        "html_url": a.get("html_url", ""),
                    }
                    course_assignments.append(entry)
                    all_assignments.append(entry)
            except Exception:
                pass

            # Calculate grade from past-due graded assignments only
            calculated_score = _calc_grade(course_assignments)
            enriched_courses[-1]["calculated_score"] = calculated_score

        _course_cache = enriched_courses
        _assignment_cache = all_assignments
    except Exception as exc:
        _last_sync_error = str(exc)
    finally:
        _syncing = False


def _calc_grade(assignments: list[dict]) -> float | None:
    """
    Return a percentage score calculated only from assignments whose due date
    has already passed AND that have a numeric score from Canvas.
    """
    now = datetime.now(timezone.utc)
    earned = 0.0
    possible = 0.0
    for a in assignments:
        due_str = a.get("due_at")
        if not due_str:
            continue
        try:
            due = datetime.fromisoformat(due_str.replace("Z", "+00:00"))
        except ValueError:
            continue
        if due > now:
            continue  # skip upcoming assignments
        pts = a.get("points_possible")
        score = a.get("score")
        if pts and pts > 0 and score is not None:
            earned += float(score)
            possible += float(pts)
    if possible == 0:
        return None
    return round(earned / possible * 100, 1)


def _get_wiggle():
    db_val = database.get_setting("wiggle_room_hours")
    if db_val is not None:
        return float(db_val)
    return float(os.getenv("WIGGLE_ROOM_HOURS", "2"))


@app.on_event("startup")
def startup():
    database.init_db()
    load_dotenv(ENV_PATH, override=True)
    # Run initial sync in background so uvicorn serves requests immediately
    threading.Thread(target=_sync_canvas, daemon=True).start()
    scheduler.start_scheduler(_sync_canvas)


@app.on_event("shutdown")
def shutdown():
    scheduler.stop_scheduler()


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/api/status")
def status():
    return {
        "syncing": _syncing,
        "courses": len(_course_cache),
        "assignments": len(_assignment_cache),
        "last_sync_error": _last_sync_error,
    }


@app.get("/api/courses")
def get_courses():
    hidden = database.get_hidden_course_ids()
    return [c for c in _course_cache if c["id"] not in hidden]


@app.get("/api/courses/hidden")
def get_hidden_courses():
    hidden = database.get_hidden_course_ids()
    return [c for c in _course_cache if c["id"] in hidden]


@app.post("/api/courses/{course_id}/hide")
def hide_course(course_id: int):
    database.hide_course(course_id)
    return {"status": "ok"}


@app.delete("/api/courses/{course_id}/hide")
def unhide_course(course_id: int):
    database.unhide_course(course_id)
    return {"status": "ok"}


@app.get("/api/assignments")
def get_assignments():
    hidden = database.get_hidden_course_ids()
    return [a for a in _assignment_cache if a["course_id"] not in hidden]


@app.get("/api/alerts")
def get_alerts():
    hidden = database.get_hidden_course_ids()
    wiggle = _get_wiggle()
    now = datetime.now(timezone.utc)
    alerts = []
    for a in _assignment_cache:
        if a.get("course_id") in hidden:
            continue
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
    threading.Thread(target=_sync_canvas, daemon=True).start()
    return {"status": "ok", "message": "Sync started in background"}


@app.get("/api/debug/canvas")
def debug_canvas():
    return canvas_client.debug_raw_courses()


@app.get("/api/debug/openrouter")
def debug_openrouter():
    return openrouter_client.test_connection()
