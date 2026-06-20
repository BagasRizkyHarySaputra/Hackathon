/**
 * ============================================================
 * FILE: config/app.config.js
 * ============================================================
 * FEATURE: Centralized Application Configuration
 *
 * PURPOSE:
 *   Single source of truth for all configurable values in the
 *   application. All URLs, feature flags, timeouts, and constants
 *   are defined here and referenced throughout the codebase.
 *
 * USE CASES:
 *   - API base URL swapping (mock → FastAPI in Phase 2)
 *   - HTMX global default settings
 *   - PWA cache naming and offline fallback
 *   - Feature flag toggling
 *
 * DEPENDENCIES:
 *   - None (loaded first, before all other scripts)
 *
 * PHASE: Frontend (Mock) — No real backend required
 * ============================================================
 */

const APP_CONFIG = Object.freeze({
  APP_NAME: 'SkinGlow Analyzer',
  SHORT_NAME: 'SkinGlow',
  VERSION: '0.1.0',
  DESCRIPTION: 'AI-powered skin analysis and glow detection application.',

  // API — swap mock URL → real FastAPI URL in Phase 2
  API_BASE_URL: 'http://localhost:8001',
  API_TIMEOUT_MS: 10000,

  // HTMX Global Settings
  HTMX_DEFAULT_SWAP: 'innerHTML',
  HTMX_INDICATOR_CLASS: 'htmx-loading',

  // PWA
  SW_CACHE_NAME: 'skinglow-v1',
  SW_OFFLINE_URL: '/offline.html',

  // Loading Page
  LOADING_PROGRESS_INTERVAL_MS: 50,
  LOADING_SIMULATION_DURATION_MS: 3000,

  // Feature Flags
  FEATURES: {
    PUSH_NOTIFICATIONS: false,
    BACKGROUND_SYNC: false,
    INSTALL_PROMPT: true,
  },

  // Supabase — fill SUPABASE_ANON_KEY from .env
  SUPABASE_URL: 'https://gvkzgicbykyjkusxranv.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2a3pnaWNieWt5amt1c3hyYW52Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4OTg0OTAsImV4cCI6MjA5NzQ3NDQ5MH0.8DEahyrZ-IxZmuM7wVuO6-LP3K4IfX3v3eNsXnh_Hzw',

  // Mock Mode — set false in production
  IS_MOCK_MODE: true,
});
