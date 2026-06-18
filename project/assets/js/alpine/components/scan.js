function createScanComponent() {
  return {
    selectedType: null,

    skinTypes: [
      { id: 'oily',        label: 'Oily Skin',        color: '#FFB5B5' },
      { id: 'dry',         label: 'Dry Skin',         color: '#B5D8FF' },
      { id: 'combination', label: 'Combination Skin', color: '#C5B5FF' },
      { id: 'normal',      label: 'Normal Skin',      color: '#B5FFC5' },
      { id: 'sensitive',   label: 'Sensitive Skin',   color: '#FFD5B5' },
      { id: 'unsure',      label: 'Not Sure :(',      color: '#D5D5E0' },
    ],

    init() {
      console.log('[INFO] [Scan] Component mounted.', {
        selectedType: this.selectedType,
      });
    },

    selectType(typeId) {
      if (this.selectedType === typeId) {
        this.selectedType = null;
        console.log('[INFO] [Scan] Selection cleared.');
      } else {
        this.selectedType = typeId;
        console.log('[INFO] [Scan] Skin type selected:', typeId);
      }
    },

    confirmSelection() {
      if (!this.selectedType) return;

      const selected = this.skinTypes.find(t => t.id === this.selectedType);
      console.log('[INFO] [Scan] Confirmed selection:', selected);

      if (this.$store?.ui) {
        this.$store.ui.addToast(
          `Skin type set to: ${selected.label}`,
          'success'
        );
      }

      this.$dispatch('skin:type-selected', {
        type: this.selectedType,
        label: selected.label,
      });

      if (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.IS_MOCK_MODE) {
        setTimeout(() => {
          window.location.href = '/pages/home/index.html';
        }, 600);
      }
    },
  };
}

function createScanPageComponent() {
  return {
    cameraReady: false,
    cameraError: null,
    capturedImage: null,
    stream: null,
    showPopup: false,
    routineType: 'morning',
    analysis: null,
    product: null,

    init() {
      this.startCamera();
    },

    async startCamera() {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        this.$refs.video.srcObject = this.stream;
        this.$refs.video.onloadedmetadata = () => {
          this.$refs.canvas.width = this.$refs.video.videoWidth;
          this.$refs.canvas.height = this.$refs.video.videoHeight;
          this.cameraReady = true;
        };
      } catch (err) {
        this.cameraError = 'Camera access denied. Please allow camera permissions.';
        console.error('[ScanPage] Camera error:', err);
      }
    },

    capturePhoto() {
      if (!this.cameraReady) return;

      const video = this.$refs.video;
      const canvas = this.$refs.canvas;
      const ctx = canvas.getContext('2d');

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      this.capturedImage = canvas.toDataURL('image/png');

      this.stopCamera();

      this.$dispatch('skin:photo-captured', { image: this.capturedImage });

      this.loadMockResults();
      this.showPopup = true;
    },

  loadMockResults() {
    this.analysis = {
      stats: [
        { label: 'Dark Spot', value: '10%' },
        { label: 'Pustules', value: '7%' },
        { label: 'Papules', value: '18%' },
      ],
      markers: [
        { id: 1, x: 35, y: 38, label: 'Dark Spot 10%' },
        { id: 2, x: 62, y: 55, label: 'Pustules 7%' },
        { id: 3, x: 45, y: 68, label: 'Papules 18%' },
      ],
    };

    this.product = {
      name: 'Facial Treatment Gentle Cleanser',
      description: 'A nourishing facial cleanser that gently cleanses while maintaining the skin\'s natural moisture balance.',
    };
  },

    retakePhoto() {
      this.capturedImage = null;
      this.showPopup = false;
      this.analysis = null;
      this.product = null;
      this.startCamera();
    },

    saveRoutine() {
      console.log('[ScanPage] Save routine:', this.routineType);
      this.showPopup = false;
    },

    stopCamera() {
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
      }
      this.cameraReady = false;
    },

    destroy() {
      this.stopCamera();
    },
  };
}
