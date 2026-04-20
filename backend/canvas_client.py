import httpx
import os


def _get_config():
    base_url = os.getenv("CANVAS_BASE_URL", "").rstrip("/")
    token = os.getenv("CANVAS_API_TOKEN", "")
    return base_url, token


def _headers():
    _, token = _get_config()
    return {"Authorization": f"Bearer {token}"}


def _paginate(url: str, params: dict = None) -> list[dict]:
    results = []
    next_url = url
    with httpx.Client(headers=_headers(), timeout=30) as client:
        while next_url:
            resp = client.get(next_url, params=params)
            resp.raise_for_status()
            data = resp.json()
            if isinstance(data, list):
                results.extend(data)
            else:
                return data
            params = None  # only send params on first request
            links = _parse_link_header(resp.headers.get("Link", ""))
            next_url = links.get("next")
    return results


def _parse_link_header(link_header: str) -> dict:
    links = {}
    if not link_header:
        return links
    for part in link_header.split(","):
        parts = part.strip().split(";")
        if len(parts) == 2:
            url = parts[0].strip().strip("<>")
            rel = parts[1].strip()
            if rel.startswith('rel="') and rel.endswith('"'):
                links[rel[5:-1]] = url
    return links


def get_courses() -> list[dict]:
    base_url, _ = _get_config()
    # include[]=total_scores returns grade info inside each course's enrollments array
    # Don't filter by enrollment_state — let workflow_state handle exclusions
    courses = _paginate(
        f"{base_url}/api/v1/courses",
        params=[
            ("enrollment_type[]", "student"),
            ("include[]", "total_scores"),
            ("include[]", "current_grading_period_scores"),
            ("per_page", "50"),
        ],
    )
    return [
        c for c in courses
        if isinstance(c, dict) and c.get("workflow_state") not in ("completed", "deleted")
    ]


def get_assignment_groups(course_id: int) -> list[dict]:
    base_url, _ = _get_config()
    return _paginate(
        f"{base_url}/api/v1/courses/{course_id}/assignment_groups",
        params=[("include[]", "assignments")],
    )


def get_assignments(course_id: int) -> list[dict]:
    base_url, _ = _get_config()
    return _paginate(
        f"{base_url}/api/v1/courses/{course_id}/assignments",
        params=[
            ("include[]", "submission"),
            ("order_by", "due_at"),
            ("per_page", "50"),
        ],
    )
