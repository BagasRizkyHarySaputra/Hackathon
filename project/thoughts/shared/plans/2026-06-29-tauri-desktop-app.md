# Implementation Plan: Tauri Desktop App for LICIN

## Overview
Wrap the existing LICIN PWA in Tauri v2 native desktop app with auto-updater from GitHub Releases.

## Prerequisites
- Rust toolchain (`rustup` + `cargo`)
- Tauri CLI v2 (`cargo install tauri-cli --version "^2"`)
- For Windows: WebView2 (pre-installed on Windows 10+)
- For macOS: Xcode Command Line Tools

## Steps

### Step 1: Initialize Tauri v2 project
```
cd /Hackathon/project
cargo tauri init
```
- App name: LICIN
- Window title: LICIN
- Dev URL: http://localhost:3000 (adjust if different)
- Build URL: https://licin.vercel.app (production)
- App identifier: com.licin.app

### Step 2: Configure tauri.conf.json
- Set window size 390x844 (mobile-first), resizable
- Enable security: CSP, allowed URLs
- Set bundle targets: msi (Windows), dmg (macOS), AppImage (Linux)
- Add updater plugin configuration pointing to GitHub Releases

### Step 3: Add updater plugin
```
cargo add tauri-plugin-updater
```
- Implement update check on app startup
- Show native dialog when update is available
- Handle download and install flow

### Step 4: Create app icons
- Generate platform-specific icons from the existing 512x512 icon
- Place in src-tauri/icons/

### Step 5: Create GitHub Actions workflow
- File: .github/workflows/desktop-release.yml
- Trigger: push tags (v*)
- Matrix: ubuntu, macos, windows-latest
- Steps: checkout, install Rust, build, upload artifacts to Release

### Step 6: Create /download page
- File: pages/download/index.html
- Matches existing LICIN design system
- Lists platform-specific download links
- Shows current version
- Links to GitHub Releases page

### Step 7: Update vercel.json
- Add rewrite rule: /download → /pages/download/index.html

### Step 8: Test build locally
```
cargo tauri build
```
- Verify installer is created
- Verify app launches and loads web content

## Verification
- App launches in native window
- All routes work (home, scan, community, profile, etc.)
- Auto-updater dialog appears when newer tag exists
- Service worker still functions for offline
- Login flow works in WebView context
