/**
 * ============================================================
 * FILE: assets/js/alpine/stores/auth.store.js
 * ============================================================
 * FEATURE: Authentication State Management
 *
 * PURPOSE:
 *   Manages global authentication state across the entire application
 *   using Alpine.js reactive stores. Provides a single source of truth
 *   for the current user, their session token, and access role.
 *
 * USE CASES:
 *   - Conditionally rendering UI based on auth state (x-show, x-if)
 *   - Injecting auth headers into HTMX requests via interceptors
 *   - Redirecting unauthenticated users on protected pages
 *   - Persisting auth state using AlpineJS Persist plugin
 *
 * DEPENDENCIES:
 *   - Alpine.js v3.x ($store access)
 *   - AlpineJS Persist Plugin (for localStorage sync)
 *   - htmx/interceptors.js (reads this store for Authorization header)
 *
 * PHASE: Frontend (Mock) — No real backend required
 * BACKEND CONTRACT: POST /api/auth/login → { token, user }
 * ============================================================
 */

document.addEventListener('alpine:init', () => {
  Alpine.store('auth', {
    /** @type {boolean} Whether the user is currently authenticated */
    isAuthenticated: false,

    /** @type {string|null} JWT or session token */
    token: null,

    /** @type {{name: string, email: string, role: string}|null} Current user info */
    user: null,

    /**
     * Sets the authentication state after a successful login.
     *
     * @param {string} token - Session/JWT token from server
     * @param {{name: string, email: string, role: string}} user - User profile object
     */
    login(token, user) {
      this.token = token;
      this.user = user;
      this.isAuthenticated = true;
      console.log('[INFO] [Auth Store] User logged in.', { email: user.email });
    },

    setToken(token) {
      this.token = token;
      this.isAuthenticated = !!token;
    },

    setUser(user) {
      this.user = user;
    },

    /**
     * Clears all authentication state and redirects to login page.
     */
    logout() {
      this.token = null;
      this.user = null;
      this.isAuthenticated = false;
      console.log('[INFO] [Auth Store] User logged out.');
    },

    /**
     * Checks if the current user has a specific role.
     *
     * @param {string} role - Role to check (e.g., 'admin', 'user')
     * @returns {boolean}
     */
    hasRole(role) {
      return this.user?.role === role;
    },
  });

  console.log('[INFO] [Alpine] Auth store initialized.', {
    keys: ['isAuthenticated', 'token', 'user'],
  });
});
