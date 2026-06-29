# LICIN - Product Requirements Document

**Version:** 1.0  
**Last Updated:** June 28, 2026  
**Status:** In Development (MVP Complete)

---

## 1. Product Overview

### 1.1 Product Name
**LICIN** - AI-Powered Skin Analysis & Glow Detection PWA

### 1.2 Product Vision
LICIN is a Progressive Web Application that empowers users to monitor and improve their skin health through AI-powered analysis. Using advanced YOLO-based computer vision, LICIN detects acne, analyzes skin conditions across 9 facial zones, and provides personalized skincare recommendations.

### 1.3 Target Users
- Young adults (18-35) concerned about skin health
- People seeking personalized skincare guidance
- Users wanting to track skin improvement over time
- Mobile-first users who prefer PWA over native apps

### 1.4 Core Value Proposition
- **Instant Analysis**: Real-time skin scanning with AI-powered detection
- **Personalized Insights**: Zone-specific analysis and recommendations
- **Progress Tracking**: Historical data to monitor skin improvements
- **Accessible**: Free, web-based, works offline (PWA)
- **Privacy-First**: Data stored securely in Supabase with RLS

---

## 2. Technical Architecture

### 2.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         FRONTEND                            │
│  HTMX + Alpine.js + Static HTML (No Build Step)           │
│  Pages: Loading, Login, Home, Scan, Profile, Community     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    API LAYER (Vercel)                       │
│  • /api/ml/analyze → Proxy to Hugging Face ML API         │
│  • /api/telegram/* → Photo storage proxy                   │
│  • /api/chat/*     → Chat endpoints                        │
│  • /api/*/partial  → HTMX partial endpoints                │
└────────────────────┬────────────────────────────────────────┘
                     │
          ┌──────────┼──────────┐
          ▼          ▼          ▼
┌─────────────┐ ┌─────────────┐ ┌──────────────────┐
│  Supabase   │ │ Hugging Face│ │  Telegram Bot    │
│  Database   │ │  ML API     │ │  Photo Storage   │
│  + Auth     │ │  (YOLO)     │ │  (Unlimited)     │
└─────────────┘ └─────────────┘ └──────────────────┘
```

### 2.2 Technology Stack

**Frontend:**
- **HTMX** - Server-driven HTML over the wire (no React/Vue)
- **Alpine.js** - Minimal reactive JavaScript framework
- **Vanilla JavaScript** - ES6 modules, no build step
- **Progressive Web App** - Service Worker, offline support, installable

**Backend:**
- **Vercel Serverless Functions** - Production API (`/api/index.js`)
- **Node.js Express-like Mock Server** - Local development (`mock/server.js`)
- **Supabase** - PostgreSQL database + authentication + RLS

**ML/AI:**
- **Hugging Face Spaces** - YOLO-based skin analysis API
- **Docker** - ML API containerization (FastAPI + YOLOv8)
- **URL:** `https://de13ugg1ng-licin-ml-api.hf.space`

**Infrastructure:**
- **Vercel** - Frontend + API hosting (auto-deploy from git)
- **Telegram Bot API** - Unlimited photo storage via bot proxy
- **HTTPS** - Self-signed certs for local dev, Let's Encrypt for production

### 2.3 Key Architectural Decisions

**Decision 1: HTMX over React**
- **Rationale:** Simpler, no build step, faster initial load, server-driven
- **Trade-off:** Less client-side interactivity, more server requests
- **Outcome:**  Faster development, easier maintenance

**Decision 2: Hugging Face ML API (Remote) over Local**
- **Rationale:** No GPU requirements, auto-scaling, zero server costs
- **Trade-off:** Network latency, dependency on external service
- **Outcome:**  Works reliably with IPv4 fix (family: 4 in https.request)

**Decision 3: Telegram Bot for Photo Storage**
- **Rationale:** Unlimited storage, free, simple API, automatic CDN
- **Trade-off:** Requires bot token, photos stored on Telegram servers
- **Outcome:**  Zero storage costs, fast retrieval via file_id

**Decision 4: Supabase over Custom Backend**
- **Rationale:** Built-in auth, RLS, real-time, PostgreSQL, free tier
- **Trade-off:** Vendor lock-in, learning curve for RLS policies
- **Outcome:**  Rapid development, production-ready auth out of the box

---

## 3. Features

### 3.1 MVP Features (Implemented)

#### F1: User Authentication
- **Status:**  Implemented
- **Description:** Supabase Auth with email/password
- **Endpoints:**
  - `POST /api/auth/login` - User login
  - `GET /api/profile/partial` - User profile data
- **Database Tables:**
  - `profiles` (user_id, full_name, username, bio, avatar_url, scan_completed)

#### F2: Skin Scanning & Analysis
- **Status:**  Implemented
- **Description:** Camera-based photo capture → ML analysis → annotated results
- **Flow:**
  1. User opens `/scan` page
  2. Camera captures photo (or uploads existing)
  3. Photo sent to `/api/ml/analyze` (proxied to Hugging Face)
  4. ML API returns:
     - Acne markers (bounding boxes)
     - 9-zone grid analysis (forehead, cheeks, chin, nose, etc.)
     - Health score (0-100)
     - Annotated image with overlays
     - Personalized recommendations
  5. Results saved to `scan_results` table
  6. Profile marked `scan_completed=true`
- **Technical Details:**
  - **ML Model:** YOLOv8 trained on acne dataset
  - **Input:** JPEG/PNG image via multipart/form-data (field: `file`)
  - **Output:** JSON with markers, zones, health_score, annotated_image (base64)
  - **Proxy:** `/api/ml/analyze` → `https://de13ugg1ng-licin-ml-api.hf.space/analyze`
  - **IPv4 Fix:** `family: 4` in https.request to avoid IPv6 timeout issues

#### F3: Results Display
- **Status:**  Implemented
- **Description:** Visual display of analysis results with annotated image
- **Components:**
  - Annotated photo with acne markers
  - Health score gauge (0-100)
  - Zone-by-zone breakdown (9 facial regions)
  - Personalized skincare recommendations
  - Issues found summary

#### F4: Photo Storage (Telegram Proxy)
- **Status:**  Implemented
- **Description:** Photos uploaded to Telegram Bot API for unlimited storage
- **Endpoints:**
  - `POST /api/telegram/send-photo` - Upload base64 image → get file_id
  - `GET /api/telegram/photo?file_id=XXX` - Retrieve image by file_id
- **Technical Details:**
  - Bot Token: `process.env.TELEGRAM_BOT_TOKEN`
  - Chat ID: `process.env.TELEGRAM_CHAT_ID`
  - Returns largest photo `file_id` for reference
  - Proxy keeps bot token server-side (security)

#### F5: Community & Chat
- **Status:**  Implemented
- **Description:** In-app chat with mock data (ready for real-time upgrade)
- **Endpoints:**
  - `POST /api/chat/send` - Send message
  - `GET /api/chat/history?chat_id=XXX` - Get chat history
- **Database Tables:**
  - `db-sementara/community.json` (mock seed data)
  - `db-sementara/chatbot.json` (mock chatbot responses)

#### F6: Progressive Web App (PWA)
- **Status:**  Implemented
- **Description:** Installable, offline-capable, app-like experience
- **Files:**
  - `/sw.js` - Service Worker (cache-first strategy)
  - `/manifest.json` - App manifest (icons, theme, name)
  - `/offline.html` - Offline fallback page
- **Features:**
  - Install prompt on supported browsers
  - Offline page loading
  - Asset caching (CSS, JS, images)

### 3.2 Features In Progress

#### F7: Historical Scan Tracking
- **Status:**  Database ready, UI pending
- **Description:** Track skin improvements over time with before/after comparisons
- **Database Tables:**
  - `scan_results` (id, user_id, health_score, acne_count, scan_date, photo_file_id)

#### F8: Real-time Chat (Supabase Realtime)
- **Status:**  Mock implemented, Supabase integration pending
- **Description:** Upgrade from mock chat to real-time Supabase channels

### 3.3 Future Features (Roadmap)

- **AI Skincare Recommendations:** GPT-based personalized advice
- **Product Database:** Link recommendations to actual skincare products
- **Dermatologist Consultation:** In-app booking and telemedicine
- **Social Sharing:** Share progress with friends (privacy-controlled)
- **Push Notifications:** Remind users to scan regularly

---

## 4. API Endpoints

### 4.1 ML Analysis API

**Endpoint:** `POST /api/ml/analyze`  
**Proxy Target:** `https://de13ugg1ng-licin-ml-api.hf.space/analyze`  
**Content-Type:** `multipart/form-data`  

**Request Body:**
```
file: <binary image data> (JPEG/PNG)
```

**Response (200 OK):**
```json
{
  "markers": [
    {"x": 120, "y": 150, "width": 30, "height": 30, "confidence": 0.92}
  ],
  "acne_counts": {"total": 5, "mild": 3, "moderate": 2, "severe": 0},
  "health_score": {"overall": 78, "forehead": 85, "left_cheek": 72, ...},
  "annotated_image": "data:image/jpeg;base64,/9j/4AAQ...",
  "recommendations": ["Use salicylic acid cleanser", "Apply sunscreen daily"],
  "issues_found": ["Mild acne on left cheek", "Dry patches on forehead"],
  "grid_stats": [
    {"zone": "forehead", "acne_count": 1, "health_score": 85},
    ...
  ]
}
```

**Error Responses:**
- `400 Bad Request` - Missing or invalid file
- `502 Bad Gateway` - ML API unavailable or timeout
- `504 Gateway Timeout` - ML API took too long

---

### 4.2 Telegram Photo Storage API

**Endpoint:** `POST /api/telegram/send-photo`  
**Description:** Upload base64 image to Telegram for unlimited storage  
**Content-Type:** `application/json`

**Request Body:**
```json
{
  "photo": "data:image/jpeg;base64,/9j/4AAQ..."
}
```

**Response (200 OK):**
```json
{
  "ok": true,
  "file_id": "AgACAgIAAxkBAAIB...",
  "file_unique_id": "AQADBAADyq4xG-Q",
  "width": 1280,
  "height": 720,
  "message_id": 12345
}
```

**Endpoint:** `GET /api/telegram/photo?file_id=XXX`  
**Description:** Retrieve photo by file_id  
**Response:** Image binary (JPEG/PNG)

---

### 4.3 Chat API

**Endpoint:** `POST /api/chat/send`  
**Request Body:**
```json
{
  "chat_id": "general",
  "text": "Hello, community!"
}
```

**Response:**
```json
{
  "sent": {
    "id": 1735401234567,
    "type": "sent",
    "text": "Hello, community!",
    "timestamp": "2026-06-28T12:00:00.000Z"
  },
  "reply": {
    "id": 1735401234568,
    "type": "received",
    "text": "Meehh…",
    "timestamp": "2026-06-28T12:00:01.000Z"
  }
}
```

**Endpoint:** `GET /api/chat/history?chat_id=general`  
**Response:**
```json
{
  "chatId": "general",
  "chatType": "community",
  "messages": [
    {"id": 1, "type": "received", "text": "Welcome!", "timestamp": "..."}
  ]
}
```

---

### 4.4 HTMX Partial Endpoints

All partial endpoints return HTML fragments for HTMX to swap into the page:

- `GET /api/loading/partial` → Loading screen HTML
- `GET /api/login/partial` → Login form HTML
- `GET /api/home/partial` → Home page content
- `GET /api/scan/partial` → Scan page content
- `GET /api/profile/partial` → Profile page content
- `GET /api/community/partial` → Community feed HTML
- `GET /api/artikel/partial` → Article list HTML
- `GET /api/chatbot/partial` → Chatbot interface HTML

---

## 5. Database Schema (Supabase)

### 5.1 Tables

**profiles**
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  full_name TEXT,
  username TEXT UNIQUE,
  bio TEXT,
  avatar_url TEXT,
  scan_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**scan_results**
```sql
CREATE TABLE scan_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  health_score INTEGER,
  acne_count INTEGER,
  scan_date TIMESTAMPTZ DEFAULT NOW(),
  photo_file_id TEXT,
  analysis_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 5.2 Row Level Security (RLS)

**profiles:**
- Users can read their own profile
- Users can update their own profile
- Public read access for username lookup (community features)

**scan_results:**
- Users can only read/write their own scan results
- No public access

---

## 6. Deployment

### 6.1 Production Environment (Vercel)

**Hosting:** Vercel (https://vercel.com)  
**Auto-Deploy:** Git push to main branch triggers deployment  
**Serverless Functions:** `/api/index.js` handles all API routes  
**Static Assets:** HTML, CSS, JS, images served from Vercel CDN

### 6.2 Environment Variables (Vercel Dashboard)

**Required:**
```env
TELEGRAM_BOT_TOKEN=8987787750:AAHADzqwz95GaMKuhPOwB2CjtlLcCGDJ8No
TELEGRAM_CHAT_ID=6265895260
```

**Note:** Supabase credentials are in `config/app.config.js` (public anon key, safe to commit)

### 6.3 Deployment Checklist

- [ ] Push code to Git repository
- [ ] Add environment variables to Vercel dashboard
- [ ] Verify `vercel.json` routing configuration
- [ ] Test `/api/ml/analyze` endpoint (Hugging Face proxy)
- [ ] Test Supabase authentication
- [ ] Test Telegram photo storage
- [ ] Verify PWA manifest and service worker
- [ ] Check mobile responsiveness

### 6.4 Known Issues & Fixes

**Issue 1: IPv6 Connection Timeouts (ML API)**
- **Symptom:** `ETIMEDOUT` errors when calling Hugging Face ML API
- **Root Cause:** Node.js attempts IPv6 first, times out, falls back to IPv4 slowly
- **Fix:** Add `family: 4` to `https.request()` options in both:
  - `mock/server.js` (line ~523)
  - `api/index.js` (line ~273)

**Issue 2: CORS on ML API Direct Calls**
- **Symptom:** Browser CORS errors when frontend calls ML API directly
- **Fix:** Proxy through `/api/ml/analyze` to avoid cross-origin issues

**Issue 3: Localhost Hardcoded in app.config.js**
- **Symptom:** API calls fail on Vercel deployment
- **Fix:** Changed `API_BASE_URL: 'http://localhost:8001'` → `API_BASE_URL: ''` (relative paths)

---

## 7. Development Setup

### 7.1 Prerequisites

- **Node.js:** v18+ (v22.22.0 recommended)
- **Git:** For version control
- **Supabase Account:** Free tier sufficient
- **Telegram Bot:** Create via @BotFather on Telegram

### 7.2 Local Development

**1. Clone Repository:**
```bash
git clone <repository-url>
cd project
```

**2. Install Dependencies:**
```bash
npm install
# or
yarn install
```

**3. Configure Environment:**
Create `.env` file (optional, has fallbacks):
```env
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

**4. Start Development Server:**
```bash
node mock/server.js
```

Server starts on:
- **HTTPS:** https://localhost:8001 (self-signed cert)
- **Network:** https://192.168.1.x:8001 (accessible from mobile)

**5. Open in Browser:**
```
https://localhost:8001
```
Accept self-signed certificate warning (development only).

### 7.3 Project Structure

```
/Hackathon/project/
├── api/                      # Vercel serverless functions
│   └── index.js             # Main API handler
├── assets/                   # Static assets
│   ├── css/                 # Stylesheets
│   ├── js/                  # JavaScript modules
│   │   ├── alpine/          # Alpine.js components & stores
│   │   ├── supabase/        # Supabase client
│   │   └── components/      # Reusable components
│   └── images/              # Images, icons
├── config/                   # Configuration files
│   └── app.config.js        # Centralized app config
├── db-sementara/            # Mock database seed data
│   ├── community.json       # Community chat seed
│   └── chatbot.json         # Chatbot responses seed
├── mock/                     # Local development server
│   ├── server.js            # Express-like mock server
│   ├── data/                # Mock API responses
│   └── ssl/                 # Self-signed SSL certs
├── pages/                    # HTML pages
│   ├── loading/
│   ├── login/
│   ├── home/
│   ├── scan/
│   ├── scan-page/
│   ├── profile/
│   ├── community/
│   ├── artikel/
│   ├── chatbot/
│   └── account/
├── partials/                 # HTMX partial templates
│   ├── loading/
│   ├── login/
│   └── ...
├── vercel.json              # Vercel routing configuration
├── manifest.json            # PWA manifest
├── sw.js                    # Service Worker
├── index.html               # Root entry point
└── PRD.md                   # This document
```

### 7.4 Configuration Files

**config/app.config.js**
- **Purpose:** Single source of truth for all app configuration
- **Key Values:**
  - `API_BASE_URL: ''` - Relative API paths (works local + Vercel)
  - `SUPABASE_URL` - Supabase project URL
  - `SUPABASE_ANON_KEY` - Supabase public/anon key
  - `ML_API_URL: '/api/ml'` - ML API proxy endpoint
  - `IS_MOCK_MODE: false` - Use real Supabase (not mock auth)

**vercel.json**
- **Purpose:** Vercel routing and deployment configuration
- **Rewrites:**
  - `/api/*` → `/api/index` (serverless function)
  - `/<page>` → `/pages/<page>/index.html` (static pages)
  - `/*` → `/index.html` (fallback for root)

### 7.5 Testing

**Manual Testing Checklist:**
- [ ] User can sign up / login
- [ ] Camera opens and captures photo
- [ ] Photo uploads successfully
- [ ] ML analysis returns results
- [ ] Annotated image displays correctly
- [ ] Health score saves to database
- [ ] Profile shows scan_completed badge
- [ ] Community chat loads and sends messages
- [ ] PWA installs on mobile
- [ ] Offline mode shows fallback page

**Testing ML API Directly:**
```bash
# Test Hugging Face endpoint
curl -X POST https://de13ugg1ng-licin-ml-api.hf.space/analyze \
  -F "file=@test-image.jpg"

# Expected: JSON with markers, health_score, annotated_image
```

---

## 8. Troubleshooting

### 8.1 Common Issues

**Problem:** Mock server won't start (EADDRINUSE port 8001)  
**Solution:**
```bash
# Kill existing process
lsof -ti:8001 | xargs kill -9
# Restart server
node mock/server.js
```

**Problem:** ML API returns 502 Bad Gateway  
**Solution:**
- Check server logs for `[ML-API Proxy] Error: ETIMEDOUT`
- Verify `family: 4` is set in https.request options
- Test HF endpoint directly with curl

**Problem:** Supabase auth not working  
**Solution:**
- Check `config/app.config.js` for correct SUPABASE_URL and SUPABASE_ANON_KEY
- Verify RLS policies are enabled in Supabase dashboard
- Check browser console for auth errors

**Problem:** HTMX partials not loading  
**Solution:**
- Verify `API_BASE_URL` is empty string (relative paths)
- Check network tab for 404 errors
- Ensure partial HTML files exist in `/partials/` directory

---

## 9. Future Improvements

### 9.1 Technical Debt
- [ ] Add unit tests (Jest + Testing Library)
- [ ] Add E2E tests (Playwright)
- [ ] Implement proper error boundaries
- [ ] Add request rate limiting
- [ ] Improve ML API caching (Redis)
- [ ] Add CI/CD pipeline (GitHub Actions)

### 9.2 Performance Optimizations
- [ ] Lazy load images (Intersection Observer)
- [ ] Compress images before upload
- [ ] Add CDN for static assets
- [ ] Implement server-side caching
- [ ] Optimize ML model size

### 9.3 Feature Enhancements
- [ ] Multi-language support (i18n)
- [ ] Dark mode
- [ ] Export scan history as PDF
- [ ] Social sharing with privacy controls
- [ ] In-app product recommendations
- [ ] Dermatologist consultation booking

---

## 10. Appendix

### 10.1 Related Documentation
- [Supabase Documentation](https://supabase.com/docs)
- [HTMX Documentation](https://htmx.org/docs/)
- [Alpine.js Documentation](https://alpinejs.dev/)
- [Vercel Documentation](https://vercel.com/docs)

### 10.2 Contact & Support
- **Development Team:** [Team contact info]
- **Bug Reports:** [Issue tracker URL]
- **Feature Requests:** [Feature request form]

---

**Document End**
