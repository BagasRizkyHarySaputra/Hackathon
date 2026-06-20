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
