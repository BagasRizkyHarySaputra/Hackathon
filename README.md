# LICIN

> Smart community platform with real-time chat, polls, and AI-powered features — available as PWA and desktop app.

LICIN is a modern progressive web app (PWA) that combines community management with smart tools. Built for both **phone** (PWA with home screen install) and **desktop** (Tauri v2 native app with auto-updates).

## Features

** Community**
- **Channels** — Create and join topic-based channels
- **Topics** — Threaded discussions within channels
- **Polls & Voting** — Create polls with multiple options, real-time vote counting
- **Real-time Chat** — Live messaging powered by Supabase Realtime

** Smart Features**
- **AI-powered scanning** — ML API integration for intelligent content processing
- **Smart notifications** — Context-aware alerts
- **Auto-updates** — Desktop app updates via GitHub Releases (Tauri updater)

** Platform**
- **PWA** — Install on any phone via browser (Chrome/Safari)
- **Desktop** — Native apps for Windows, macOS, Linux (~5MB)
- **Cloud sync** — Real-time sync across all devices via Supabase

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Alpine.js, Vanilla JS, CSS |
| Backend | Node.js API, Python (ML) |
| Database | Supabase (PostgreSQL) |
| Real-time | Supabase Realtime |
| Desktop | Tauri v2 (Rust) |
| Auth | Supabase Auth |
| CI/CD | GitHub Actions |
| Hosting | Vercel (web), GitHub Pages (docs) |

## Quick Start

```bash
# Clone
git clone https://github.com/BagasRizkyHarySaputra/Hackathon.git
cd Hackathon/project

# Install dependencies
npm install

# Run dev server
python -m http.server 3000
# Open http://localhost:3000
```

### Desktop App (Tauri)

```bash
# Prerequisites: Rust, webkit2gtk-4.1 (Linux)
npm install
npx tauri dev     # Dev mode
npx tauri build   # Production build → src-tauri/target/release/
```

> **Note:** Desktop builds require system dependencies. See [Tauri docs](https://v2.tauri.app/start/prerequisites/) for your platform.

## Project Structure

```
project/
├── api/                  # Node.js API endpoints
├── assets/               # CSS, JS, icons
│   ├── css/components/   # Component styles
│   ├── js/alpine/        # Alpine.js stores & components
│   └── icons/            # App icons, nav icons
├── pages/                # HTML pages
│   ├── community/        # Community features
│   └── download/         # Download page
├── src-tauri/            # Tauri v2 desktop app (Rust)
│   ├── src/              # Rust source
│   ├── icons/            # Platform icons
│   └── tauri.conf.json   # Tauri config
├── supabase/             # Database migrations
├── migrations/           # Legacy migrations
├── ml-api/               # Python ML API
├── mock/                 # Mock server for testing
├── .github/workflows/    # CI/CD pipelines
│   ├── desktop-release.yml  # Tauri auto-build on tags
│   └── pwa-deploy.yml       # GitHub Pages deployment
└── vercel.json           # Vercel deployment config
```

## Deployment

### Web (Vercel)

The web app auto-deploys via Vercel on push to `main`:
- **URL:** [licin.vercel.app](https://licin.vercel.app)

### Desktop (GitHub Releases)

Tag a release to trigger the Tauri build pipeline:
```bash
git tag v0.1.0
git push origin v0.1.0
```

This runs `.github/workflows/desktop-release.yml` and produces:
- Windows: `.msi` installer
- macOS: `.dmg` bundle
- Linux: `.AppImage` and `.deb`

### Phone (PWA)

Open [licin.vercel.app](https://licin.vercel.app) in Chrome/Safari → Add to Home Screen.
Full offline support, push notifications, and camera access included.

## Download

Get the latest release: [Download LICIN](https://github.com/BagasRizkyHarySaputra/Hackathon/releases/latest)

Or install as PWA directly from [licin.vercel.app](https://licin.vercel.app).

## Contributing

1. Fork the repo
2. Create your feature branch (`git checkout -b feat/amazing`)
3. Commit changes (`git commit -m 'feat: add amazing feature'`)
4. Push to branch (`git push origin feat/amazing`)
5. Open a Pull Request

We follow [Conventional Commits](https://www.conventionalcommits.org/) for commit messages.

## License

MIT — see [LICENSE](LICENSE) for details.

---

<p align="center">
  Built with  for the community
</p>
