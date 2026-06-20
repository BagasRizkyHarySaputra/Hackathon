/**
 * ============================================================
 * FILE: assets/js/alpine/components/scan-page.js
 * ============================================================
 * FEATURE: Scan Page — Camera Capture & Analysis Alpine Component
 *
 * PURPOSE:
 *   Manages the camera-based skin scanning UI. Opens the device
 *   camera, captures a photo, then displays mock analysis markers
 *   and a product recommendation overlay.
 *
 * USE CASES:
 *   - Accessed from the sidebar "Scan" link on authenticated pages
 *   - Camera permission prompt shown on each visit if not granted
 *
 * DEPENDENCIES:
 *   - Alpine.js v3.x (component data pattern)
 *   - config/app.config.js
 *   - assets/css/components/scan-page.css
 *
 * PHASE: Frontend (Mock)
 * ============================================================
 */

/**
 * Creates the Alpine.js data object for the camera scan page.
 * Camera access is required — user must grant permission before scanning.
 *
 * @returns {Object} Alpine component data object
 */
function createScanPageComponent() {
  return {
    /** @type {string|null} Base64 captured image data */
    capturedImage: null,

    /** @type {string|null} Camera error message (null when OK) */
    cameraError: null,

    /** @type {boolean} Whether the results popup is visible */
    showPopup: false,

    /** @type {boolean} Whether the camera stream is ready */
    cameraReady: false,

    /** @type {Object|null} Mock analysis result with skin markers */
    analysis: null,

    /** @type {Object|null} Recommended product from analysis */
    product: null,

    /** @type {'morning'|'night'} Selected routine type */
    routineType: 'morning',

    /** @type {MediaStream|null} Active camera stream (for cleanup) */
    _stream: null,

    /**
     * Component mount — immediately requests camera access.
     */
    init() {
      console.log('[INFO] [ScanPage] Component mounted.');
      this.requestCamera();
    },

    /**
     * Requests camera access. Sets cameraReady=true on success,
     * or cameraError with description on failure.
     * Safe to call multiple times (e.g. after a previous denial).
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
              console.log('[INFO] [ScanPage] Camera ready.');
            }.bind(this);
          }
        } catch (err) {
          console.log('[INFO] [ScanPage] Camera error:', err.message);

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
     * Captures a photo from the video stream.
     * If camera is not ready, retries the request instead of mocking.
     */
    capturePhoto() {
      if (!this.cameraReady) {
        // Don't silently mock — try camera again
        this.requestCamera();
        return;
      }

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

      console.log('[INFO] [ScanPage] Photo captured.');
      this._runMockAnalysis();
      this.showPopup = true;
    },

    /**
     * Runs mock skin analysis.
     */
    _runMockAnalysis() {
      this.analysis = {
        markers: [
          { id: 1, label: 'Blackhead', x: 30, y: 40 },
          { id: 2, label: 'Dry spot',  x: 60, y: 55 },
          { id: 3, label: 'Redness',   x: 45, y: 70 },
        ],
      };

      this.product = {
        name: 'Gentle Foaming Cleanser',
        description: 'Sulfate-free cleanser for all skin types. Removes impurities without stripping moisture.',
      };

      console.log('[INFO] [ScanPage] Mock analysis complete.', this.analysis);
    },

    /**
     * Saves the selected routine.
     */
    saveRoutine() {
      console.log('[INFO] [ScanPage] Routine saved:', this.routineType);

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
        console.log('[INFO] [ScanPage] Camera stream stopped.');
      }
    },
  };
}
