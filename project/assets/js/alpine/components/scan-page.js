/**
 * LICIN — Scan Page Component
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

    /** @type {Object} All recommended products from ML API */
    products: {
      morning: [],
      night: []
    },

    /** @type {number} Current product index in slider */
    currentProductIndex: 0,

    /** @type {Object|null} Full health score profile from API */
    healthScore: null,

    /** @type {boolean} Whether result was saved to Supabase */
    savedToSupabase: false,

    /** @type {'morning'|'night'} Selected routine type */
    routineType: 'morning',

    /** @type {number} API call timeout in ms */
    _API_TIMEOUT_MS: 90000,

    /** @type {string|null} Telegram file_id of the stored original photo */
    _telegramFileId: null,

    /** @type {number|null} Telegram message_id containing the photo */
    _telegramMessageId: null,

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
     * Uploads the original captured photo to Telegram Bot API
     * for unlimited cloud storage. Runs in parallel with ML analysis.
     * Sets _telegramFileId and _telegramMessageId on success.
     * @param {Blob} blob Original image blob
     */
    _uploadToTelegram(blob) {
      var self = this;
      this._telegramFileId = null;
      this._telegramMessageId = null;

      return new Promise(function (resolve) {
        var reader = new FileReader();
        reader.onload = function () {
          fetch('/api/telegram/send-photo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ photo: reader.result }),
          })
            .then(function (res) { return res.json(); })
            .then(function (data) {
              if (data.ok && data.file_id) {
                self._telegramFileId = data.file_id;
                self._telegramMessageId = data.message_id || null;
                console.log('[ScanPage] Photo saved to Telegram. file_id:', data.file_id);
              } else {
                console.warn('[ScanPage] Telegram upload failed:', data.error || data.detail || data);
              }
              resolve();
            })
            .catch(function (err) {
              console.warn('[ScanPage] Telegram upload error:', err.message);
              resolve();
            });
        };
        reader.onerror = function () {
          console.warn('[ScanPage] FileReader error for Telegram upload.');
          resolve();
        };
        reader.readAsDataURL(blob);
      });
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

        // Upload original photo to Telegram (returns Promise, awaited before save)
        var telegramPromise = self._uploadToTelegram(blob);

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

            // Extract product recommendations from ML API
            if (data.recommendations) {
              console.log('[ScanPage] Extracting product recommendations...');
              
              // Extract morning products (pagi)
              self.products.morning = [];
              if (data.recommendations.pagi && typeof data.recommendations.pagi === 'object') {
                Object.keys(data.recommendations.pagi).forEach(function(categoryKey) {
                  var category = data.recommendations.pagi[categoryKey];
                  if (category.options && Array.isArray(category.options) && category.options.length > 0) {
                    // Only take the first (top-ranked) product, not all alternatives
                    var topProduct = category.options[0];
                    self.products.morning.push({
                      name: topProduct.nama,
                      description: topProduct.deskripsi,
                      type: topProduct.jenis,
                      bpom: topProduct.bpom,
                      price: topProduct.harga,
                      size: topProduct.ukuran,
                      coverage: topProduct.problem_coverage,
                      problems: topProduct.masalah
                    });
                  }
                });
              }

              // Extract night products (malam)
              self.products.night = [];
              if (data.recommendations.malam && typeof data.recommendations.malam === 'object') {
                Object.keys(data.recommendations.malam).forEach(function(categoryKey) {
                  var category = data.recommendations.malam[categoryKey];
                  if (category.options && Array.isArray(category.options) && category.options.length > 0) {
                    // Only take the first (top-ranked) product, not all alternatives
                    var topProduct = category.options[0];
                    self.products.night.push({
                      name: topProduct.nama,
                      description: topProduct.deskripsi,
                      type: topProduct.jenis,
                      bpom: topProduct.bpom,
                      price: topProduct.harga,
                      size: topProduct.ukuran,
                      coverage: topProduct.problem_coverage,
                      problems: topProduct.masalah
                    });
                  }
                });
              }

              console.log('[ScanPage] Extracted ' + self.products.morning.length + ' morning products, ' + self.products.night.length + ' night products.');
              
              // Set first product as default for backward compatibility
              self.product = self.products.morning[0] || self.products.night[0] || {
                name: 'No recommendations',
                description: 'Your skin looks great! Keep up your current routine.',
              };
            } else {
              // Fallback if no recommendations
              self.product = {
                name: 'Gentle Cleanser',
                description: 'Maintains clear healthy skin with gentle daily cleansing.',
              };
              self.products.morning = [self.product];
              self.products.night = [self.product];
            }

            // Reset slider to first product
            self.currentProductIndex = 0;

            self.isAnalyzing = false;
            self.showPopup = true;

            // Wait for Telegram upload to finish before saving to Supabase
            // so that telegram_file_id is included in the row.
            telegramPromise.then(function () {
              self._saveToSupabase(data);
            });
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
        telegram_file_id: self._telegramFileId || null,
        telegram_message_id: self._telegramMessageId || null,
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
      const errorProduct = { name: 'Could not analyze', description: msg };
      this.product = errorProduct;
      // Populate products arrays so error card can show with new condition
      this.products.morning = [errorProduct];
      this.products.night = [errorProduct];
      this.currentProductIndex = 0;
      this.isAnalyzing = false;
      this.showPopup = true;
    },

    /**
     * Get current products array based on selected routine type
     */
    getCurrentProducts() {
      return this.products[this.routineType] || [];
    },

    /**
     * Get current product being displayed in slider
     */
    getCurrentProduct() {
      const products = this.getCurrentProducts();
      return products[this.currentProductIndex] || null;
    },

    /**
     * Get total count of products for current routine
     */
    getProductCount() {
      return this.getCurrentProducts().length;
    },

    /**
     * Check if can navigate to next product
     */
    canGoNext() {
      return this.currentProductIndex < this.getProductCount() - 1;
    },

    /**
     * Check if can navigate to previous product
     */
    canGoPrev() {
      return this.currentProductIndex > 0;
    },

    /**
     * Navigate to next product in slider
     */
    nextProduct() {
      if (this.canGoNext()) {
        this.currentProductIndex++;
      }
    },

    /**
     * Navigate to previous product in slider
     */
    prevProduct() {
      if (this.canGoPrev()) {
        this.currentProductIndex--;
      }
    },

    /**
     * Switch routine type and reset slider position
     */
    switchRoutineType(type) {
      if (this.routineType !== type) {
        this.routineType = type;
        this.currentProductIndex = 0;
      }
    },

    /**
     * Saves the selected routine.
     */
    saveRoutine() {
      console.log('[ScanPage] Saving routine to Supabase...');
      var self = this;

      // Get auth from Alpine store
      var authStore = window.Alpine && window.Alpine.store('auth');
      var userId = authStore && authStore.user ? authStore.user.id : null;
      var token = authStore ? authStore.token : null;

      // DEBUG: Log auth state
      console.log('[ScanPage] Auth Debug:', {
        hasAuthStore: !!authStore,
        hasUser: !!(authStore && authStore.user),
        userId: userId,
        hasToken: !!token,
        tokenPreview: token ? token.substring(0, 20) + '...' : null
      });

      if (!userId) {
        console.error('[ScanPage] Cannot save routine: User not authenticated');
        if (this.$store && this.$store.ui) {
          this.$store.ui.showToast('Please sign in to save your routine', 'error');
        }
        return;
      }

      // Prepare payload for Supabase
      var payload = {
        user_id: userId,
        morning_products: this.products.morning,
        night_products: this.products.night,
        health_score: this.healthScore,
        updated_at: new Date().toISOString()
      };

      // POST through Supabase REST API with UPSERT (on_conflict handles duplicate user_id)
      var url = APP_CONFIG.SUPABASE_URL + '/rest/v1/saved_routines?on_conflict=user_id';

      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': APP_CONFIG.SUPABASE_ANON_KEY,
          'Authorization': 'Bearer ' + (token || APP_CONFIG.SUPABASE_ANON_KEY),
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(payload)
      })
        .then(function(res) {
          if (!res.ok) {
            return res.text().then(function(errorText) {
              throw new Error('Supabase save failed: HTTP ' + res.status + ' - ' + errorText);
            });
          }
          console.log('[ScanPage] Routine saved to Supabase successfully.');

          // Show success message
          var totalProducts = self.products.morning.length + self.products.night.length;
          if (self.$store && self.$store.ui) {
            self.$store.ui.showToast(
              'Routine saved! ' + totalProducts + ' products saved.',
              'success'
            );
          }

          // Dispatch event for any listeners
          self.$dispatch('scan:routine-saved', {
            morning: self.products.morning.length,
            night: self.products.night.length,
            total: totalProducts
          });

          // Full page reload for fresh scan
          setTimeout(function() {
            window.location.reload();
          }, 1500); // 1.5s delay untuk kasih waktu baca toast
        })
        .catch(function(err) {
          console.error('[ScanPage] Failed to save routine:', err);
          if (self.$store && self.$store.ui) {
            self.$store.ui.showToast('Failed to save routine: ' + err.message, 'error');
          }
        });
    },

    /**
     * Reset scan page state for a new scan.
     * Called after successfully saving a routine.
     */
    resetScan() {
      console.log('[ScanPage] Resetting scan page for new scan...');
      
      // Reset all state variables to initial values
      this.capturedImage = null;
      this.showPopup = false;
      this.isAnalyzing = false;
      this.analysis = null;
      this.product = null;
      this.products = {
        morning: [],
        night: []
      };
      this.currentProductIndex = 0;
      this.healthScore = null;
      this.savedToSupabase = false;
      
      // Restart camera stream
      this.requestCamera();
      
      console.log('[ScanPage] Reset complete. Ready for new scan.');
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
