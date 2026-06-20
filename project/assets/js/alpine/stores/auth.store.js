document.addEventListener('alpine:init', () => {
  Alpine.store('auth', {
    isAuthenticated: false,
    token: null,
    user: null,

    login(token, user) {
      this.token = token;
      this.user = user;
      this.isAuthenticated = true;
      console.log('[Auth Store] User logged in.', { email: user?.email });
    },

    setToken(token) {
      this.token = token;
      this.isAuthenticated = !!token;
    },

    setUser(user) {
      this.user = user;
    },

    logout() {
      if (window.__supabase) {
        window.__supabase.auth.signOut().catch(console.warn);
      }
      this.token = null;
      this.user = null;
      this.isAuthenticated = false;
      console.log('[Auth Store] User logged out.');
    },

    hasRole(role) {
      return this.user?.role === role;
    },
  });

  function initSupabaseAuth() {
    const sb = window.__supabase;
    if (!sb) return;

    sb.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        Alpine.store('auth').login(
          session.access_token,
          {
            id: session.user.id,
            email: session.user.email,
            name: session.user.user_metadata?.full_name || session.user.email,
            avatar: session.user.user_metadata?.avatar_url || '',
          }
        );
        console.log('[Auth Store] Session restored from Supabase.');

        // Edge case: if SIGNED_IN event didn't fire (e.g. URL hash callback on root page),
        // still redirect to /loading. Skip on login, scan & loading pages.
        const onLoginPage = window.location.pathname === '/login'
                          || window.location.pathname === '/login/'
                          || window.location.pathname.startsWith('/pages/login/');
        const onScanPage = window.location.pathname === '/scan'
                        || window.location.pathname === '/scan/'
                        || window.location.pathname.startsWith('/pages/scan/');
        const onLoadingPage = window.location.pathname === '/loading'
                        || window.location.pathname === '/loading/'
                        || window.location.pathname.startsWith('/pages/loading/');
        if (!onLoginPage && !onScanPage && !onLoadingPage && window.location.hash.startsWith('#access_token=')) {
          const name = session.user.user_metadata?.full_name
                    || session.user.user_metadata?.name
                    || session.user.email;
          Alpine.store('ui').addToast('success', `Welcome back, ${name}!`);
          // Clean the URL hash before redirecting
          history.replaceState(null, '', window.location.pathname);
          setTimeout(() => { window.location.href = '/loading'; }, 600);
        }
      }
    });

    sb.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        Alpine.store('auth').login(
          session.access_token,
          {
            id: session.user.id,
            email: session.user.email,
            name: session.user.user_metadata?.full_name || session.user.email,
            avatar: session.user.user_metadata?.avatar_url || '',
          }
        );

        // If not on the login, scan, or loading page, redirect to /loading.
        const isLoginPage = window.location.pathname === '/login'
                          || window.location.pathname === '/login/'
                          || window.location.pathname.startsWith('/pages/login/');
        const isScanPage = window.location.pathname === '/scan'
                        || window.location.pathname === '/scan/'
                        || window.location.pathname.startsWith('/pages/scan/');
        const isLoadingPage = window.location.pathname === '/loading'
                        || window.location.pathname === '/loading/'
                        || window.location.pathname.startsWith('/pages/loading/');
        if (!isLoginPage && !isScanPage && !isLoadingPage) {
          const name = session.user.user_metadata?.full_name
                    || session.user.user_metadata?.name
                    || session.user.email;
          Alpine.store('ui').addToast('success', `Welcome back, ${name}!`);
          setTimeout(() => { window.location.href = '/loading'; }, 600);
        }
      } else if (event === 'SIGNED_OUT') {
        Alpine.store('auth').logout();
      } else if (event === 'TOKEN_REFRESHED') {
        Alpine.store('auth').token = session?.access_token || null;
      }
    });
  }

  if (window.__supabase) {
    initSupabaseAuth();
  }
  document.addEventListener('supabase:ready', initSupabaseAuth);

  console.log('[Alpine] Auth store initialized.');
});
