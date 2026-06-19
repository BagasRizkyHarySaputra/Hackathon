# Product Requirements Document (PRD) — SkinGlow Analyzer / LICIN

## 1. Executive Summary

**SkinGlow Analyzer** (also branded as **LICIN**) is a Progressive Web App (PWA) for AI-powered skin analysis and glow detection. Users upload/capture a skin photo, receive an AI-driven analysis report (dark spots, pustules, papules, hydration, glow level), track progress via a skin diary, read skincare articles, participate in a community forum, and manage their profile. The app is currently in **Phase 1 (Frontend Mock)** — a fully functional frontend with a Node.js mock server simulating backend responses. Phase 2 will integrate a real FastAPI backend with ML models.

**Target Users:** Health-conscious individuals interested in skin health monitoring, skincare enthusiasts, and individuals seeking personalized skin analysis.

---

## 2. Product Goals & Objectives

1. **AI Skin Analysis** — Provide automated analysis of skin conditions (tone, texture, hydration, glow) from user-uploaded or camera-captured photos.
2. **Progress Tracking** — Enable users to maintain a skin diary with before/after comparisons and progress visualization (donut charts, percentage tables).
3. **Educational Content** — Curate a library of skincare articles covering various skin concerns (acne, dry skin, oily skin, sensitive, combination).
4. **Community Engagement** — Facilitate a community chat platform for users to discuss skincare topics.
5. **Offline-First PWA** — Ensure reliable performance even without internet connectivity through Service Worker caching strategies.
6. **Phase 2 Scalability** — Architect frontend so backend swap (mock → FastAPI) requires zero markup changes.

---

## 3. Pages & Features

### 3.1 Loading Page (`pages/loading/`)
- **Purpose:** Splash/Loading screen shown after photo submission, simulating AI analysis.
- **Features:**
  - Animated progress bar (0–100%) with non-linear easing
  - Status messages at thresholds: 0%, 15%, 35%, 55%, 75%, 90%, 100%
  - Mascot (water drop character) with animated expressions
  - Decorative background shapes
  - Auto-redirects to login (mock mode) or results page after completion

### 3.2 Login Page (`pages/login/`)
- **Purpose:** User authentication.
- **Features:**
  - Sign In / Sign Up tab switching
  - Email & password form with validation
  - Password visibility toggle (eye icon)
  - Social login buttons: Google, Facebook
  - Mock auth accepts `contoh@gmail.com` / `contoh123`
  - Responsive two-column layout (mascot left, form right)

### 3.3 Home Page (`pages/home/`)
- **Purpose:** Main dashboard and skin diary.
- **Features:**
  - **Skin Diary:** Week tabs with photo thumbnails, before/after slider
  - **Skin Diary Summary:** Donut chart showing overall skin score (80%)
  - **Progress Table:** 6 skin concerns with before/after percentages

### 3.4 Scan — Skin Type Selection (`pages/scan/`)
- **Purpose:** First-time skin type selection.
- **Features:**
  - Select from: Oily, Dry, Combination, Normal, Sensitive, Not Sure
  - Confirmation with toast notification
  - Redirects to scan camera page

### 3.5 Scan — Camera & Analysis (`pages/scan-page/`)
- **Purpose:** Core AI skin scanning feature.
- **Features:**
  - Front-facing camera access via `getUserMedia`
  - Photo capture to canvas with framing guide overlay
  - Analysis overlay markers on captured photo (Dark Spot 10%, Pustules 7%, Papules 18%)
  - Product recommendation card
  - Morning/Night routine toggle with save functionality
  - Camera stop after capture

### 3.6 Artikel Page (`pages/artikel/`)
- **Purpose:** Skincare article library.
- **Features:**
  - Tag filter bar: All, Acne, Dry Skin, Oily Skin, Sensitive, Combination
  - Search box with real-time filtering
  - Dynamic article card grid (18 articles)
  - Article detail view with title, image, description, sections, tips, source
  - Bilingual content: Indonesian (Parapuan.co) & English (SkinGlow Editorial)

### 3.7 Community Page (`pages/community/`)
- **Purpose:** Community discussion platform.
- **Features:**
  - Three-panel layout: channel avatars (left), topic panel (middle), chat area (right)
  - Channels: #Acne Fighter, #Review Skincare, #Skincare
  - Chat messages: received vs sent styling
  - Typing input with emoji and send icons

### 3.8 Community Admin Page (`pages/community-admin/`)
- **Purpose:** Admin variant of community page.
- **Features:**
  - Same as community page + "Add Topic" (+) button in topic panel header

### 3.9 Profile Page (`pages/profile/`)
- **Purpose:** User profile and settings.
- **Features:**
  - Profile header: avatar upload/compress, username, skin type, member since
  - **Skin Type Card:** Displays current skin type (e.g., Combination)
  - **Skin Score Card:** Donut chart (80/Good)
  - **Skincare Routine:** Morning/Night tabs with product cards
  - **Settings Bar:** Account, Notification modal, Privacy modal, Help Center modal, Sign Out

### 3.10 Account Page (`pages/account/`)
- **Purpose:** Edit personal data and preferences.
- **Features:**
  - Profile header (same as profile page)
  - **Data Personal Form:** Nama Lengkap, Email, Jenis Kelamin, Tanggal Lahir, Save button
  - **Skin Type Selector:** Oily, Dry, Combination, Sensitive, Not Sure
  - Speech bubble mascot
  - Same settings bar + modals as profile

### 3.11 Tips & Artikel Page (`pages/tips-artikel/`)
- **Purpose:** Static article detail page.
- **Features:**
  - Single article: "How to Build a Simple Skincare Routine That Actually Works"
  - Three-column layout: text, benefits/key tips, product image
  - Tag toolbar + search box

---

## 4. Architecture

### 4.1 Tech Stack
| Technology | Version | Role |
|---|---|---|
| Alpine.js | v3.x | Reactive UI state & component logic |
| HTMX | v2.x | Hypermedia-driven server communication |
| PWA APIs | Standard | Offline support, install prompt, service worker |
| Vanilla CSS | CSS3 | Styling with custom properties |
| HTML5 | HTML5 | Semantic markup |
| Node.js | v18+ | Mock development server |

### 4.2 Frontend Architecture
- **Alpine.js Stores:** `ui.store` (global UI state: sidebar, toasts, theme), `auth.store` (auth state: token, user, roles)
- **Client-Side Router:** Intercepts `<a>` clicks with fade-out transition
- **Components:** Sidebar (5 nav items + mascot), Header (greeting + notification/avatar), Blurred gradient background (6 colored blobs)
- **Config:** Single source of truth in `config/app.config.js`

### 4.3 Mock Server (Phase 1)
- **Port:** 8001
- **Endpoints:** Loading partial, analysis status, login partial, auth login, scan partial, artikel partial, community partial, profile partial, tips-artikel partial, static assets
- **CORS:** Enabled for development
- **Dry-run mode:** `?dry_run=true` returns `{ status: 'ok' }`

### 4.4 Phase 2 Backend (Planned)
| Technology | Role |
|---|---|
| FastAPI | REST / Server-Side Partial HTML API |
| Python | Backend language |
| ML Libraries | Skin analysis models (best.pt YOLO) |
| Database | TBD |

---

## 5. PWA Features

- **Manifest:** standalone display, portrait-primary orientation, `#95B4C6` theme color
- **Service Worker:**
  - Cache strategies: Cache First (app shell, images), Network First (API, partials), Stale While Revalidate (CSS/JS)
  - Pre-cache: `/`, `/index.html`, `/offline.html`, `/manifest.json`
  - Offline fallback page with connection monitoring
- **Offline Page:** Friendly offline message, connection status badge, auto-reload on reconnect

---

## 6. Design System

### 6.1 Color Palette
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

### 6.2 Layout
- Desktop-first design (1440×1024px viewport)
- Flexbox layout: sidebar + main content area
- Shared `.app-layout`, `.app-main`, `.app-content` classes
- Blurred gradient background across all pages
- **Desktop vs Mobile (HP):** Layout harus responsif dan berbeda antara desktop dan HP.
  - **Desktop (≥1024px):** Sidebar tetap di kiri + konten di kanan (layout horizontal).
  - **Mobile (<768px):** Sidebar menjadi bottom navigation atau hamburger menu, konten full-width, tata letak card/kolom berubah menjadi single-column vertical stack.
  - **Saat ini baru 4 dari 11 halaman yang sudah responsive:** Loading (768px, 480px), Login (1000px, 768px, 480px), Scan — Skin Type (680px), Scan — Camera (900px, 600px).
  - **7 halaman belum responsive:** Home, Artikel, Community, Community Admin, Profile, Account, Tips & Artikel — masih desktop-only.
  - **CSS files tanpa @media queries:** `home.css`, `community.css`, `profile.css`, `account.css`, `artikel.css`, `tips-artikel.css`, `sidebar.css`, `header.css`, `global.css`, `main.css`.

---

## 7. Non-Functional Requirements

1. **Performance:** Loading progress simulation at 80ms intervals, <10s total simulated analysis
2. **Offline Support:** Service Worker caching enables core functionality offline
3. **Browser Support:** Modern Chromium-based browsers (Chrome, Edge)
4. **Security:** Mock auth token in Phase 1; real JWT authentication in Phase 2
5. **Scalability:** Zero markup changes required when swapping mock → FastAPI backend

---

## 8. Milestones & Roadmap

### Phase 1 (Current) — Frontend Mock

#### Page Implementation Status

| # | Page | Status | Responsive | Notes |
|---|------|--------|-----------|-------|
| 3.1 | Loading |  Built |  Ya | Progress bar, mascot, animated shapes, auto-redirect |
| 3.2 | Login |  Built |  Ya | Sign In/Up tabs, social buttons, password toggle |
| 3.3 | Home |  Built |  Belum | Skin diary, donut chart, progress table |
| 3.4 | Scan — Skin Type |  Built |  Ya | 6 skin types, confirm toast |
| 3.5 | Scan — Camera |  Built |  Ya | Camera, framing guide, analysis markers, product card, routine toggle |
| 3.6 | Artikel |  Built |  Belum | Tag filter, search, 18 artikel, detail view, bilingual |
| 3.7 | Community |  Built |  Belum | Three-panel: channels, topics, chat |
| 3.8 | Community Admin |  Built |  Belum | Sama + "Add Topic" button |
| 3.9 | Profile |  Built |  Belum | Avatar, skin type card, score chart, routine, settings |
| 3.10 | Account |  Built |  Belum | Data form, skin type selector, mascot, settings |
| 3.11 | Tips & Artikel |  Built |  Belum | Static article, three-column layout |

#### Infrastructure Status

- [x] All 11 pages built with Alpine.js + HTMX
- [x] Mock Node.js server with all endpoints (server.js, partials/, mock/data/)
- [x] PWA manifest + Service Worker + offline page
- [x] Client-side routing with transitions (router.js)
- [x] Article library with tag filtering and search (artikel.js, 18 articles)
- [x] Community chat UI (3 channels, received/sent styling)
- [x] Sidebar component with 5 nav items + mascot
- [x] Header component (greeting + notification/avatar)
- [x] Blurred gradient background component
- [x] Alpine stores: ui.store (toasts, theme), auth.store (token, user)
- [x] Centralized config: config/app.config.js

#### Known Issues

- [ ] **Resolve sync conflicts** — 100+ `.sync-conflict-*` files dari editor conflict (Syncthing?), tersebar di pages/, assets/css/, assets/js/, mock/, config/, root files
- [ ] **Finalize branding** — Masih campuran: beberapa pake "SkinGlow" (loading, login, home), beberapa pake "LICIN" (profile, account, title tag di index.html)
- [ ] **Responsive layout** — 7 dari 11 halaman masih desktop-only, belum ada @media queries
- [ ] **Mock auth belum diverifikasi** — Login page sudah built, tapi kredensial mock (contoh@gmail.com / contoh123) belum dipastikan berfungsi
- [ ] **Komponen belum dipisah** — components/layout/ dan components/ui/ kosong, komponen masih embedded di masing-masing halaman

### Phase 2 — Backend Integration
- [ ] FastAPI server with identical HTMX partials
- [ ] Real ML skin analysis model (best.pt YOLO)
- [ ] JWT authentication
- [ ] Real database integration
- [ ] Push notifications
- [ ] `IS_MOCK_MODE = false`

---

*Prepared: June 18, 2026*
*Project Path: D:\Hackathon\project*
