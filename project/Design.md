# Design.md — Frontend Architecture

## 1. Overview

**SkinGlow Analyzer** is a Progressive Web App (PWA) that provides AI-powered
skin analysis and glow detection. Users upload a photo, and the app analyzes
skin tone, texture, hydration, and glow levels — presenting results in an
intuitive dashboard.

The current phase (Phase 1) focuses on the **frontend in isolation** using
Alpine.js, HTMX, and PWA standards. A mock server simulates backend responses.
Phase 2 will integrate a FastAPI backend with zero markup changes.

**Target Users:** Health-conscious individuals interested in skin health monitoring.

---

## 2. Tech Stack

| Technology | Version | Role |
|---|---|---|
| Alpine.js | v3.x | Reactive UI state & component logic |
| HTMX | v2.x | Hypermedia-driven server communication |
| PWA APIs | Standard | Offline support, install prompt, service worker |
| Vanilla CSS | CSS3 | Styling with custom properties & scoped components |
| HTML5 | HTML5 | Semantic markup base |
| Node.js | v18+ | Mock development server (no npm dependencies) |

**Backend (Phase 2 — not yet built):**

| Technology | Role |
|---|---|
| FastAPI | REST / Server-Side Partial HTML API |
| Python | Backend language |
| ML Libraries | Skin analysis models (best.pt YOLO) |
| Database | TBD |

---

## 3. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        BROWSER                               │
│                                                              │
│  ┌──────────┐    ┌───────────────┐    ┌──────────────────┐  │
│  │ Alpine   │◄──►│ Alpine Stores │    │ Alpine           │  │
│  │ Components│    │ (ui, auth)    │    │ Directives       │  │
│  └──────────┘    └───────────────┘    │ (x-data, x-show) │  │
│       │                                └──────────────────┘  │
│       │                                                      │
│  ┌────▼────────────────────────────────────────────────────┐ │
│  │                    HTMX Layer                            │ │
│  │  hx-get / hx-post / hx-target / hx-swap                 │ │
│  │  + Interceptors (auth headers, error toasts)             │ │
│  └────┬────────────────────────────────────────────────────┘ │
│       │                                                      │
│  ┌────▼──────────────┐  ┌──────────────────────────────┐    │
│  │  Service Worker    │  │  App Config                   │    │
│  │  (cache strategies)│  │  (APP_CONFIG — single source) │    │
│  └────────────────────┘  └──────────────────────────────┘    │
└───────────┬─────────────────────────────────────────────────┘
            │ HTTP (HTMX requests)
            ▼
┌───────────────────────────────────────┐
│        MOCK SERVER (Phase 1)          │
│  Node.js http — serves HTML partials  │
│  & mock JSON from mock/data/          │
│  → Phase 2: Swap to FastAPI           │
└───────────────────────────────────────┘
```

---

## 4. Feature Registry

| Feature | Alpine Component | Alpine Store | HTMX Endpoints | Partials |
|---|---|---|---|---|
| **Loading Page** | `createLoadingComponent()` | ui.store, auth.store | `GET /api/loading/partial`, `GET /api/analysis/status` | `partials/loading/loading-content.html` |
| **Login Page** | `createLoginComponent()` | ui.store, auth.store | `GET /api/login/partial`, `POST /api/auth/login` | `partials/login/login-content.html` |
| **Toast Notifications** | — (inline template) | ui.store | — | — |
| **Auth** | `createLoginComponent()` | auth.store | `POST /api/auth/login` | `partials/login/login-content.html` |

---

## 5. Configuration Reference

All configuration lives in `config/app.config.js`.

| Key | Type | Default | Description |
|---|---|---|---|
| `APP_NAME` | string | `'SkinGlow Analyzer'` | Application display name |
| `SHORT_NAME` | string | `'SkinGlow'` | PWA short name for home screen |
| `VERSION` | string | `'0.1.0'` | Semantic version |
| `API_BASE_URL` | string | `'http://localhost:8001'` | Mock/real API base URL |
| `API_TIMEOUT_MS` | number | `10000` | Request timeout in ms |
| `HTMX_DEFAULT_SWAP` | string | `'innerHTML'` | Default HTMX swap strategy |
| `HTMX_INDICATOR_CLASS` | string | `'htmx-loading'` | CSS class for loading state |
| `SW_CACHE_NAME` | string | `'skinglow-v1'` | Service Worker cache name |
| `SW_OFFLINE_URL` | string | `'/offline.html'` | Offline fallback page URL |
| `LOADING_PROGRESS_INTERVAL_MS` | number | `80` | Progress bar tick interval |
| `LOADING_SIMULATION_DURATION_MS` | number | `8000` | Total simulated duration |
| `IS_MOCK_MODE` | boolean | `true` | Enable mock data responses |

---

## 6. PWA Details

### Cache Strategy Table

| Asset Type | Strategy | Rationale |
|---|---|---|
| App Shell HTML | Cache First | Critical for offline launch |
| HTMX Partials | Network First | Must reflect live server data |
| Static CSS/JS | Stale While Revalidate | Fast load with background refresh |
| API JSON Responses | Network First | Data freshness priority |
| Images / Icons | Cache First | Bandwidth efficiency |

### Manifest Fields

- `name`: SkinGlow Analyzer
- `short_name`: SkinGlow
- `display`: standalone
- `theme_color`: #95B4C6 (blue-grey from design palette)
- `background_color`: #ffffff
- `orientation`: portrait-primary

---

## 7. Mock Server Contract

| Method | Path | Response | Status Codes |
|---|---|---|---|
| `GET` | `/` | `index.html` (app shell) | 200 |
| `GET` | `/api/loading/partial` | `partials/loading/loading-content.html` | 200 |
| `GET` | `/api/analysis/status` | `mock/data/loading.json` | 200 |
| `GET` | `/api/login/partial` | `partials/login/login-content.html` | 200 |
| `POST` | `/api/auth/login` | `mock/data/login.json` | 200 |
| `GET` | `/offline.html` | Offline fallback page | 200 |
| `GET` | `/*` + `?dry_run=true` | `{ status: 'ok', dry_run: true }` | 200 |
| `GET` | `/assets/*` | Static CSS/JS/icon files | 200, 404 |
| `GET` | `*` (unknown) | 404 HTML page | 404 |

---

## 8. Color Palette (from Figma layer_Loading.json)

| Swatch | Hex | Usage |
|---|---|---|
| White | `#FFFFFF` | Page background, content panel |
| Light Pink | `#FFE3E2` | Large decorative background shapes |
| Dusty Rose | `#E4D8DC` | Small decorative shapes, progress track |
| Blue-Grey | `#95B4C6` | Accent shapes, progress fill, theme color |
| Slate Blue | `#6E7F99` | Large decorative vector shape |
| Dark Slate | `#535F73` | Heading text, icons, percentage display |
| Dark Grey | `#44474C` | Subtext / secondary text |
| Very Dark Blue | `#0B1939` | Mascot eyes |
| Mauve | `#D3ADC3` | Mascot cheek blush |

---

## 9. Loading Page — Design Specifications

Based on Figma export (`layer_Loading.json`):

- **Frame Size:** 1440 × 1024px (desktop viewport)
- **Content Panel:** 448 × 257px, white bg, padding 32px, auto-layout vertical
- **Heading:** "Analyzing your skin glow..." — 28px, #535F73, bold
- **Subtext:** "Please wait a moment" — 14px, #44474C
- **Progress Bar:** 382 × 16px, track #E4D8DC, fill #95B4C6, 8px radius
- **Percentage:** Icon (18×18) + text "2%" — 14px, #535F73
- **Mascot:** Water drop character (250×250px group) with eyes, blush, mouth
- **Decorative Shapes:** 7 positioned rectangles/vectors behind content

---

## 10. Login Page — Design Specifications

Based on Figma export (`layer_Login.json`):

- **Frame Size:** 1440 × 1024px (desktop viewport)
- **Layout:** Two-column — mascot left, card right
- **Mascot:** Water drop character (500×520px group), SVG with 3D effects
- **Back Card:** 570×614px, color #E4D8DC (dusty pink), offset 12px
- **Front Card:** 573×618px, color #D0DCE1 (blue-grey), rounded 24px
- **Tabs:** Sign In / Sign Up — 22px bold, #2C2C2C, active with 2px underline
- **Social Buttons:** 66×66px white, Google (#FFC107, #4CAF50, #1976D2) & Facebook (#0866FF)
- **OR Divider:** 262×18px, lines + "Or" text, #2C2C2C
- **Email Input:** 396×54px, white bg, envelope icon #5F6368
- **Password Input:** 396×54px, white bg, lock icon #5F6368, eye toggle
- **Sign In Button:** 421×64px, gradient #E4D8DC → #95B4C6, rounded 16px
- **Account Link:** 13px, #5A5959, "Sign Up" link in #E4D8DC

---

## 11. Backend Integration Checklist (Phase 2)

- [ ] Replace `APP_CONFIG.API_BASE_URL` → FastAPI server URL
- [x] Implement `POST /api/auth/login` returning `{ token, user }` (mock ready)
- [ ] Implement `GET /api/login/partial` returning same HTML partial (mock ready)
- [ ] Implement `GET /api/analysis/status` returning real progress data
- [ ] FastAPI endpoints must return **identical HTML partials** as mock server
- [ ] Update Service Worker cache version (`skinglow-v2`)
- [ ] Set `APP_CONFIG.IS_MOCK_MODE = false`
- [ ] Add CORS headers in FastAPI matching current mock server headers
- [ ] Test all HTMX interceptors work unchanged with real API
- [ ] Verify Alpine stores receive correct data from HTMX responses

---

*Last Updated: Phase 1 — Frontend (Mock Mode)*
*Prepared for: Alpine.js v3 · HTMX v2 · PWA Standard · FastAPI (Phase 2)*
