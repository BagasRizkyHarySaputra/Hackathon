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
    _authChecked: false,

    init() {
      console.log('[INFO] [Loading] Component mounted.', {
        keys: ['progress', 'isLoading', 'isComplete', 'statusMessage'],
      });

      // Start progress bar animation immediately — no redirect until it reaches 100%.
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
       * Auth check deferred until now: progress bar reached 100%.
       * Redirect based on whether the user is authenticated.
       */
      this.redirectBasedOnAuth();
    },

    /**
     * Fetches the current user's skin_type from Supabase profiles
     * and redirects accordingly.
     * - skin_type is set (not null/unsure) → /home
     * - skin_type is null or 'unsure' → /scan
     * - no user/no profile → /login
     */
    redirectBasedOnSkinType() {
      var self = this;
      var SUPABASE_URL = 'https://gvkzgicbykyjkusxranv.supabase.co';
      var ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2a3pnaWNieWt5amt1c3hyYW52Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4OTg0OTAsImV4cCI6MjA5NzQ3NDQ5MH0.8DEahyrZ-IxZmuM7wVuO6-LP3K4IfX3v3eNsXnh_Hzw';

      function redirect(path) {
        setTimeout(function () {
          window.location.href = path;
        }, 800);
      }

      // Get user ID from Alpine auth store
      var authStore = window.Alpine && Alpine.store('auth');
      var userId = authStore && authStore.user && authStore.user.id;
      if (!userId) {
        console.warn('[Loading] No authenticated user — redirecting to login.');
        redirect('/login');
        return;
      }

      // Fetch profile skin_type from Supabase using user's real JWT
      var token = (authStore && authStore.token) || ANON_KEY;  // real JWT in production
      var url = SUPABASE_URL + '/rest/v1/profiles?select=skin_type&id=eq.' + encodeURIComponent(userId);

      fetch(url, {
        headers: {
          'apikey': ANON_KEY,
          'Authorization': 'Bearer ' + token
        }
      })
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        })
        .then(function (data) {
          var skinType = data && data.length > 0 ? data[0].skin_type : null;
          if (skinType && skinType !== 'unsure') {
            console.log('[Loading] Skin type found: ' + skinType + ' — redirecting to /home.');
            redirect('/home');
          } else {
            console.log('[Loading] No skin type set — redirecting to /scan.');
            redirect('/scan');
          }
        })
        .catch(function (err) {
          console.warn('[Loading] Failed to fetch profile:', err.message);
          redirect('/scan');
        });
    },

    /**
     * Ensures a profile row exists for the current user.
     * Upserts with name & avatar from auth metadata, skin_type defaults to 'unsure'.
     * Calls the callback when done (or on error — proceeds anyway).
     *
     * @param {function} callback — called after upsert completes (or on error)
     * @returns {void}
     */
    ensureProfileExists(callback) {
      var authStore = window.Alpine && Alpine.store('auth');
      var userId = authStore && authStore.user && authStore.user.id;
      if (!userId) {
        callback();
        return;
      }

      var name = authStore.user.name || authStore.user.email || 'User';
      var avatarUrl = authStore.user.avatar || '';
      var SUPABASE_URL = APP_CONFIG.SUPABASE_URL;
      var ANON_KEY = APP_CONFIG.SUPABASE_ANON_KEY;
      var token = authStore.token || ANON_KEY;

      var email = authStore.user.email || '';
      var url = SUPABASE_URL + '/rest/v1/profiles?on_conflict=id';
      var payload = {
        id: userId,
        name: name,
        profile_image_url: avatarUrl,
        skin_type: 'unsure'
      };
      if (email) payload.email = email;
      var body = JSON.stringify(payload);

      fetch(url, {
        method: 'POST',
        headers: {
          'apikey': ANON_KEY,
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: body
      })
        .then(function (r) {
          if (!r.ok) console.warn('[Loading] Profile upsert responded with', r.status);
          else console.log('[Loading] Profile ensured for user', userId);
        })
        .catch(function (err) {
          console.warn('[Loading] Profile upsert failed:', err.message);
        })
        .finally(function () {
          callback();
        });
    },

    /**
     * Check for mock auth session in localStorage (mock mode only).
     * Restores the Alpine auth store from the stored session if found.
     *
     * @param {function} onAuthenticated — redirect to scan/home
     * @param {function} onUnauthenticated — redirect to /login
     * @returns {void}
     */
    _checkMockAuthAndRedirect(onAuthenticated, onUnauthenticated) {
      if (!APP_CONFIG.IS_MOCK_MODE) {
        onUnauthenticated();
        return;
      }
      try {
        var mockData = JSON.parse(localStorage.getItem('sb-mock-token'));
        if (mockData && mockData.access_token && mockData.user) {
          var authStore = window.Alpine && Alpine.store('auth');
          if (authStore) {
            authStore.login(mockData.access_token, mockData.user);
          }
          onAuthenticated();
          return;
        }
      } catch (e) {}
      onUnauthenticated();
    },

    /**
     * Checks auth status after the progress bar reaches 100%.
     * Redirects to /login if not authenticated, or to /home / /scan
     * based on skin_type if authenticated.
     *
     * @returns {void}
     */
    redirectBasedOnAuth() {
      var self = this;

      function goToLogin() {
        console.log('[Loading] No authenticated user — redirecting to /login.');
        setTimeout(function () {
          window.location.href = '/login';
        }, 800);
      }

      function goToScanOrHome() {
        // Ensure a profile row exists before checking skin_type
        self.ensureProfileExists(function () {
          self.redirectBasedOnSkinType();
        });
      }

      // 1. Check Alpine auth store — in mock mode, also restore from localStorage
      var authStore = window.Alpine && Alpine.store('auth');
      if (authStore) {
        if (authStore.isAuthenticated && authStore.user && authStore.user.id) {
          console.log('[Loading] Auth found in store — user:', authStore.user.id);
          goToScanOrHome();
          return;
        }
        // Mock-only fallback: try to sync from localStorage mock session
        if (APP_CONFIG.IS_MOCK_MODE) {
          try {
            var mockData = JSON.parse(localStorage.getItem('sb-mock-token'));
            if (mockData && mockData.access_token && mockData.user) {
              console.log('[Loading] Restored mock session from localStorage — user:', mockData.user.id);
              authStore.login(mockData.access_token, mockData.user);
              goToScanOrHome();
              return;
            }
          } catch(e) {
            console.warn('[Loading] Failed to read sb-mock-token from localStorage:', e);
          }
        }
      }

      // 2. Check Supabase session directly
      var sb = window.__supabase;
      if (sb) {
        var selfForCb = self;
        sb.auth.getSession().then(function (result) {
          var session = result.data && result.data.session;
          if (session && session.user) {
            console.log('[Loading] Found Supabase session — user:', session.user.id);
            if (authStore) {
              authStore.login(session.access_token, {
                id: session.user.id,
                email: session.user.email,
                name: session.user.user_metadata?.full_name || session.user.email,
                avatar: session.user.user_metadata?.avatar_url || '',
              });
            }
            goToScanOrHome();
          } else {
            console.log('[Loading] No Supabase session — checking mock fallback...');
            selfForCb._checkMockAuthAndRedirect(goToScanOrHome, goToLogin);
          }
        }).catch(function (err) {
          console.warn('[Loading] getSession error — checking mock fallback:', err.message);
          self._checkMockAuthAndRedirect(goToScanOrHome, goToLogin);
        });
        return;
      }

      // 3. No Supabase yet — wait for it
      if (!self._authChecked) {
        console.log('[Loading] Supabase not ready — waiting for supabase:ready event...');
        self._authChecked = true;
        document.addEventListener('supabase:ready', function readyHandler() {
          document.removeEventListener('supabase:ready', readyHandler);
          self.redirectBasedOnAuth();
        });
      } else {
        console.warn('[Loading] Auth check exhausted — redirecting to login.');
        goToLogin();
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
