/**
 * SkinGlow — Scan Page Component
 *
 * Captures a photo from the camera, sends to YOLO ML API (local Python server),
 * replaces the captured photo with the YOLO annotated image (bounding boxes),
 * and saves the Skin Health Score Profile (%) to Supabase.
 *
 * Dependencies:
 *   - Alpine.js v3.x
 *   - config/app.config.js
 *   - assets/js/supabase/supabase-client.js (module)
 *   - assets/js/alpine/stores/auth.store.js
 */

function createScanPageComponent() {
  return {
    /** @type {string|null} Base64 captured image (replaced by annotated image after analysis) */
    capturedImage: null,

    /** @type {string|null} Camera error message (null when OK) */
    cameraError: null,

    /** @type {boolean} Whether the results popup is visible */
    showPopup: false,

    /** @type {boolean} Whether the camera stream is ready */
    cameraReady: false,

    /** @type {boolean} Whether analysis is in progress */
    isAnalyzing: false,

    /** @type {Object|null} Analysis result with skin markers */
    analysis: null,

    /** @type {Object|null} Recommended product from analysis */
    product: null,

    /** @type {Object|null} Full health score profile from API */
    healthScore: null,

    /** @type {boolean} Whether result was saved to Supabase */
    savedToSupabase: false,

    /** @type {'morning'|'night'} Selected routine type */
    routineType: 'morning',

    /** @type {number} API call timeout in ms */
    _API_TIMEOUT_MS: 30000,

    /** @type {MediaStream|null} Active camera stream (for cleanup) */
    _stream: null,

    /**
     * Component mount — immediately requests camera access.
     */
    init() {
      console.log('[ScanPage] Component mounted.');
      this.requestCamera();
    },

    /**
     * Requests camera access. Sets cameraReady=true on success,
     * or cameraError with description on failure.
     */
    requestCamera() {
      const startCamera = async () => {
        try {
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('not-available');
          }

          this.cameraError = null;

          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: 'user',
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          });

          // Stop any previous stream before overwriting
          if (this._stream) {
            this._stream.getTracks().forEach(function(t) { t.stop(); });
          }

          this._stream = stream;
          var video = this.$refs.video;
          if (video) {
            video.srcObject = stream;
            video.onloadedmetadata = function() {
              this.cameraReady = true;
              console.log('[ScanPage] Camera ready.');
            }.bind(this);
          }
        } catch (err) {
          console.log('[ScanPage] Camera error:', err.message);

          if (err.message === 'not-available') {
            this.cameraError = 'Camera API is not available on this device or browser. Use a device with a camera.';
          } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            this.cameraError = 'Camera access was denied. Please allow camera access in your browser settings, then tap the button below to try again.';
          } else if (err.name === 'NotFoundError') {
            this.cameraError = 'No camera found on this device.';
          } else {
            this.cameraError = 'Could not access camera. Make sure your camera is connected and not in use by another app, then try again.';
          }

          this.cameraReady = false;
        }
      };

      startCamera();
    },

    /**
     * Captures a photo from the video stream and sends to ML API.
     * The captured photo is replaced with the YOLO annotated image
     * (with bounding boxes drawn) once analysis completes.
     */
    capturePhoto() {
      if (!this.cameraReady) {
        this.requestCamera();
        return;
      }

      // Reset state for a new scan
      this.showPopup = false;
      this.savedToSupabase = false;
      this.healthScore = null;

      var video = this.$refs.video;
      var canvas = this.$refs.canvas;

      if (video && canvas && video.videoWidth > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);
        this.capturedImage = canvas.toDataURL('image/jpeg', 0.8);
      } else {
        this.capturedImage = '';
      }

      console.log('[ScanPage] Photo captured — sending to ML API.');

      this._analyzeWithAPI(canvas);
    },

    /**
     * Sends canvas blob to YOLO ML API (local Python server).
     * On success: replaces capturedImage with annotated image,
     *             saves health_score to Supabase,
     *             shows results popup.
     * On failure: shows error message.
     */
    _analyzeWithAPI(canvas) {
      var self = this;
      this.isAnalyzing = true;

      canvas.toBlob(function (blob) {
        if (!blob) {
          console.warn('[ScanPage] Canvas toBlob failed.');
          self._showError('Could not capture image data. Please try again.');
          return;
        }

        var formData = new FormData();
        formData.append('file', blob, 'scan.jpg');

        var mlUrl = window.APP_CONFIG && window.APP_CONFIG.ML_API_URL;
        if (!mlUrl) {
          self._showError('ML API URL is not configured.');
          return;
        }
        var url = mlUrl.replace(/\/+$/, '') + '/analyze';

        // Abort after timeout
        var controller = new AbortController();
        var timeoutId = setTimeout(function () {
          controller.abort();
        }, self._API_TIMEOUT_MS);

        fetch(url, {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        })
          .then(function (res) {
            clearTimeout(timeoutId);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.json();
          })
          .then(function (data) {
            console.log('[ScanPage] ML API analysis complete.', data);

            // Replace captured photo with annotated image (bounding boxes)
            if (data.annotated_image) {
              self.capturedImage = data.annotated_image;
              console.log('[ScanPage] Photo replaced with annotated image.');
            }

            // Store markers for overlay
            self.analysis = {
              markers: data.markers || [],
              result: data,
            };

            // Store full health score profile
            self.healthScore = data.health_score || null;

            // Dummy product (real recommendation handled later)
            self.product = data.product || {
              name: 'Gentle Cleanser',
              description: 'Maintains clear healthy skin with gentle daily cleansing.',
            };

            self.isAnalyzing = false;
            self.showPopup = true;

            // Save health score to Supabase (async, non-blocking)
            self._saveToSupabase(data);
          })
          .catch(function (err) {
            clearTimeout(timeoutId);
            console.warn('[ScanPage] ML API failed:', err.message);
            self._showError('Could not analyze image. Make sure the ML server is running at ' + mlUrl + '. Error: ' + err.message);
          });
      }, 'image/jpeg', 0.8);
    },

    /**
     * Saves the Skin Health Score Profile (%) to Supabase scan_results table.
     * Uses the current user's JWT from the auth store.
     */
    _saveToSupabase(apiData) {
      var self = this;
      var sb = window.__supabase;
      var authStore = window.Alpine && Alpine.store('auth');

      if (!sb) {
        console.warn('[ScanPage] Supabase client not available — skipping save.');
        return;
      }

      if (!authStore || !authStore.user || !authStore.user.id) {
        console.warn('[ScanPage] No authenticated user — skipping save.');
        return;
      }

      var userId = authStore.user.id;
      var token = authStore.token;
      var healthScore = apiData.health_score || {};

      // Build row for scan_results table
      var row = {
        user_id: userId,
        clear_skin: healthScore.clear_skin || 0,
        nodules: healthScore.nodules || 0,
        pustules: healthScore.pustules || 0,
        papules: healthScore.papules || 0,
        dark_spot: healthScore['dark spot'] || 0,
        blackheads: healthScore.blackheads || 0,
        whiteheads: healthScore.whiteheads || 0,
        acne_counts: apiData.acne_counts || {},
        issues_found: apiData.issues_found || [],
      };

      var url = APP_CONFIG.SUPABASE_URL + '/rest/v1/scan_results';

      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': APP_CONFIG.SUPABASE_ANON_KEY,
          'Authorization': 'Bearer ' + (token || APP_CONFIG.SUPABASE_ANON_KEY),
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify(row),
      })
        .then(function (res) {
          if (!res.ok) {
            console.warn('[ScanPage] Supabase save failed: HTTP ' + res.status);
            return res.text().then(function (t) {
              console.warn('[ScanPage] Supabase error body:', t);
            });
          }
          self.savedToSupabase = true;
          console.log('[ScanPage] Health score saved to Supabase scan_results.');

          // Also mark profile as scan_completed=true
          self._markScanCompleted(userId, token);
        })
        .catch(function (err) {
          console.warn('[ScanPage] Supabase save error:', err.message);
        });
    },

    /**
     * Updates the profiles table: scan_completed=true so the loading page
     * redirects to /home instead of /scan on next login.
     */
    _markScanCompleted(userId, token) {
      var url = APP_CONFIG.SUPABASE_URL + '/rest/v1/profiles?id=eq.' + encodeURIComponent(userId);

      fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': APP_CONFIG.SUPABASE_ANON_KEY,
          'Authorization': 'Bearer ' + (token || APP_CONFIG.SUPABASE_ANON_KEY),
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ scan_completed: true }),
      })
        .then(function (res) {
          if (res.ok) {
            console.log('[ScanPage] Profile marked scan_completed=true.');
          } else {
            console.warn('[ScanPage] Failed to mark scan_completed: HTTP ' + res.status);
          }
        })
        .catch(function (err) {
          console.warn('[ScanPage] Profile update error:', err.message);
        });
    },

    _showError(msg) {
      this.analysis = { markers: [] };
      this.product = { name: 'Could not analyze', description: msg };
      this.isAnalyzing = false;
      this.showPopup = true;
    },

    /**
     * Saves the selected routine.
     */
    saveRoutine() {
      console.log('[ScanPage] Routine saved:', this.routineType);

      if (this.$store && this.$store.ui) {
        this.$store.ui.showToast(
          'Routine saved: ' + this.routineType,
          'success'
        );
      }

      this.$dispatch('scan:routine-saved', {
        routine: this.routineType,
        product: this.product ? this.product.name : null,
      });
    },

    /**
     * Cleanup on destroy.
     */
    destroy() {
      if (this._stream) {
        this._stream.getTracks().forEach(function(t) { t.stop(); });
        this._stream = null;
        console.log('[ScanPage] Camera stream stopped.');
      }
    },
  };
}
