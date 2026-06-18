# Mock Server — SkinGlow Analyzer

## Overview

This mock server simulates the FastAPI backend for Phase 1 frontend development.
It serves HTML partials and JSON data that match the expected FastAPI contract,
enabling seamless backend swap in Phase 2.

## Prerequisites

- Node.js v18 or higher (uses built-in `http`, `fs`, `path` — no npm install needed)

## Start the Server

```bash
cd project/
node mock/server.js
```

The server starts on **http://localhost:8001**.

## Available Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | App shell (index.html) |
| `GET` | `/api/loading/partial` | Loading page HTML partial |
| `GET` | `/api/analysis/status` | Mock analysis status JSON |
| `GET` | `/api/login/partial` | Login page HTML partial |
| `POST` | `/api/auth/login` | Mock login response JSON |
| `GET` | `/api/scan/partial` | Scan page HTML partial |
| `GET` | `/api/artikel/partial` | Artikel page HTML partial |
| `GET` | `/api/community/partial` | Community page HTML partial |
| `GET` | `/api/community-admin/partial` | Community Admin page HTML partial |
| `GET` | `/api/profile/partial` | Profile page HTML partial |
| `GET` | `/api/tips-artikel/partial` | Tips & Artikel page HTML partial |
| `GET` | `/offline.html` | PWA offline fallback |
| `GET` | `/pages/loading/` | Loading page (standalone) |
| `GET` | `/*` + `?dry_run=true` | Returns 200 OK without side effects |

## Mock Data

Mock datasets are stored in `mock/data/`:

- `loading.json` — Initial loading state with progress, status, and messages
- `login.json` — Mock login response with token and user data

## Dry Run Mode

Append `?dry_run=true` to any endpoint to receive a success response
without triggering any side effects:

```
GET /api/analysis/status?dry_run=true
→ { "status": "ok", "dry_run": true }
```

## Phase 2 Migration

When FastAPI is ready:
1. Update `config/app.config.js` → `API_BASE_URL` to FastAPI URL
2. FastAPI must return **identical HTML partials** as this mock server
3. Set `IS_MOCK_MODE = false`
4. No markup changes required
