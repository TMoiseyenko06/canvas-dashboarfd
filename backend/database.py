import sqlite3
import json
import os
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "data" / "dashboard.db"


def get_conn():
    DB_PATH.parent.mkdir(exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_conn()
    cur = conn.cursor()
    cur.executescript("""
        CREATE TABLE IF NOT EXISTS estimate_cache (
            assignment_id INTEGER PRIMARY KEY,
            hours REAL,
            source TEXT DEFAULT 'ai',
            assignment_hash TEXT,
            updated_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS manual_overrides (
            assignment_id INTEGER PRIMARY KEY,
            hours REAL,
            updated_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );

        CREATE TABLE IF NOT EXISTS hidden_courses (
            course_id INTEGER PRIMARY KEY,
            hidden_at TEXT DEFAULT (datetime('now'))
        );
    """)
    conn.commit()
    conn.close()


def get_estimate(assignment_id: int):
    conn = get_conn()
    row = conn.execute(
        "SELECT * FROM estimate_cache WHERE assignment_id = ?", (assignment_id,)
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def set_estimate(assignment_id: int, hours: float, assignment_hash: str, source: str = "ai"):
    conn = get_conn()
    conn.execute(
        """INSERT INTO estimate_cache (assignment_id, hours, source, assignment_hash, updated_at)
           VALUES (?, ?, ?, ?, datetime('now'))
           ON CONFLICT(assignment_id) DO UPDATE SET
               hours=excluded.hours,
               source=excluded.source,
               assignment_hash=excluded.assignment_hash,
               updated_at=excluded.updated_at""",
        (assignment_id, hours, source, assignment_hash),
    )
    conn.commit()
    conn.close()


def get_override(assignment_id: int):
    conn = get_conn()
    row = conn.execute(
        "SELECT * FROM manual_overrides WHERE assignment_id = ?", (assignment_id,)
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def set_override(assignment_id: int, hours: float):
    conn = get_conn()
    conn.execute(
        """INSERT INTO manual_overrides (assignment_id, hours, updated_at)
           VALUES (?, ?, datetime('now'))
           ON CONFLICT(assignment_id) DO UPDATE SET hours=excluded.hours, updated_at=excluded.updated_at""",
        (assignment_id, hours),
    )
    conn.commit()
    conn.close()


def clear_cache():
    conn = get_conn()
    conn.execute("DELETE FROM estimate_cache")
    conn.commit()
    conn.close()


def get_cache_stats() -> dict:
    conn = get_conn()
    total = conn.execute("SELECT COUNT(*) FROM estimate_cache").fetchone()[0]
    cached = conn.execute("SELECT COUNT(*) FROM estimate_cache WHERE hours IS NOT NULL").fetchone()[0]
    pending = conn.execute("SELECT COUNT(*) FROM estimate_cache WHERE hours IS NULL").fetchone()[0]
    overrides = conn.execute("SELECT COUNT(*) FROM manual_overrides").fetchone()[0]
    conn.close()
    return {"total_cached": total, "with_estimate": cached, "pending_retry": pending, "manual_overrides": overrides}


def hide_course(course_id: int):
    conn = get_conn()
    conn.execute(
        "INSERT OR IGNORE INTO hidden_courses (course_id) VALUES (?)", (course_id,)
    )
    conn.commit()
    conn.close()


def unhide_course(course_id: int):
    conn = get_conn()
    conn.execute("DELETE FROM hidden_courses WHERE course_id = ?", (course_id,))
    conn.commit()
    conn.close()


def get_hidden_course_ids() -> set[int]:
    conn = get_conn()
    rows = conn.execute("SELECT course_id FROM hidden_courses").fetchall()
    conn.close()
    return {r["course_id"] for r in rows}


def get_setting(key: str):
    conn = get_conn()
    row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
    conn.close()
    return row["value"] if row else None


def set_setting(key: str, value: str):
    conn = get_conn()
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        (key, value),
    )
    conn.commit()
    conn.close()
