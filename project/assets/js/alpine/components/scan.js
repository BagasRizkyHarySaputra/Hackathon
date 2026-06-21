/**
 * ============================================================
 * FILE: assets/js/alpine/components/scan.js
 * ============================================================
 * FEATURE: Scan Page — Skin Type Selection Alpine Component
 *
 * PURPOSE:
 *   Manages the skin type selection UI. Users pick one of
 *   six skin types (Oily, Dry, Combination, Normal, Sensitive,
 *   Not Sure). Selected bubble turns red. Confirm button saves
 *   selection and proceeds to the next step.
 *
 * USE CASES:
 *   - Displayed after loading/login to gather user skin data
 *   - Stores selected skin type in Alpine store for later use
 *
 * DEPENDENCIES:
 *   - Alpine.js v3.x (component data pattern)
 *   - config/app.config.js
 *   - assets/css/components/scan.css
 *
 * PHASE: Frontend (Mock)
 * ============================================================
 */

/**
 * Creates the Alpine.js data object for the scan page.
 * Manages skin type selection and confirmation.
 *
 * @returns {Object} Alpine component data object
 */
function createScanComponent() {
  return {
    /** @type {string|null} Currently selected skin type ID */
    selectedType: null,

    /**
     * Available skin type options.
     * Each has a unique ID, display label, and base color.
     * @type {Array<{id: string, label: string, color: string}>}
     */
    skinTypes: [
      { id: 'oily',        label: 'Oily Skin',        color: '#FFB5B5' },
      { id: 'dry',         label: 'Dry Skin',         color: '#B5D8FF' },
      { id: 'combination', label: 'Combination Skin', color: '#C5B5FF' },
      { id: 'normal',      label: 'Normal Skin',      color: '#B5FFC5' },
      { id: 'sensitive',   label: 'Sensitive Skin',   color: '#FFD5B5' },
      { id: 'unsure',      label: 'Not Sure :(',      color: '#D5D5E0' },
    ],

    /**
     * Initializes the component.
     * Called automatically by Alpine.js on mount.
     *
     * @returns {void}
     */
    init() {
      console.log('[INFO] [Scan] Component mounted.', {
        selectedType: this.selectedType,
      });
    },

    /**
     * Selects a skin type. Toggles selection if tapping the
     * same type again (deselects).
     *
     * @param {string} typeId - The skin type ID to select
     * @returns {void}
     */
    selectType(typeId) {
      if (this.selectedType === typeId) {
        this.selectedType = null;
        console.log('[INFO] [Scan] Selection cleared.');
      } else {
        this.selectedType = typeId;
        console.log('[INFO] [Scan] Skin type selected:', typeId);
      }
    },

    /**
     * Confirms the skin type selection.
     * Stores the result and dispatches an event or navigates.
     *
     * @returns {void}
     */
    confirmSelection() {
      if (!this.selectedType) return;

      const selected = this.skinTypes.find(t => t.id === this.selectedType);
      console.log('[INFO] [Scan] Confirmed selection:', selected);

      /** Get user ID from Alpine auth store */
      var authStore = this.$store?.auth;
      var userId = authStore && authStore.user && authStore.user.id;

      if (!userId) {
        console.warn('[Scan] No authenticated user — cannot save skin type.');
        if (this.$store?.ui) {
          this.$store.ui.showToast('Please log in first.', 'error');
        }
        setTimeout(function () { window.location.href = '/login'; }, 800);
        return;
      }

      /** Save skin_type to Supabase profiles */
      this.saveSkinTypeToSupabase(userId, selected);
    },

    /**
     * Saves the selected skin_type to Supabase profiles table.
     * For 'unsure' selection, saves null so user will be prompted again.
     */
    saveSkinTypeToSupabase(userId, selected) {
      var self = this;
      var SUPABASE_URL = 'https://gvkzgicbykyjkusxranv.supabase.co';
      var ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2a3pnaWNieWt5amt1c3hyYW52Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4OTg0OTAsImV4cCI6MjA5NzQ3NDQ5MH0.8DEahyrZ-IxZmuM7wVuO6-LP3K4IfX3v3eNsXnh_Hzw';

      // Get user's access token for authenticated RLS
      var authStore = window.Alpine && Alpine.store('auth');
      var token = authStore && authStore.token;
      var authHeader = token || ANON_KEY;

      // Save skin_type (null for 'unsure', actual value otherwise)
      var skinTypeValue = self.selectedType === 'unsure' ? null : self.selectedType;

      var url = SUPABASE_URL + '/rest/v1/profiles?id=eq.' + encodeURIComponent(userId);
      var body = JSON.stringify({ skin_type: skinTypeValue, scan_completed: true });

      fetch(url, {
        method: 'PATCH',
        headers: {
          'apikey': ANON_KEY,
          'Authorization': 'Bearer ' + authHeader,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: body
      })
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          console.log('[Scan] Skin type saved to Supabase:', skinTypeValue);
        })
        .catch(function (err) {
          console.error('[Scan] Failed to save skin type:', err.message);
        })
        .finally(function () {
          /** Show toast + redirect */
          if (self.$store?.ui) {
            self.$store.ui.showToast(
              'Skin type set to: ' + selected.label,
              'success'
            );
          }

          self.$dispatch('skin:type-selected', {
            type: self.selectedType,
            label: selected.label,
          });

          setTimeout(function () {
            window.location.href = '/home';
          }, 800);
        });
    },
  };
}
