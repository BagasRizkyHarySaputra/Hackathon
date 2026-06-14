/**
 * ============================================================
 * FILE: assets/js/htmx/config.js
 * ============================================================
 * FEATURE: HTMX Global Configuration
 *
 * PURPOSE:
 *   Applies default behaviors for all HTMX requests in the
 *   application. Must be loaded BEFORE htmx.js in index.html.
 *
 * DEPENDENCIES:
 *   - config/app.config.js (APP_CONFIG)
 *   - htmx v2.x library
 *
 * PHASE: Frontend (Mock) — Works with mock or real server
 * ============================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  /** Set default swap style from centralized config */
  htmx.config.defaultSwapStyle = APP_CONFIG.HTMX_DEFAULT_SWAP;

  /** Number of cached history entries */
  htmx.config.historyCacheSize = 10;

  /** Refresh page when history cache misses */
  htmx.config.refreshOnHistoryMiss = true;

  /** Enable smooth view transitions */
  htmx.config.globalViewTransitions = true;

  /** Scroll focus into view after swap */
  htmx.config.defaultFocusScroll = true;

  console.log('[INFO] [HTMX] Global configuration applied.', {
    defaultSwap: htmx.config.defaultSwapStyle,
    historyCacheSize: htmx.config.historyCacheSize,
  });
});
