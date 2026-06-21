function createLoginComponent() {
  return {
    activeTab: 'signin',
    animDirection: 'forward',
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    showPassword: false,
    showConfirmPassword: false,
    isSubmitting: false,
    errorMessage: '',

    init() {
      var self = this;

      function setupOAuthCallback(sb) {
        /**
         * Handle OAuth redirect callback: if Supabase placed a session
         * in the URL fragment, restore it and redirect to home.
         */
        sb.auth.getSession().then(({ data: { session } }) => {
          if (session) {
            const name = session.user.user_metadata?.full_name
              || session.user.user_metadata?.name
              || session.user.email;
            Alpine.store('auth').login(session.access_token, {
              id: session.user.id,
              email: session.user.email,
              name,
            });
            Alpine.store('ui').addToast('success', `Welcome back, ${name}!`);
            setTimeout(() => { window.location.href = '/loading'; }, 600);
          }
        });
      }

      const sb = window.__supabase;
      if (sb && APP_CONFIG.SUPABASE_ANON_KEY) {
        setupOAuthCallback(sb);
      } else if (APP_CONFIG.SUPABASE_ANON_KEY && !APP_CONFIG.IS_MOCK_MODE) {
        // Supabase module not loaded yet — wait for ready event
        console.log('[Login] Waiting for Supabase client to load...');
        document.addEventListener('supabase:ready', function readyHandler() {
          document.removeEventListener('supabase:ready', readyHandler);
          if (window.__supabase) {
            console.log('[Login] Supabase client ready — setting up OAuth callback.');
            setupOAuthCallback(window.__supabase);
          }
        });
      } else {
        console.log('[Login] Supabase not configured — mock fallback mode.');
      }
    },

    switchTab(tab) {
      if (tab === this.activeTab) return;
      this.animDirection = tab === 'signin' ? 'backward' : 'forward';
      this.activeTab = tab;
      this.errorMessage = '';
    },

    togglePassword() {
      this.showPassword = !this.showPassword;
    },

    toggleConfirmPassword() {
      this.showConfirmPassword = !this.showConfirmPassword;
    },

    get passwordType() {
      return this.showPassword ? 'text' : 'password';
    },

    get confirmPasswordType() {
      return this.showConfirmPassword ? 'text' : 'password';
    },

    /** Real-time password match check for sign-up form */
    get passwordMismatch() {
      return this.activeTab === 'signup' && this.confirmPassword.length > 0 && this.password !== this.confirmPassword;
    },

    get passwordMatchHint() {
      if (!this.confirmPassword) return '';
      if (this.password !== this.confirmPassword) return 'Passwords do not match';
      return 'Passwords match';
    },

    /** Real-time email format validation */
    get isValidEmail() {
      if (!this.email) return false;
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(this.email);
    },

    /** Sanitize user input to prevent script injection */
    sanitizeInput(str) {
      if (typeof str !== 'string') return '';
      return str
        .replace(/<[^>]*>/g, '')   // strip HTML tags
        .replace(/[<>"'`]/g, '')   // strip dangerous chars
        .trim();
    },

    validateForm() {
      this.errorMessage = '';

      if (!this.email.trim()) {
        this.errorMessage = 'Please enter your email address.';
        return false;
      }

      if (!this.isValidEmail) {
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
     * Store a mock session in localStorage (mock mode only).
     * In production, Supabase Auth handles session persistence automatically.
     */
    _storeMockSession(token, user) {
      if (!APP_CONFIG.IS_MOCK_MODE) return;

      Alpine.store('auth').setToken(token);
      Alpine.store('auth').setUser(user);
      Alpine.store('auth').isAuthenticated = true;

      try {
        // Store in localStorage for cross-page persistence in mock mode
        localStorage.setItem('sb-mock-token', JSON.stringify({
          access_token: token,
          user: {
            id: user.id,
            email: user.email,
            name: this.sanitizeInput(user.name),
          },
        }));
        // Also store mock user list for sign-in credential check (sanitized)
        var sanitizedEmail = this.sanitizeInput(user.email);
        var stored = JSON.parse(localStorage.getItem('sb-mock-users') || '[]');
        var existing = stored.findIndex(function(u) { return u.email === sanitizedEmail; });
        if (existing === -1) {
          stored.push({ email: sanitizedEmail, password: this.password, name: this.sanitizeInput(user.name) });
        } else {
          stored[existing] = { email: sanitizedEmail, password: this.password, name: this.sanitizeInput(user.name) };
        }
        localStorage.setItem('sb-mock-users', JSON.stringify(stored));
      } catch(e) {
        console.warn('[Login] Could not persist mock session', e);
      }
    },

    async handleSubmit(event) {
      event.preventDefault();
      if (!this.validateForm()) return;

      this.isSubmitting = true;
      this.errorMessage = '';

      try {
        const sb = window.__supabase;
        const useSupabase = sb && APP_CONFIG.SUPABASE_ANON_KEY && !APP_CONFIG.IS_MOCK_MODE;

        if (useSupabase) {
          if (this.activeTab === 'signin') {
            const { data, error } = await sb.auth.signInWithPassword({
              email: this.email,
              password: this.password,
            });
            if (error) { this.errorMessage = error.message; return; }

            Alpine.store('auth').login(
              data.session.access_token,
              { id: data.user.id, email: data.user.email, name: data.user.user_metadata?.full_name || data.user.email }
            );
            Alpine.store('ui').addToast('success', `Welcome back, ${data.user.email}!`);
            setTimeout(() => { window.location.href = '/loading'; }, 600);
          } else {
            const { data, error } = await sb.auth.signUp({
              email: this.email,
              password: this.password,
              options: { data: { full_name: this.fullName } },
            });
            if (error) { this.errorMessage = error.message; return; }

            if (data?.user?.identities?.length === 0) {
              this.errorMessage = 'An account with this email already exists.';
              return;
            }

            Alpine.store('ui').addToast('success', 'Account created! Check your email to confirm.');
            this.activeTab = 'signin';
          }
        } else {
          /** Fallback: mock mode */
          await new Promise(resolve => setTimeout(resolve, 1200));

          if (this.activeTab === 'signin') {
            // Check if this user signed up in mock mode before
            var storedUsers = [];
            try { storedUsers = JSON.parse(localStorage.getItem('sb-mock-users') || '[]'); } catch(e) {}
            var found = storedUsers.find(function(u) { return u.email === this.email && u.password === this.password; }.bind(this));

            if (!found) {
              this.errorMessage = 'Invalid email or password. Please try again or sign up.';
              this.isSubmitting = false;
              return;
            }

            const mockToken = 'mock_jwt_token_' + Date.now();
            const mockUser = {
              id: 'mock_' + btoa(this.email).replace(/=/g, ''),
              name: found.name,
              email: this.email,
              role: 'user',
            };
            this._storeMockSession(mockToken, mockUser);
            Alpine.store('ui').addToast('success', `Welcome back, ${mockUser.name}!`);
            setTimeout(function () { window.location.href = '/loading'; }, 800);
          } else {
            // Sign up in mock mode — store user but DON'T auto-login
            var sanitizedName = this.sanitizeInput(this.fullName || this.email.split('@')[0]);
            var sanitizedEmail = this.sanitizeInput(this.email);
            var mockUser = {
              name: sanitizedName,
              email: sanitizedEmail,
            };
            // Store credentials so sign-in can find them later (sanitized)
            try {
              var stored = JSON.parse(localStorage.getItem('sb-mock-users') || '[]');
              var existing = stored.findIndex(function(u) { return u.email === sanitizedEmail; });
              if (existing === -1) {
                stored.push({ email: sanitizedEmail, password: this.password, name: sanitizedName });
              } else {
                stored[existing] = { email: sanitizedEmail, password: this.password, name: sanitizedName };
              }
              localStorage.setItem('sb-mock-users', JSON.stringify(stored));
            } catch(e) { console.warn('[Login] Could not persist mock user', e); }

            Alpine.store('ui').addToast('success', 'Account created! Please sign in.');
            this.activeTab = 'signin';
            this.isSubmitting = false;
            return; // Don't redirect — stay on login page
          }
        }
      } catch (error) {
        this.errorMessage = 'Login failed. Please try again.';
        console.error('[Login] Submission failed.', error);
      } finally {
        this.isSubmitting = false;
      }
    },

    handleSocialLogin(provider) {
      const sb = window.__supabase;
      const useSupabase = sb && APP_CONFIG.SUPABASE_ANON_KEY;

      if (useSupabase) {
        sb.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo: `${window.location.origin}/loading`,
          },
        });
      } else {
        Alpine.store('ui').addToast(
          'info',
          `${provider.charAt(0).toUpperCase() + provider.slice(1)} login coming soon!`
        );
      }
    },
  };
}
