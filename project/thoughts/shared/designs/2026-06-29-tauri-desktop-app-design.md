---
date: 2026-06-29
topic: "Tauri Desktop App Integration for LICIN"
status: validated
---

## Problem Statement

LICIN is currently a PWA accessible via browser (Vercel) and installable via Chrome/Edge's built-in PWA prompt. However, there's no true native desktop installer (EXE/MSI/DMG) that users can download and run like a regular app. The user wants a downloadable desktop version that stays in sync with the web version and auto-updates.

## Constraints

- **Existing web app MUST NOT change** — Vercel auto-deploy from `main` is the existing workflow; Tauri wraps the same code
- **Native app must auto-update** — users shouldn't manually re-download when a new version is released
- **No heavy bundles** — keep the desktop app small (Tauri targets ~5MB, not Electron's ~150MB)
- **Same codebase** — no separate repo or branch for desktop; Tauri config lives alongside web code
- **Must work with existing PWA setup** — service worker, manifest, install prompt all stay untouched

## Approach

**Chosen: Tauri v2 with built-in updater plugin** — wraps existing LICIN web app as a native WebView window with auto-update capability from GitHub Releases.

**Why not alternatives:**

- **Electron:** 150MB+ bundle, heavier memory usage, overkill for a PWA wrapper
- **PWABuilder (only):** good for store distribution but no auto-update mechanism; user would need to manually check for new versions
- **NativeScript/React Native:** completely different dev model, way too heavy for this use case

Tauri gives us:
- A ~5MB native installer
- Built-in updater plugin (checks GitHub Releases on startup)
- System tray, native menus, deep link support if needed later
- Rust-based for security (no Node.js in the runtime)

## Architecture

```
LICIN Codebase (existing)
│
├── Web (Vercel) ← main branch → auto-deploy
│   └── index.html + assets + sw.js + manifest.json
│
├── src-tauri/ (NEW)
│   ├── tauri.conf.json        — Window config, app identifier
│   ├── capabilities/          — Permission manifests
│   ├── icons/                 — App icons for each platform
│   ├── src/lib.rs             — Rust entrypoint (minimal)
│   └── Cargo.toml             — Rust dependencies
│
├── .github/workflows/ (NEW)
│   └── desktop-release.yml    — Build + upload on git tag
│
└── pages/download/ (NEW)
    └── index.html             — Download page listing installers
```

**Key insight:** Tauri is NOT a build-time bundler. It's a native app framework. The `src-tauri/` directory configures a Rust binary that creates a WebView window pointed at the LICIN web app. For production, it loads from the deployed Vercel URL. For development, it loads from localhost.

## Components

### 1. Tauri Configuration (`src-tauri/tauri.conf.json`)

The configuration file defines everything about the native window:

- **Window settings:** title ("LICIN"), size (390x844 default for mobile-first), min size, resizable
- **App identifier:** `com.licin.app` — used for OS-level identification
- **Security:** CSP headers, allowed URLs (only the deployed Vercel domain + localhost for dev)
- **Updater:** endpoint pointing to GitHub Releases API
- **Bundle config:** Windows (.msi/.exe), macOS (.dmg), Linux (.AppImage)

### 2. Updater Integration

The `@tauri-apps/plugin-updater` plugin provides:

- **Startup check:** On app launch, queries the latest GitHub Release tag
- **Version comparison:** Compares installed version vs latest release
- **Update dialog:** Native modal showing changelog + "Install Now" / "Skip" buttons
- **Silent download:** Downloads the new installer in the background
- **Auto-restart:** After download completes, installs and restarts the app

**Update flow:**
```
App startup
  → updater.check() → GET /repos/.../releases/latest
  → Compare semver
  → [New version found] → Show modal
     → "Download" → download + verify hash
     → "Install" → quit + launch installer
  → [No update] → proceed normally
```

### 3. GitHub Actions Workflow

Triggered on `git push --tags` (e.g., `v1.2.0`):

```
Job: build-desktop
  Strategy matrix: [ubuntu, macos, windows]
  Steps:
    1. Checkout code
    2. Install Rust toolchain
    3. Install Tauri CLI
    4. Build app for platform
    5. Sign binaries (optional, can add later)
    6. Upload artifacts to GitHub Release
    7. Attach release notes from CHANGELOG or tag message
```

Result: each tag produces `.msi` / `.dmg` / `.AppImage` attached to the Release.

### 4. Download Page (`/download`)

A simple static page at `/pages/download/index.html` accessible from the web app:

- Lists available installers for each platform
- Links to the latest GitHub Release
- Shows current version number
- "Download for Windows" / "Download for macOS" / "Download for Linux" buttons
- Also explains: "Or install from browser via PWA"
- Styled to match LICIN's existing design system

### 5. Development Integration

No changes to the existing dev workflow:

- `npm run dev` stays the same (if any) — serves web app on localhost
- `npx tauri dev` — opens native window pointed at web app
- `npx tauri build` — produces platform installer
- Web changes → test in browser → commit → Vercel deploys → Tauri build picks up latest

## Data Flow

### First-time User Journey

```
1. User discovers LICIN via web or referral
2. Visits licin.vercel.app
3. Sees "Download App" link in nav or /download page
4. Clicks "Download for Windows" → downloads .msi
5. Runs installer → LICIN appears as native app
6. App starts → WebView loads licin.vercel.app
7. Service worker kicks in for offline support
8. Updater checks for updates (none yet) → app runs
```

### Update Journey

```
1. Developer: git tag v1.2.0 && git push origin v1.2.0
2. GitHub Actions builds Windows + macOS + Linux installers
3. Artifacts uploaded to GitHub Release
4. User opens LICIN desktop app
5. Updater finds v1.2.0 > v1.1.0
6. Native dialog: "Update available: v1.2.0 — Install Now?"
7. User clicks Install → downloads, installs, restarts
8. App now on v1.2.0
```

## Error Handling

| Scenario | Behavior |
|---|---|
| GitHub Releases unreachable | App starts normally, logs error, suppresses update check |
| Download fails / corrupted | Updater retries; if hash mismatch, shows "Download Failed, try again" |
| No network at startup | Silent skip — update check fails gracefully, no error shown |
| Older OS version | Tauri build targets minimum OS versions (Windows 10+, macOS 10.15+) |
| WebView not available | Handled by Tauri's system webview requirement (Edge WebView2 on Windows) |
| App already open | Single-instance lock via Tauri plugin (no duplicate windows) |

## Testing Approach

### Manual Testing

1. **Dev mode:** `npx tauri dev` — opens window, verify all routes work
2. **Build test:** `npx tauri build` — produces installer, verify it installs
3. **Update test:** tag a test version, verify updater dialog appears
4. **PWA compatibility:** service worker still works inside Tauri WebView
5. **Login flow:** OAuth redirects still work in WebView context
6. **Camera/sensor:** Tauri has its own permission system — test scan-page

### CI Testing

GitHub Actions build on every tag — verify:
- Build succeeds on all 3 platforms
- Artifacts are attached to Release
- Release notes are populated

### Checklist before first public release

- [ ] App launches and loads LICIN web app
- [ ] All navigation routes work
- [ ] Login/auth flow works in WebView
- [ ] Camera/scan feature works
- [ ] Community page loads correctly
- [ ] PWA offline mode still functions
- [ ] Updater detects new version
- [ ] Install and uninstall cleanly
- [ ] App icon shows correctly in taskbar/dock

## File Structure Changes

```
NEW FILES:
  src-tauri/
    Cargo.toml                    — Rust dependencies
    tauri.conf.json               — App configuration
    build.rs                      — Tauri build script
    capabilities/default.json     — Permission manifest
    icons/
      icon.png                    — App icon (1024x1024 source)
      icon.ico                    — Windows icon
      icon.icns                   — macOS icon
      icon.icns                   — macOS icon
      32x32.png, 128x128.png, etc — Platform-specific sizes
    src/
      lib.rs                      — Rust entry point (minimal)
      main.rs                     — Binary entrypoint

  .github/workflows/
    desktop-release.yml           — Build + deploy workflow

  pages/download/
    index.html                    — Download page

MODIFIED FILES:
  vercel.json                     — Add /download route
  (none else — existing web app untouched)
```

## Open Questions

1. **Environment variables for API keys?** — Currently the web app uses Supabase client-side keys. In Tauri, we'll load from the same env sources (no change needed).
2. **Camera permissions on macOS?** — Tauri v2 has a permission API; we'll need to handle camera permission request for scan feature.
3. **Splash screen?** — Optional Tauri plugin for native splash screen during app load. Not critical for MVP, can add later.
4. **Signing/notarization?** — For Mac, we'll eventually need an Apple Developer account for notarization. MVP can skip this (user gets "unverified developer" warning).
