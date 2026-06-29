/**
 * ============================================================
 * FILE: assets/js/alpine/stores/ui.store.js
 * ============================================================
 * FEATURE: Global UI State Management
 *
 * PURPOSE:
 *   Manages global UI state across the entire application using
 *   Alpine.js reactive stores. Controls sidebar, modals, toasts,
 *   and theme toggling.
 *
 * USE CASES:
 *   - Toast notification queue management
 *   - Sidebar open/close state
 *   - Theme switching (light/dark)
 *   - Modal visibility coordination
 *
 * DEPENDENCIES:
 *   - Alpine.js v3.x ($store access)
 *   - AlpineJS Persist Plugin (for theme persistence)
 *
 * PHASE: Frontend (Mock) — No real backend required
 * ============================================================
 */

document.addEventListener('alpine:init', () => {
  Alpine.store('ui', {
    /** @type {boolean} Sidebar visibility state */
    sidebarOpen: false,

    /** @type {Array<{id: number, type: string, message: string}>} Toast queue */
    toasts: [],

    /** @type {'light'|'dark'} Current UI theme */
    theme: 'light',

    /** @type {boolean} Whether PWA install prompt is available */
    installAvailable: false,

    /**
     * Pushes a toast notification to the queue.
     * Auto-removes after the specified duration.
     *
     * @param {'success'|'error'|'info'|'warning'} type - Toast severity
     * @param {string} message - Display message
     * @param {number} [duration=4000] - Auto-dismiss time in ms
     */
    addToast(type, message, duration = 4000) {
      const id = Date.now() + Math.random();
      this.toasts.push({ id, type, message });
      setTimeout(() => this.removeToast(id), duration);
      console.log('[INFO] [UI Store] Toast added.', { type, message });
    },

    showToast(message, type = 'info', duration = 4000) {
      this.addToast(type, message, duration);
    },

    /**
     * Removes a specific toast from the queue by ID.
     * @param {number} id - Toast ID to remove
     */
    removeToast(id) {
      this.toasts = this.toasts.filter((t) => t.id !== id);
    },

    /**
     * Toggles sidebar visibility.
     */
    toggleSidebar() {
      this.sidebarOpen = !this.sidebarOpen;
    },

    /**
     * Toggles between light and dark themes.
     */
    toggleTheme() {
      this.theme = this.theme === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', this.theme);
      console.log('[INFO] [UI Store] Theme toggled.', { theme: this.theme });
    },
  });

  console.log('[INFO] [Alpine] UI store initialized.', {
    keys: ['sidebarOpen', 'toasts', 'theme'],
  });
});
