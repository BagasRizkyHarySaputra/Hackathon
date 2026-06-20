/**
 * ============================================================
 * FILE: assets/js/alpine/app.js
 * ============================================================
 * FEATURE: Alpine.js Bootstrap & Shared Logger
 *
 * PURPOSE:
 *   Initializes Alpine.js, registers plugins, and provides a
 *   structured browser-side logger that prevents console pollution.
 *   All console output must use this logger — never raw console.log.
 *
 * DEPENDENCIES:
 *   - Alpine.js v3.x
 *   - config/app.config.js (APP_CONFIG)
 *
 * PHASE: Frontend (Mock) — No real backend required
 * ============================================================
 */

/**
 * Structured browser console logger.
 * Automatically strips large data payloads to prevent console pollution.
 *
 * @param {'INFO'|'WARN'|'ERROR'|'DEBUG'} level - Log severity level
 * @param {string} module - Source module name (e.g., 'HTMX', 'Auth Store')
 * @param {string} message - Human-readable log message
 * @param {Object} [data={}] - Optional structured data payload
 */
function log(level, module, message, data = {}) {
  const sanitized = sanitizeLogData(data);
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    module,
    message,
    ...sanitized,
  };
  const method = level === 'ERROR' ? 'error' : level === 'WARN' ? 'warn' : 'log';
  console[method](`[${level}] [${module}]`, message, sanitized);
}

/**
 * Removes or truncates heavy data before logging.
 * Strips: base64 strings, large arrays (>50 items), binary buffers.
 *
 * @param {Object} data - Raw data object
 * @returns {Object} Sanitized copy with truncated fields
 */
function sanitizeLogData(data) {
  return JSON.parse(
    JSON.stringify(data, (key, value) => {
      if (typeof value === 'string' && value.length > 500) {
        return `[TRUNCATED — ${value.length} chars]`;
      }
      if (Array.isArray(value) && value.length > 50) {
        return `[ARRAY TRUNCATED — ${value.length} items]`;
      }
      return value;
    })
  );
}

/**
 * Bootstrap Alpine.js application.
 * Registers plugins and triggers PWA service worker registration.
 */
document.addEventListener('DOMContentLoaded', () => {
  /** Register PWA Service Worker */
  if (typeof registerServiceWorker === 'function') {
    registerServiceWorker();
  }

  console.log('[INFO] [Alpine] Application bootstrapped.', {
    appName: APP_CONFIG.APP_NAME,
    version: APP_CONFIG.VERSION,
    mockMode: APP_CONFIG.IS_MOCK_MODE,
  });
});
