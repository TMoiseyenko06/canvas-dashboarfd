import httpx
import os


def _get_config():
    base_url = os.getenv("CANVAS_BASE_URL", "").rstrip("/")
    token = os.getenv("CANVAS_API_TOKEN", "")
    return base_url, token


def _headers():
    _, token = _get_config()
    return {"Authorization": f"Bearer {token}"}


def _paginate(url: str, params=None) -> list[dict]:
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
            params = None
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
    """
    Fetch courses the user is enrolled in. Uses progressively simpler requests
    because some Canvas instances 500 on include[] params.
    """
    base_url, _ = _get_config()
    attempts = [
        # Try with grade info inline
        [("include[]", "total_scores"), ("per_page", "50")],
        # Bare minimum — just list courses, grades fetched separately
        [("per_page", "50")],
    ]
    last_exc = None
    for params in attempts:
        try:
            courses = _paginate(f"{base_url}/api/v1/courses", params=params)
            return [
                c for c in courses
                if isinstance(c, dict)
                and c.get("workflow_state") not in ("completed", "deleted")
            ]
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code >= 500:
                last_exc = exc
                continue
            raise
    raise last_exc


def get_self_enrollments() -> list[dict]:
    """
    All of the current user's student enrollments with grade info.
    Returns enrollment objects with a 'grades' key containing
    current_score, current_grade, final_score, final_grade.
    """
    base_url, _ = _get_config()
    return _paginate(
        f"{base_url}/api/v1/users/self/enrollments",
        params=[("type[]", "StudentEnrollment"), ("per_page", "50")],
    )


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


def debug_raw_courses() -> dict:
    """Returns raw API response for diagnosing Canvas issues."""
    base_url, _ = _get_config()
    results = {}
    with httpx.Client(headers=_headers(), timeout=30) as client:
        for label, params in [
            ("with_total_scores", [("include[]", "total_scores"), ("per_page", "5")]),
            ("bare", [("per_page", "5")]),
        ]:
            try:
                resp = client.get(f"{base_url}/api/v1/courses", params=params)
                results[label] = {"status": resp.status_code, "body": resp.json()}
            except Exception as exc:
                results[label] = {"error": str(exc)}
    return results
