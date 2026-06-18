/**
 * ============================================================
 * FILE: assets/js/pwa/install-prompt.js
 * ============================================================
 * FEATURE: PWA Add-to-Home-Screen Prompt Handler
 *
 * PURPOSE:
 *   Captures the browser's beforeinstallprompt event and exposes
 *   it to Alpine.js for a custom install button UI. Tracks user
 *   choice (accepted/dismissed) for analytics.
 *
 * USE CASES:
 *   - Custom "Install App" button in the UI
 *   - Deferred prompt triggering after user interaction
 *   - Analytics on install prompt acceptance rate
 *
 * DEPENDENCIES:
 *   - config/app.config.js (FEATURES.INSTALL_PROMPT)
 *   - Alpine.js v3.x (store access for UI coordination)
 *
 * PHASE: Frontend (Mock) — Works with mock or real server
 * ============================================================
 */

/** @type {Event|null} Deferred install prompt event */
let deferredPrompt = null;

/**
 * Listens for the browser's beforeinstallprompt event.
 * Stores the event for later triggering via user action.
 */
window.addEventListener('beforeinstallprompt', (event) => {
  if (!APP_CONFIG.FEATURES.INSTALL_PROMPT) return;

  event.preventDefault();
  deferredPrompt = event;

  console.log('[INFO] [PWA] Install prompt captured.', {
    platforms: event.platforms,
  });

  /** Notify Alpine store that install is available */
  const uiStore = Alpine.store('ui');
  if (uiStore) {
    uiStore.installAvailable = true;
  }
});

/**
 * Triggers the deferred install prompt.
 * Should be called from a user-initiated action (button click).
 *
 * @returns {Promise<boolean>} Whether the user accepted the install
 */
async function triggerInstallPrompt() {
  if (!deferredPrompt) {
    console.warn('[WARN] [PWA] No install prompt available.');
    return false;
  }

  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;

  console.log('[INFO] [PWA] Install prompt user choice.', { outcome });

  deferredPrompt = null;

  const uiStore = Alpine.store('ui');
  if (uiStore) {
    uiStore.installAvailable = false;
  }

  return outcome === 'accepted';
}

/**
 * Listens for successful app installation.
 */
window.addEventListener('appinstalled', () => {
  console.log('[INFO] [PWA] App installed successfully.');
  deferredPrompt = null;
});
