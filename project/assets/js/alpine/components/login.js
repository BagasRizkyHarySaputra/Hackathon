/**
 * ============================================================
 * FILE: assets/js/alpine/components/login.js
 * ============================================================
 * FEATURE: Login Page — Alpine.js Component
 *
 * PURPOSE:
 *   Manages the Sign In / Sign Up form with tab switching,
 *   password visibility toggle, form validation, and mock
 *   authentication. In Phase 2, form submission will go
 *   through HTMX to FastAPI.
 *
 * USE CASES:
 *   - User authenticates with email/password
 *   - User switches between Sign In and Sign Up tabs
 *   - User toggles password visibility
 *   - Social login buttons (Google, Facebook) — placeholder
 *
 * DEPENDENCIES:
 *   - Alpine.js v3.x (component data pattern)
 *   - config/app.config.js (API_BASE_URL, IS_MOCK_MODE)
 *   - assets/js/alpine/stores/auth.store.js (setToken, setUser)
 *   - assets/css/components/login.css
 *
 * PHASE: Frontend (Mock) — Auth is simulated
 * BACKEND CONTRACT: POST /api/auth/login → { token, user }
 * ============================================================
 */

/**
 * Creates the Alpine.js data object for the login page.
 * Manages tab state, form fields, validation, and mock auth.
 *
 * @returns {Object} Alpine component data object
 */
function createLoginComponent() {
  return {
    /** @type {'signin'|'signup'} Current active tab */
    activeTab: 'signin',

    /** @type {string} Email input value */
    email: '',

    /** @type {string} Password input value */
    password: '',

    /** @type {string} Confirm password (Sign Up only) */
    confirmPassword: '',

    /** @type {string} Full name (Sign Up only) */
    fullName: '',

    /** @type {boolean} Whether password is visible */
    showPassword: false,

    /** @type {boolean} Whether confirm password is visible */
    showConfirmPassword: false,

    /** @type {boolean} Whether form is being submitted */
    isSubmitting: false,

    /** @type {string} Error message to display */
    errorMessage: '',

    /**
     * Initializes the login component.
     * Called automatically by Alpine.js on mount.
     *
     * @returns {void}
     */
    init() {
      console.log('[INFO] [Login] Component mounted.', {
        keys: ['activeTab', 'email', 'password', 'showPassword'],
      });
    },

    /**
     * Switches between Sign In and Sign Up tabs.
     * Clears error messages on tab switch.
     *
     * @param {'signin'|'signup'} tab - Tab to activate
     * @returns {void}
     */
    switchTab(tab) {
      this.activeTab = tab;
      this.errorMessage = '';
      console.log('[INFO] [Login] Tab switched.', { tab });
    },

    /**
     * Toggles password visibility.
     *
     * @returns {void}
     */
    togglePassword() {
      this.showPassword = !this.showPassword;
    },

    /**
     * Toggles confirm password visibility.
     *
     * @returns {void}
     */
    toggleConfirmPassword() {
      this.showConfirmPassword = !this.showConfirmPassword;
    },

    /**
     * Returns the input type for the password field.
     * @returns {string} 'text' if visible, 'password' if hidden
     */
    get passwordType() {
      return this.showPassword ? 'text' : 'password';
    },

    /**
     * Returns the input type for the confirm password field.
     * @returns {string} 'text' if visible, 'password' if hidden
     */
    get confirmPasswordType() {
      return this.showConfirmPassword ? 'text' : 'password';
    },

    /**
     * Validates the form fields before submission.
     *
     * @returns {boolean} Whether the form is valid
     */
    validateForm() {
      this.errorMessage = '';

      if (!this.email.trim()) {
        this.errorMessage = 'Please enter your email address.';
        return false;
      }

      /** Basic email format check */
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(this.email)) {
        this.errorMessage = 'Please enter a valid email address.';
        return false;
      }

      if (!this.password) {
        this.errorMessage = 'Please enter your password.';
        return false;
      }

      if (this.password.length < 6) {
        this.errorMessage = 'Password must be at least 6 characters.';
        return false;
      }

      /** Sign Up specific validations */
      if (this.activeTab === 'signup') {
        if (!this.fullName.trim()) {
          this.errorMessage = 'Please enter your full name.';
          return false;
        }

        if (this.password !== this.confirmPassword) {
          this.errorMessage = 'Passwords do not match.';
          return false;
        }
      }

      return true;
    },

    /**
     * Handles form submission.
     * In mock mode, simulates a successful login after a delay.
     * In Phase 2, this will use HTMX POST to /api/auth/login.
     *
     * @param {Event} event - Form submit event
     * @returns {Promise<void>}
     */
    async handleSubmit(event) {
      event.preventDefault();

      if (!this.validateForm()) return;

      this.isSubmitting = true;
      this.errorMessage = '';

      console.log('[INFO] [Login] Form submitted.', {
        action: this.activeTab,
        email: this.email,
      });

      try {
        if (APP_CONFIG.IS_MOCK_MODE) {
          await new Promise(resolve => setTimeout(resolve, 1200));

          if (this.activeTab === 'signin') {
            if (this.email !== 'contoh@gmail.com' || this.password !== 'contoh123') {
              this.errorMessage = 'Email atau password salah.';
              this.isSubmitting = false;
              return;
            }
          }

          const mockToken = 'mock_jwt_token_' + Date.now();
          const mockUser = {
            name: this.fullName || this.email.split('@')[0],
            email: this.email,
            role: 'user',
          };

          /** Update auth store */
          Alpine.store('auth').login(mockToken, mockUser);

          console.log('[INFO] [Login] Mock login successful.', { user: mockUser });

          /** Dispatch event for navigation */
          this.$dispatch('auth:login-success', { user: mockUser });

          /** Show toast */
          Alpine.store('ui').addToast(
            'success',
            `Welcome back, ${mockUser.name}!`
          );

          setTimeout(() => {
            window.location.href = '/pages/scan/index.html';
          }, 800);
        } else {
          /**
           * Phase 2: Real API call via HTMX
           * htmx.ajax('POST', '/api/auth/login', {
           *   target: '#login-response',
           *   values: { email: this.email, password: this.password }
           * });
           */
        }
      } catch (error) {
        this.errorMessage = 'Login failed. Please try again.';
        console.error('[ERROR] [Login] Submission failed.', {
          error: error.message,
        });
      } finally {
        this.isSubmitting = false;
      }
    },

    /**
     * Handles social login button click.
     * Currently a placeholder for Phase 2 OAuth integration.
     *
     * @param {'google'|'facebook'} provider - Social provider name
     * @returns {void}
     */
    handleSocialLogin(provider) {
      Alpine.store('ui').addToast(
        'info',
        `${provider.charAt(0).toUpperCase() + provider.slice(1)} login coming soon!`
      );
      console.log('[INFO] [Login] Social login clicked.', { provider });
    },
  };
}
