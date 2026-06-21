(function() {
  // ── Auth Guard ──────────────────────────────────
  // In production: check for real Supabase session key (sb-*-auth-token).
  // In mock mode: check for any sb-* localStorage key.
  var hasSession = false;
  try {
    var isProduction = typeof APP_CONFIG !== 'undefined' && !APP_CONFIG.IS_MOCK_MODE;
    var supabaseRef = isProduction && APP_CONFIG.SUPABASE_URL
      ? APP_CONFIG.SUPABASE_URL.replace(/^https?:\/\//, '').split('.')[0]
      : null;

    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (!k) continue;

      if (isProduction && supabaseRef) {
        // Production: only accept real Supabase token key
        if (k.indexOf('sb-' + supabaseRef + '-auth-token') === 0) {
          hasSession = true;
          break;
        }
      } else {
        // Mock/fallback: accept any sb-* key
        if (k.indexOf('sb-') === 0) {
          hasSession = true;
          break;
        }
      }
    }
  } catch (e) {}
  if (!hasSession) {
    window.location.href = '/login';
    return;
  }
  // ────────────────────────────────────────────────

  var root = document.getElementById('sidebar-root');
  if (!root) return;

  var active = root.getAttribute('data-active') || 'home';

  var navItems = [
    { id: 'home', label: 'Home', icon: 'home.svg', href: '/home' },
    { id: 'community', label: 'Community', icon: 'Message.svg', href: '/community' },
    { id: 'scan', label: 'Scan', icon: 'camera.svg', href: '/scan-page' },
    { id: 'diary', label: 'Diary', icon: 'document.svg', href: '/artikel' },
    { id: 'profile', label: 'Profile', icon: 'user.svg', href: '/profile' }
  ];

  var html = '<div class="sidebar-column">' +
    '<div class="sidebar-logo">' +
      '<img src="/assets/icons/nav/licin.png" alt="LICIN" class="sidebar-logo__img" />' +
    '</div>' +
    '<aside class="sidebar">' +
      '<div class="sidebar__nav">';

  for (var i = 0; i < navItems.length; i++) {
    var item = navItems[i];
    var isActive = item.id === active;
    html += '<a href="' + item.href + '" class="nav-btn' + (isActive ? ' nav-btn--active' : '') + '" data-nav="' + item.id + '" aria-label="' + item.label + '">' +
      '<img src="/assets/icons/nav/' + item.icon + '" alt="" class="nav-btn__icon" />' +
    '</a>';
  }

  html += '</div></aside>' +
    '<div class="sidebar-mascot">' +
      '<img src="/assets/icons/water-drop-mascot.svg" alt="" aria-hidden="true" class="mascot-img" />' +
    '</div>' +
  '</div>';

  root.innerHTML = html;

  var mascot = root.querySelector('.mascot-img');
  if (mascot) {
    mascot.style.cursor = 'pointer';
    mascot.addEventListener('click', function() {
      window.location.href = '/chatbot';
    });
  }

})();
