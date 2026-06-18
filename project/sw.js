/**
 * ============================================================
 * FILE: sw.js
 * ============================================================
 * FEATURE: Service Worker — Cache Strategies & Offline Support
 *
 * PURPOSE:
 *   Manages caching strategies for different asset types to enable
 *   offline functionality and optimal performance. Pre-caches the
 *   app shell and offline fallback page on install.
 *
 * CACHE STRATEGIES:
 *   - App Shell HTML      → Cache First
 *   - HTMX Partials      → Network First
 *   - Static Assets       → Stale While Revalidate
 *   - API JSON Responses  → Network First
 *   - Images / Icons      → Cache First
 *
 * DEPENDENCIES:
 *   - config/app.config.js (SW_CACHE_NAME, SW_OFFLINE_URL)
 *
 * PHASE: Frontend (Mock) — Works with mock or real server
 * ============================================================
 */

const CACHE_NAME = 'skinglow-v1';
const OFFLINE_URL = '/offline.html';

/** Pre-cache app shell and offline fallback on install */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/offline.html',
        '/manifest.json',
      ]);
    })
  );
  self.skipWaiting();
});

/** Clean old caches on activation */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

/**
 * Determines the cache strategy based on request URL and type.
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function handleFetch(request) {
  const { url, destination } = request;

  // HTMX Partials & API → Network First
  if (url.includes('/api/') || url.includes('/partials/')) {
    return networkFirst(request);
  }

  // Images / Icons → Cache First
  if (destination === 'image' || url.includes('/assets/icons/')) {
    return cacheFirst(request);
  }

  // Static CSS/JS → Stale While Revalidate
  if (destination === 'style' || destination === 'script') {
    return staleWhileRevalidate(request);
  }

  // HTML pages → Cache First (app shell)
  if (destination === 'document') {
    return cacheFirstWithOfflineFallback(request);
  }

  // Default → Network First
  return networkFirst(request);
}

/**
 * Network First strategy: try network, fall back to cache.
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, networkResponse.clone());
    return networkResponse;
  } catch {
    const cached = await caches.match(request);
    return cached || caches.match(OFFLINE_URL);
  }
}

/**
 * Cache First strategy: try cache, fall back to network.
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const networkResponse = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, networkResponse.clone());
    return networkResponse;
  } catch {
    return new Response('', { status: 404 });
  }
}

/**
 * Cache First with offline fallback for document requests.
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function cacheFirstWithOfflineFallback(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const networkResponse = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, networkResponse.clone());
    return networkResponse;
  } catch {
    return caches.match(OFFLINE_URL);
  }
}

/**
 * Stale While Revalidate: return cached immediately, update in background.
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then((networkResponse) => {
    cache.put(request, networkResponse.clone());
    return networkResponse;
  }).catch(() => cached);

  return cached || fetchPromise;
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(handleFetch(event.request));
});
