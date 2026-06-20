/**
 * ============================================================
 * FILE: assets/js/alpine/components/loading.js
 * ============================================================
 * FEATURE: Loading Page — Alpine.js Component
 *
 * PURPOSE:
 *   Manages the skin analysis loading screen with an animated
 *   progress bar that simulates analysis progress. The progress
 *   uses non-linear timing to feel more natural (slower at start,
 *   faster near completion). Once complete, triggers an HTMX
 *   request or redirects to the results page.
 *
 * USE CASES:
 *   - Displayed after user uploads/submits a skin photo
 *   - Simulates ML analysis progress (mock mode)
 *   - In Phase 2, will reflect real API progress via HTMX polling
 *
 * DEPENDENCIES:
 *   - Alpine.js v3.x (component data pattern)
 *   - config/app.config.js (LOADING_PROGRESS_INTERVAL_MS, etc.)
 *   - assets/css/components/loading.css
 *
 * PHASE: Frontend (Mock) — Progress is simulated client-side
 * BACKEND CONTRACT: GET /api/analysis/status → { progress: 0-100 }
 * ============================================================
 */

/**
 * Creates the Alpine.js data object for the loading page.
 * Manages progress simulation, status text updates, and completion.
 *
 * @returns {Object} Alpine component data object
 */
function createLoadingComponent() {
  return {
    /** @type {number} Current progress percentage (0–100) */
    progress: 0,

    /** @type {boolean} Whether the analysis is still in progress */
    isLoading: true,

    /** @type {boolean} Whether the analysis completed successfully */
    isComplete: false,

    /** @type {number|null} Interval timer ID for cleanup */
    _intervalId: null,

    /** @type {string} Current status message displayed to user */
    statusMessage: 'Analyzing your skin\nglow...',

    /** @type {string} Subtext hint */
    subtext: 'Please wait a moment',

    /**
     * Status messages shown at various progress thresholds.
     * Creates a sense of real analysis happening.
     * @type {Array<{threshold: number, message: string, sub: string}>}
     */
    _statusSteps: [
      { threshold: 0,  message: 'Analyzing your skin\nglow...', sub: 'Please wait a moment' },
      { threshold: 15, message: 'Detecting skin regions...', sub: 'Identifying facial features' },
      { threshold: 35, message: 'Analyzing skin tone\n& texture...', sub: 'Processing color data' },
      { threshold: 55, message: 'Evaluating glow &\nhydration levels...', sub: 'Almost halfway there' },
      { threshold: 75, message: 'Generating your\nskin report...', sub: 'Compiling results' },
      { threshold: 90, message: 'Finalizing\nanalysis...', sub: 'Just a moment more' },
      { threshold: 100, message: 'Analysis complete!', sub: 'Redirecting to results...' },
    ],

    /**
     * Initializes the loading progress simulation.
     * Called automatically by Alpine.js on component mount.
     *
     * @returns {void}
     */
    init() {
      console.log('[INFO] [Loading] Component mounted.', {
        keys: ['progress', 'isLoading', 'isComplete', 'statusMessage'],
      });

      this.startProgressSimulation();
    },

    /**
     * Starts the simulated progress bar animation.
     * Uses variable speed: slower at beginning, accelerates near end.
     *
     * @returns {void}
     */
    startProgressSimulation() {
      const intervalMs = APP_CONFIG.LOADING_PROGRESS_INTERVAL_MS;

      this._intervalId = setInterval(() => {
        if (this.progress >= 100) {
          this.completeAnalysis();
          return;
        }

        /** Calculate increment with easing — slower early, faster later */
        const remaining = 100 - this.progress;
        const baseIncrement = 1.5;
        const accelerationFactor = Math.max(0.15, remaining / 100);
        const randomBoost = Math.random() * 1.5;
        const increment = baseIncrement + (randomBoost * accelerationFactor);

        this.progress = Math.min(100, this.progress + increment);
        this.updateStatusMessage();
      }, intervalMs);
    },

    /**
     * Updates the heading and subtext based on current progress.
     * Finds the appropriate status message for the current threshold.
     *
     * @returns {void}
     */
    updateStatusMessage() {
      const currentStep = [...this._statusSteps]
        .reverse()
        .find((step) => this.progress >= step.threshold);

      if (currentStep) {
        this.statusMessage = currentStep.message;
        this.subtext = currentStep.sub;
      }
    },

    /**
     * Handles analysis completion.
     * Clears the interval, sets completion state, and dispatches
     * a custom event for HTMX or navigation to pick up.
     *
     * @returns {void}
     */
    completeAnalysis() {
      if (this._intervalId) {
        clearInterval(this._intervalId);
        this._intervalId = null;
      }

      this.progress = 100;
      this.isLoading = false;
      this.isComplete = true;
      this.updateStatusMessage();

      console.log('[INFO] [Loading] Analysis simulation complete.');

      /** Dispatch custom event for HTMX or parent component */
      this.$dispatch('analysis:complete', { progress: 100 });

      /**
       * In Phase 2, this would trigger an HTMX request:
       * htmx.ajax('GET', '/api/analysis/results', '#results-container');
       *
       * For mock mode, we simulate a redirect delay.
       */
      if (APP_CONFIG.IS_MOCK_MODE) {
        setTimeout(() => {
          window.location.href = '/login';
        }, 800);
      }
    },

    /**
     * Cleans up interval on component destruction.
     * Called by Alpine.js x-on:beforeunload or manually.
     *
     * @returns {void}
     */
    destroy() {
      if (this._intervalId) {
        clearInterval(this._intervalId);
        this._intervalId = null;
      }
    },

    /**
     * Returns the progress value rounded to nearest integer for display.
     * @returns {number} Rounded progress percentage
     */
    get displayProgress() {
      return Math.round(this.progress);
    },
  };
}
