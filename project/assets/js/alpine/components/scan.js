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

      /** Store in Alpine global store if available */
      if (this.$store?.ui) {
        this.$store.ui.showToast(
          `Skin type set to: ${selected.label}`,
          'success'
        );
      }

      /** Dispatch custom event for parent/HTMX handling */
      this.$dispatch('skin:type-selected', {
        type: this.selectedType,
        label: selected.label,
      });

      /** In mock mode, simulate navigation */
      if (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.IS_MOCK_MODE) {
        setTimeout(() => {
          console.log('[INFO] [Scan] Would navigate to analysis in Phase 2.');
        }, 800);
      }
    },
  };
}
