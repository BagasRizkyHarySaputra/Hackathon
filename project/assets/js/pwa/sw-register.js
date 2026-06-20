/**
 * ============================================================
 * FILE: assets/js/pwa/sw-register.js
 * ============================================================
 * FEATURE: Service Worker Registration
 *
 * PURPOSE:
 *   Registers the Service Worker when the browser supports it.
 *   Logs registration success or failure using the scoped logger.
 *
 * DEPENDENCIES:
 *   - config/app.config.js (SW_CACHE_NAME)
 *   - Browser Service Worker API
 *
 * PHASE: Frontend (Mock) — Works with mock or real server
 * ============================================================
 */

/**
 * Registers the Service Worker if supported by the browser.
 * Called once on DOMContentLoaded from index.html.
 *
 * @returns {Promise<void>}
 */
async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.warn('[WARN] [PWA] Service Worker not supported in this browser.');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    console.log('[INFO] [PWA] Service Worker registered successfully.', {
      scope: registration.scope,
      cacheName: APP_CONFIG.SW_CACHE_NAME,
    });
  } catch (error) {
    console.error('[ERROR] [PWA] Service Worker registration failed.', {
      error: error.message,
    });
  }
}
