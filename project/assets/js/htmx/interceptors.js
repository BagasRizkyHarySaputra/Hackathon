/**
 * ============================================================
 * FILE: assets/js/htmx/interceptors.js
 * ============================================================
 * FEATURE: HTMX Event Interceptors
 *
 * PURPOSE:
 *   Attaches global request/response hooks to all HTMX traffic.
 *   Injects auth headers, manages loading indicators, and triggers
 *   toast notifications on errors.
 *
 * HOOKS IMPLEMENTED:
 *   - htmx:configRequest  → Inject auth headers, CSRF token
 *   - htmx:beforeRequest  → Show global loading state
 *   - htmx:afterRequest   → Hide loading, handle errors
 *   - htmx:responseError  → Trigger toast notification via Alpine store
 *
 * DEPENDENCIES:
 *   - Alpine.js v3.x ($store access for auth & ui stores)
 *   - htmx v2.x event system
 *
 * PHASE: Frontend (Mock) — Auth store returns mock token
 * ============================================================
 */

/**
 * Inject Authorization and custom headers into every HTMX request.
 */
document.addEventListener('htmx:configRequest', (event) => {
  const authStore = Alpine.store('auth');
  if (authStore && authStore.token) {
    event.detail.headers['Authorization'] = `Bearer ${authStore.token}`;
  }
  event.detail.headers['X-Requested-With'] = 'HTMX';
  event.detail.headers['X-App-Version'] = APP_CONFIG.VERSION;

  console.log('[INFO] [HTMX] Request dispatched.', {
    method: event.detail.verb.toUpperCase(),
    url: event.detail.path,
    target: event.detail.target?.id || 'inline',
  });
});

/**
 * Show global loading indicator before request starts.
 */
document.addEventListener('htmx:beforeRequest', (event) => {
  document.body.classList.add(APP_CONFIG.HTMX_INDICATOR_CLASS);
});

/**
 * Hide global loading indicator after request completes.
 */
document.addEventListener('htmx:afterRequest', (event) => {
  document.body.classList.remove(APP_CONFIG.HTMX_INDICATOR_CLASS);

  if (event.detail.successful) {
    console.log('[INFO] [HTMX] Request success.', {
      url: event.detail.requestConfig.path,
      status: event.detail.xhr.status,
    });
  }
});

/**
 * Handle HTMX response errors with toast notification.
 */
document.addEventListener('htmx:responseError', (event) => {
  const status = event.detail.xhr.status;
  const url = event.detail.requestConfig.path;

  console.error('[ERROR] [HTMX] Request failed.', {
    url,
    status,
    response: event.detail.xhr.responseText.substring(0, 200),
  });

  const uiStore = Alpine.store('ui');
  if (uiStore) {
    uiStore.addToast('error', `Request failed (${status}). Please try again.`);
  }
});

/**
 * Handle network errors (no response received).
 */
document.addEventListener('htmx:sendError', (event) => {
  console.error('[ERROR] [HTMX] Network error — no response received.', {
    url: event.detail.requestConfig?.path || 'unknown',
  });

  const uiStore = Alpine.store('ui');
  if (uiStore) {
    uiStore.addToast('error', 'Network error. Check your connection.');
  }
});
