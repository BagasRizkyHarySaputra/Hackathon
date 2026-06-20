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
      const sb = window.__supabase;
      if (!sb || !APP_CONFIG.SUPABASE_ANON_KEY) {
        console.log('[Login] Supabase not configured — mock fallback mode.');
        return;
      }
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
          setTimeout(() => { window.location.href = '/scan'; }, 600);
        }
      });
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

    validateForm() {
      this.errorMessage = '';

      if (!this.email.trim()) {
        this.errorMessage = 'Please enter your email address.';
        return false;
      }

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

    async handleSubmit(event) {
      event.preventDefault();
      if (!this.validateForm()) return;

      this.isSubmitting = true;
      this.errorMessage = '';

      try {
        const sb = window.__supabase;
        const useSupabase = sb && APP_CONFIG.SUPABASE_ANON_KEY;

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
            setTimeout(() => { window.location.href = '/scan'; }, 600);
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

          const mockToken = 'mock_jwt_token_' + Date.now();
          const mockUser = {
            name: this.fullName || this.email.split('@')[0],
            email: this.email,
            role: 'user',
          };

          Alpine.store('auth').setToken(mockToken);
          Alpine.store('auth').setUser(mockUser);

          Alpine.store('ui').addToast('success', `Welcome back, ${mockUser.name}!`);

          setTimeout(() => { window.location.href = '/scan'; }, 800);
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
            redirectTo: `${window.location.origin}/login`,
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
