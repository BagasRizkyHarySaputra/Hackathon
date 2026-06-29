# Product Requirements Document (PRD) — LICIN

## 1. Executive Summary

**LICIN** is a Progressive Web App (PWA) for AI-powered skin analysis and glow detection. Users upload/capture a skin photo, receive an AI-driven analysis report (dark spots, pustules, papules, hydration, glow level), track progress via a skin diary, read skincare articles, participate in a community forum, manage their profile, and chat with an AI skincare assistant.

**Current Phase:** Transisi dari Phase 1 (Frontend Mock) menuju Phase 2 (Full Backend Integration). Supabase Auth sudah aktif (`IS_MOCK_MODE: false`), ML API (YOLO) sudah dibangun, database migration sudah siap, dan deployment via Vercel sudah dikonfigurasi.

**Target Users:** Health-conscious individuals interested in skin health monitoring, skincare enthusiasts, and individuals seeking personalized skin analysis.

---

## 2. Product Goals & Objectives

1. **AI Skin Analysis** — Provide automated analysis of skin conditions (tone, texture, hydration, glow) from user-uploaded or camera-captured photos. Dua engine: client-side (Canvas JS) dan server-side (YOLO / best.pt).
2. **Progress Tracking** — Enable users to maintain a skin diary with before/after comparisons and progress visualization (donut charts, percentage tables).
3. **Educational Content** — Curate a library of skincare articles covering various skin concerns (target: 31+ articles).
4. **Community Engagement** — Facilitate a community chat platform for users to discuss skincare topics.
5. **AI Chatbot** — AI skincare assistant chatbot dengan chat history, session management, Supabase Realtime, dan emoji picker.
6. **Offline-First PWA** — Ensure reliable performance even without internet connectivity through Service Worker caching strategies.
7. **Phase 2 Scalability** — Architecture memungkinkan backend swap tanpa perubahan markup.

---

## 3. Pages & Features

### 3.1 Loading Page (`pages/loading/`)
- **Purpose:** Splash/Loading screen shown after photo submission, simulating AI analysis.
- **Features:**
  - Animated progress bar (0–100%) dengan non-linear easing
  - Status messages at thresholds
  - Mascot (water drop character) with animated expressions
  - Decorative background shapes
  - Auto-redirects after completion

### 3.2 Login Page (`pages/login/`)
- **Purpose:** User authentication via Supabase Auth.
- **Features:**
  - Sign In / Sign Up tab switching dengan animated card flip
  - SVG card shapes dengan drop shadow + inner shadow filters
  - Card flip animation: exiting card lifts, rotates, and tucks behind the entering card (z-index swap timed at 150ms via JS)
  - Email & password form with validation
  - Password visibility toggle (eye icon)
  - Confirm password field (Sign Up tab only)
  - Social login buttons: Google, Facebook
  - **Supabase Auth integration** — real authentication (bukan mock lagi)
  - OAuth redirect handling dengan URL hash detection (#access_token=)
  - Responsive two-column layout (mascot left, card right)
  - **Bukan mock:** Sudah terintegrasi dengan Supabase Auth, `IS_MOCK_MODE: false`

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
  - **Dua analysis engine:**
    - **Client-side:** `SkinAnalyzer` — pure JS canvas-based (redness, dark spots, oiliness, dryness, skin tone, skin type classification)
    - **Server-side:** YOLO model via `ml-api/main.py` — POST /analyze endpoint (bounding box markers, annotated image, health score profile, product recommendation)
  - Analysis overlay markers pada captured photo
  - Product recommendation card
  - Morning/Night routine toggle with save functionality
  - Camera stop after capture
  - **Telegram cloud storage** — foto dikirim ke Telegram Bot API untuk penyimpanan unlimited

### 3.6 Artikel Page (`pages/artikel/`)
- **Purpose:** Skincare article library.
- **Features:**
  - Tag filter bar: All, Acne, Dry Skin, Oily Skin, Sensitive, Combination
  - Search box with real-time filtering
  - Dynamic article card grid (18 articles di frontend; 31 articles via Supabase)
  - Article detail view with title, image, description, sections, tips, source
  - Bilingual content: Indonesian (Parapuan.co) & English (SkinGlow Editorial)
  - **Script upload:** `scripts/upload_articles.py` untuk upload batch ke Supabase

### 3.7 Community Page (`pages/community/`)
- **Purpose:** Community discussion platform.
- **Features:**
  - Three-panel layout: channel avatars (left), topic panel (middle), chat area (right)
  - Channels: #Acne Fighter, #Review Skincare, #Skincare
  - Chat messages: received vs sent styling
  - Typing input with emoji and send icons
  - Data dari `db-sementara/community.json` sebagai seed

### 3.8 Chatbot Page (`pages/chatbot/`)
- **Purpose:** AI skincare assistant chatbot.
- **Features:**
  - **Chat list** — left sidebar dengan daftar chat sessions
  - **New Chat** — create new chat session
  - **History** — collapsible history section
  - **Rename chat** — double-click untuk rename
  - **Send message** dengan Enter key atau send button
  - **Bot auto-reply** — AI-powered reply via DG-AI API (gpt-oss-120b), 5 msg context, fallback message on error
  - **Emoji Picker** — 9 kategori emoji, click untuk insert
  - **Supabase Realtime** — live message updates via `postgres_changes` subscription
  - **Polling fallback** — 5 detik interval jika Realtime tidak tersedia
  - **Auth-gated** — redirect ke /login jika tidak terautentikasi
  - **Isolasi per-user** — setiap user punya chat space sendiri (RLS-protected)
  - **CSS:** `chatbot.css` + `chatbot-mobile.css`

### 3.9 Profile Page (`pages/profile/`)
- **Purpose:** User profile and settings.
- **Features:**
  - Profile header: avatar upload/compress, username, skin type, member since
  - **Account toggle mode:** Click "Account" di settings bar → profile-grid hide, account-grid-wrap show dengan edit form
  - **Account Edit Form** (inline, not separate page): Nama Lengkap, Email, Jenis Kelamin, Tanggal Lahir, Skin Type selector, speech bubble mascot, Save button
  - "Edit Profile" / "Batal" toggle button
  - Active settings bar item highlighted dengan `--active` class
  - **Skin Type Card:** Displays current skin type
  - **Skin Score Card:** Donut chart (80/Good)
  - **Skincare Routine:** Morning/Night tabs dengan product cards (data dari Supabase `skincare_routines` table)
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
| Supabase | Latest | Auth (real), Database (Postgres), Realtime |
| Node.js | v18+ | Mock dev server + Vercel Serverless API |
| FastAPI / Python | — | ML API (YOLO skin analysis) |
| Telegram Bot API | — | Cloud photo storage (unlimited) |

### 4.2 Frontend Architecture
- **Alpine.js Stores:** `ui.store` (global UI state: sidebar, toasts, theme), `auth.store` (Supabase Auth state: token, user, roles, isAuthenticated)
- **Supabase Client:** ES Module dari `https://esm.sh/@supabase/supabase-js@2.49.1`, diinisialisasi di `assets/js/supabase/supabase-client.js`
- **Client-Side Router:** Intercepts `<a>` clicks with fade-out transition (`router.js`)
- **Components:** Sidebar (JS-rendered, 5 nav items + mascot), Header (JS-rendered, greeting + notification/avatar), Blurred gradient background (6 colored blobs)
- **Config:** Single source of truth in `config/app.config.js`
- **Chat Engine:** Shared `chat-engine.js` untuk community & chatbot pages

### 4.3 Backend Infrastructure

#### 4.3.1 Supabase (Production Backend)
- **Auth:** Supabase Auth (email/password + Google OAuth + Facebook OAuth)
- **Database (Postgres):**
  - `public.scan_results` — RLS-protected, stores YOLO health score per scan
  - `public.chatbot_chats` — RLS-protected, chat sessions
  - `public.chatbot_messages` — RLS-protected, chat messages with Supabase Realtime
  - `public.skincare_routines` — morning/night routine steps per user
  - `public.articles` — article library (31 articles via batch upload)
  - `public.profiles` — user profile data
- **Realtime:** `postgres_changes` subscription untuk live chatbot messages

#### 4.3.2 Vercel Serverless API (`api/index.js`)
- **Partial endpoints:** `/api/loading/partial`, `/api/login/partial`, `/api/scan/partial`, `/api/artikel/partial`, `/api/community/partial`, `/api/profile/partial`
- **Mock JSON API:** `/api/analysis/status`, `/api/auth/login`
- **Chat API:** `/api/chat/send` (POST), `/api/chat/history` (GET) — in-memory store
- **Telegram Proxy:** `/api/telegram/send-photo` (POST), `/api/telegram/photo` (GET) — upload & serve photos via Telegram Bot API
- **Config:** `vercel.json` dengan rewrites untuk SPA routing

#### 4.3.3 ML API — YOLO (`ml-api/`)
- **Teknologi:** FastAPI + ultralytics YOLO
- **Endpoints:** `GET /health`, `POST /analyze` (multipart form: file)
- **Model:** `best.pt` — trained YOLO weights untuk acne detection
- **Deteksi:** nodules, pustules, papules, dark spot, blackheads, whiteheads
- **Output:** markers (bounding box), annotated_image (base64 JPEG), health_score (clear_skin % + per-type), product recommendation, acne_counts
- **Deploy:** Docker-ready untuk Hugging Face Spaces
- **Local dev:** `uvicorn main:app --reload --port 8002`

#### 4.3.4 Client-Side ML (`assets/js/ml/skin-analyzer.js`)
- **Pure JavaScript** — no external model needed
- **Canvas pixel processing:** color science + image processing
- **Analyses:** skin tone, redness/inflammation, dark spots, oiliness, dryness, skin type classification
- **Product recommendations** based on skin type & detected issues
- **Fallback/alternative** ke YOLO server-side

### 4.4 Deployment

| Platform | Service | URL |
|---|---|---|
| Vercel | Frontend + Serverless API | Rewrites via `vercel.json` |
| Hugging Face Spaces | ML API (YOLO) | Docker deployment |
| Supabase | Auth + Database + Realtime | South Asia region |

### 4.5 Database Migrations
| Migration | File | Purpose |
|---|---|---|
| 001 | `migrations/001_scan_results.sql` | Creates `scan_results` table (clear_skin, nodules, pustules, papules, dark_spot, blackheads, whiteheads, acne_counts, issues_found) dengan RLS |
| 002 | `migrations/002_scan_results_telegram.sql` | Adds `telegram_file_id` + `telegram_message_id` columns untuk cloud photo storage |
| 003 | `migrations/003_chatbot.sql` | Creates `chatbot_chats` + `chatbot_messages` tables dengan RLS & Realtime |
| 004 | `migrations/004_routine_extras.sql` | Adds `morning_routine` + `night_routine` columns ke `skincare_routines` (dropped, merged into seed script) |
| 005 | `migrations/005_gdrive_storage.sql` | Adds `gdrive_file_id` + `gdrive_url` + partial index (abandoned — Google Drive approach failed with 403 storage quota) |
| 006 | `supabase/migrations/006_purge_telegram.sql` | ***DESTRUCTIVE*** — Deletes rows without `gdrive_file_id`, drops `telegram_file_id` + `telegram_message_id` (already applied, 8 rows remain) |
| 007 | `supabase/migrations/007_add_telegram_file_id.sql` | Restores `telegram_file_id` column + partial index (reverted back to Telegram) |

---

## 5. PWA Features

- **Manifest:** standalone display, portrait-primary orientation, `#95B4C6` theme color
- **Service Worker:**
  - Cache name: `licin-v2`
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
- Desktop-first design (1440x1024px viewport)
- Flexbox layout: sidebar + main content area
- Shared `.app-layout`, `.app-main`, `.app-content` classes
- Blurred gradient background across all pages

### 6.3 Responsive Status
| Page | CSS Files | Responsive |
|---|---|---|
| Loading | `loading.css` |  Ya |
| Login | `login.css`, `login-mobile.css` |  Ya |
| Home | `home.css`, `home-mobile.css` |  Ya |
| Scan — Skin Type | `scan.css`, `scan-mobile.css` |  Ya |
| Scan — Camera | `scan-page.css` |  Ya |
| Artikel | `artikel.css`, `artikel-mobile.css` |  Ya |
| Community | `community.css`, `community-mobile.css` |  Ya |
| Chatbot | `chatbot.css`, `chatbot-mobile.css` |  Ya |
| Profile | `profile.css`, `profile-mobile.css` |  Ya |
| Account | `account.css`, `account-mobile.css` |  Ya |
| Tips & Artikel | `artikel.css` |  Belum |

**Catatan:** Dari 11 halaman, 10 sudah punya mobile CSS, mayoritas sudah responsive. Hanya `tips-artikel` yang belum di-breakpoint.

### 6.4 Component Architecture
- `sidebar.js` — Sidebar component (JS-rendered, 5 nav items + mascot)
- `header.js` — Header component (JS-rendered, greeting + notification/avatar)
- `router.js` — Client-side SPA routing with transitions
- Komponen layout (`components/layout/`) dan UI (`components/ui/`) — sudah ada direktori tapi masih kosong (belum dipisah dari halaman)

---

## 7. Non-Functional Requirements

1. **Performance:** Loading progress simulation, <10s total analysis time
2. **Offline Support:** Service Worker caching enables core functionality offline
3. **Browser Support:** Modern Chromium-based browsers (Chrome, Edge)
4. **Security:**
   - Supabase Auth dengan JWT tokens
   - Row Level Security (RLS) pada semua tables
   - Telegram bot token server-side only
   - API keys via environment variables
5. **Scalability:** Zero markup changes required when swapping endpoints
6. **Data Privacy:** Free models (Zen) collect data for improvement - jangan kirim data sensitif

---

## 8. Milestones & Roadmap

### Phase 1 (Completed) — Frontend Mock

#### Page Implementation Status
| # | Page | Status | Responsive | Notes |
|---|---|---|---|---|
| 3.1 | Loading |  Built |  Ya | Progress bar, mascot, animated shapes, auto-redirect |
| 3.2 | Login |  Built |  Ya | SVG card shapes, flip animation, Supabase Auth |
| 3.3 | Home |  Built |  Ya | Skin diary, donut chart, progress table |
| 3.4 | Scan — Skin Type |  Built |  Ya | 6 skin types, confirm toast |
| 3.5 | Scan — Camera |  Built |  Ya | Camera, client-side & server-side ML, Telegram photo storage |
| 3.6 | Artikel |  Built |  Ya | Tag filter, search, 18+ artikel, detail view, bilingual |
| 3.7 | Community |  Built |  Ya | Three-panel: channels, topics, chat |
| 3.8 | Chatbot |  Built |  Ya | Full chatbot dengan Supabase, Realtime, emoji picker |
| 3.9 | Profile |  Built |  Ya | Avatar, account toggle, skin score, routine, settings |
| 3.10 | Account |  Built |  Ya | Data form, skin type selector, mascot, settings |
| 3.11 | Tips & Artikel |  Built |  Ya | Static article, three-column layout |

#### Infrastructure Status
- [x] 10 pages built with Alpine.js + HTMX (+ 1 chatbot page baru)
- [x] Supabase Auth integration (IS_MOCK_MODE: false)
- [x] Supabase client (supabase-client.js via ESM)
- [x] Auth store with session restore, SIGNED_IN/SIGNED_OUT/TOKEN_REFRESHED events
- [x] OAuth redirect handling (#access_token= hash detection)
- [x] Mock Node.js server (mock/server.js, port 8001)
- [x] Vercel Serverless API (api/index.js) dengan vercel.json rewrites
- [x] ML API — FastAPI + YOLO (ml-api/main.py + best.pt) — Docker-ready
- [x] Client-side SkinAnalyzer (assets/js/ml/skin-analyzer.js)
- [x] PWA manifest + Service Worker (licin-v2) + offline page
- [x] Article library (18 local + 31 via Supabase upload)
- [x] Community chat UI (3 channels + seed data)
- [x] Chatbot page with Supabase Realtime + polling fallback
- [x] Emoji picker (9 categories)
- [x] Sidebar component (JS-rendered, 5 nav items + mascot)
- [x] Header component (greeting + notification/avatar)
- [x] Blurred gradient background component
- [x] Alpine stores: ui.store (toasts, theme), auth.store (Supabase Auth)
- [x] Centralized config: config/app.config.js
- [x] .env file (Supabase keys, Telegram bot, ZenMux API key)
- [x] Database migrations: 001–007 (scan_results, chatbot, gdrive, telegram)
- [x] Python seed scripts: seed_routines.py, upload_articles.py
- [x] Telegram Bot photo proxy (send-photo — auth required, photo — public)
- [x] Mock server (mock/server.js) sync with production API routes (Telegram, not GDrive)
- [x] E2E Playwright test — Telegram upload + display flow verified (2026-06-28)
- [x] PWA icons: icon-192.png, icon-512.png (generated)
- [x] iOS meta tags: apple-touch-icon, apple-mobile-web-app-capable
- [x] Install prompt banner (install-prompt.js + beforeinstallprompt handler)
- [x] XSS fix: index.html line 53 changed from x-html to x-text
- [x] Auth middleware: POST endpoints protected, GET /api/telegram/photo public (img src limitation)
- [x] Diary grid fix: pickBestScan() prioritizes scans with telegram_file_id
- [x] 10/11 pages sudah responsive (tips-artikel sudah responsive)

#### Known Issues

- [ ] **Account toggle form belum save** — Profile page Account mode toggle works (show/hide), tapi Save button hanya console.log
- [ ] **Komponen belum dipisah** — `components/layout/` dan `components/ui/` masih kosong, komponen masih embedded di halaman
- [x] **Telegram fallback di home.js** — Fixed via pickBestScan() — memilih scan dengan telegram_file_id, skip yang tidak punya foto.
- [x] **Chatbot bot reply** — Sudah diganti AI-powered via DG-AI API (gpt-oss-120b, 60k req/day free, no auth)
- [x] **XSS via x-html** — index.html line 53, fixed by changing to x-text + white-space:pre-line
- [x] **Diary grid foto tidak tampil** — Karena scan lama tidak punya telegram_file_id. Fixed via pickBestScan() helper.
- [x] **API key rotation** — rotate-zen-keys.sh di ~/.config/opencode/ sudah dihapus. Key marketku diperbarui. Cause: shell script auto-rotates API keys on restart.

### Phase 2 — Backend Integration (In Progress)

| Item | Status | Notes |
|---|---|---|
| Supabase Auth |  Done | Email/password + OAuth |
| Database tables |  Done | scan_results, chatbot_chats, chatbot_messages, skincare_routines, articles |
| ML API (YOLO) |  Done | FastAPI + best.pt, Docker-ready |
| Vercel deployment |  Done | Rewrites + serverless API |
| Chatbot Realtime |  Done | Supabase postgres_changes subscription |
| Telegram photo storage |  Done | Bot proxy endpoints |
| PWA setup |  Done | Icons, iOS meta tags, install prompt |
| Mock-Prod sync |  Done | mock/server.js routes synced with api/index.js (Telegram) |
| E2E testing |  Done | Playwright test: upload + display verified (2026-06-28) |
| Security fixes |  Done | XSS fixed, auth middleware on POST, BOT_TOKEN naming |

### Phase 3 — Production Polish

- [ ] **Push notifications** — Re-engage users with scan reminders
- [ ] **Component extraction** — Pisahkan komponen dari halaman ke `components/`
- [ ] **Account form save** — Integrasi Save button dengan Supabase
- [ ] **Annotated image caching** — Optimasi penyimpanan annotated images
- [ ] **Automated testing** — E2E tests dengan Playwright (playwright dependency sudah ada)
- [ ] **CI/CD** — Auto-deploy ke Vercel + Hugging Face Spaces

---

## 9. Environment & Secrets

| Variable | Source | Used In |
|---|---|---|
| `SUPABASE_URL` | `.env` | Supabase client + scripts |
| `SUPABASE_ANON_KEY` | `.env` | Supabase client (frontend) |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env` | Seed scripts (admin) |
| `TELEGRAM_BOT_TOKEN` | `.env` | Vercel API + Mock server (fallback: `BOT_TOKEN`) |
| `TELEGRAM_CHAT_ID` | `.env` | Vercel API + Mock server (chat ID: 6265895260) |

| `ZENMUX_API_KEY` | `.env` | Future AI chatbot integration |

---

## 10. Cost Analysis — AI Chatbot

### Opsi Free — DG-AI (Aktif Saat Ini)
| Item | Detail |
|---|---|
| Model | gpt-oss-120b (OpenAI-compatible) |
| API | `https://dg-ai.scriptsnsenses.workers.dev/v1/chat/completions` |
| Pricing | **Free** (no API key required) |
| Context | Last 5 messages sebagai konteks |
| Limit | ~60,000 request per hari |
| Multi-akun | Tidak perlu (1 global endpoint) |
| Risiko | Worker bisa down, rate limit unknown |

### Opsi Free Model (MiMo V2.5 Free via OpenCode Zen)
| Item | Detail |
|---|---|
| Model | MiMo V2.5 Free (Xiaomi) |
| API | `https://opencode.ai/zen/v1/chat/completions` |
| Pricing | **Free** (promo terbatas) |
| Context | 200K tokens |
| Limit | ~200 request per akun, per-IP rate limit |
| Multi-akun | Bisa scaling horizontal dengan pool API key |
| Risiko | Promo bisa berakhir, rate limit agresif, data dikumpulkan |

### Opsi Paid (OpenCode Go / Direct API)
| Item | Detail |
|---|---|
| Go Subscription | $10/bulan — 30k+ req/5 jam |
| Direct Xiaomi API | Input $0.14/1M, Output $0.28/1M (setelah diskon 99%) |

**Rekomendasi:** DG-AI cukup untuk prototyping dengan 60k req/hari gratis tanpa auth. Untuk production, upgrade ke OpenCode Go ($10/bulan) atau langsung Xiaomi API.

---

*Prepared: June 24, 2026*
*Project Path: /Hackathon/project*
