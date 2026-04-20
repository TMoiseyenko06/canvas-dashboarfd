# Canvas Student Dashboard

A full-stack student dashboard for Canvas LMS with AI-powered time estimates, smart alerts, and a calendar view.

## Features

- **Courses & Grades** — Live grades and assignment group weights per course
- **Assignments** — All upcoming assignments with AI time estimates (via OpenRouter / Mistral 7B)
- **Smart Alerts** — Banner notifications when you're in the alert window; optional browser desktop notifications
- **Calendar** — Monthly and weekly views, color-coded by course; click any event for details
- **Settings** — Update tokens, adjust wiggle-room buffer, clear estimate cache

---

## Prerequisites

- Docker + Docker Compose (recommended — single container, no local deps needed)
- _Or_ Python 3.10+ and Node.js 18+ for running locally
- A Canvas LMS account with API access
- An OpenRouter account

---

## Getting Your Credentials

### Canvas Personal Access Token

1. Log into your Canvas instance (e.g., `https://school.instructure.com`)
2. Go to **Account → Settings**
3. Scroll to **Approved Integrations** → click **+ New Access Token**
4. Give it a purpose (e.g., "Dashboard") and click **Generate Token**
5. Copy the token immediately — you cannot view it again

### OpenRouter API Key

1. Sign up at [https://openrouter.ai](https://openrouter.ai)
2. Go to **Keys** in the dashboard
3. Click **Create Key**, name it, and copy it

---

## Docker Setup (recommended)

Everything — FastAPI backend, nginx-served React frontend, and a Cloudflare quick tunnel — runs inside **one container** managed by `supervisord`.

### 1. Configure `.env`

```bash
git clone <repo-url>
cd canvas-dashboard
cp .env .env.local   # optional, or edit .env directly
```

Edit `.env`:

```env
CANVAS_API_TOKEN=your_canvas_token_here
CANVAS_BASE_URL=https://school.instructure.com
OPENROUTER_API_KEY=your_openrouter_key_here
WIGGLE_ROOM_HOURS=2
```

### 2. Build & run

```bash
docker compose up --build
```

That's it. On startup you'll see a line like:

```
cloudflared  | +--------------------------------------------------------------------------------------------+
cloudflared  | |  Your quick Tunnel has been created! Visit it at (it may take a minute to be usable):     |
cloudflared  | |  https://some-random-words.trycloudflare.com                                              |
cloudflared  | +--------------------------------------------------------------------------------------------+
```

Open that `trycloudflare.com` URL in any browser — no port forwarding, no account required.

The app is also available locally at `http://localhost:8080`.

> **Tunnel note:** The quick tunnel URL changes each time the container restarts. For a stable URL you need a free Cloudflare account and a named tunnel (see Cloudflare docs).

---

## Local Dev Setup (without Docker)

### Backend

```bash
pip install -r requirements.txt
uvicorn backend.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` to `localhost:8000`.

---

## Adjusting the Wiggle Room Buffer

The wiggle room buffer controls how early you get alerted before an assignment is due. The alert fires at:

```
due_date - estimated_hours - wiggle_room_hours
```

**Default:** 2 hours.

You can change this in two ways:
1. **Settings panel** in the UI (persisted to SQLite, takes effect immediately)
2. Edit `WIGGLE_ROOM_HOURS` in `.env` and restart the backend

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/courses` | All active courses with grades |
| `GET` | `/api/assignments` | All assignments with AI estimates |
| `GET` | `/api/alerts` | Assignments in their alert window |
| `POST` | `/api/estimates/override` | Save a manual time estimate |
| `GET` | `/api/settings` | Read current settings |
| `POST` | `/api/settings` | Update config values |
| `DELETE` | `/api/cache` | Clear estimate cache and re-sync |
| `POST` | `/api/sync` | Trigger manual Canvas sync |

---

## Architecture

```
canvas-dashboard/
├── backend/
│   ├── main.py              # FastAPI app + all endpoints
│   ├── canvas_client.py     # Canvas REST API wrapper (paginated)
│   ├── openrouter_client.py # OpenRouter AI estimate requests
│   ├── scheduler.py         # APScheduler 30-min background sync
│   ├── database.py          # SQLite helpers (estimates, overrides, settings)
│   └── models.py            # Pydantic request models
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   └── components/
│   │       ├── CourseCard.jsx
│   │       ├── AssignmentList.jsx
│   │       ├── CalendarView.jsx
│   │       ├── AlertBanner.jsx
│   │       └── Settings.jsx
│   └── vite.config.js       # Proxies /api → localhost:8000
├── data/                    # Auto-created; holds dashboard.db
├── requirements.txt
└── .env
```

## Notes

- AI estimates are cached in SQLite and only re-queried when assignment content changes
- Canvas data auto-syncs every 30 minutes via APScheduler
- Grades may not be available for all courses — this depends on Canvas course settings
- The Vite dev server proxies `/api` requests to the FastAPI backend so there are no CORS issues in development
