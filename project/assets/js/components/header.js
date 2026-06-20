(function() {
  var root = document.getElementById('header-root');
  if (!root) return;

  var showGreeting = root.getAttribute('data-show-greeting') === 'true';

  function getGreetingName() {
    return root.getAttribute('data-name') || 'Username';
  }

  function buildHeader(name) {
    var greetingName = name || getGreetingName();

    var html = '<div class="home-header__actions">' +
      '<button class="header-action-btn" aria-label="Notifications">' +
        '<img src="/assets/icons/nav/Notification.svg" alt="" class="header-action-icon" />' +
      '</button>' +
      '<button class="avatar-btn" aria-label="Profile">' +
        '<img src="/assets/icons/nav/Profile.svg" alt="" class="avatar-btn__icon" />' +
      '</button>' +
    '</div>';

    if (showGreeting) {
      html = '<div class="home-header__greeting-wrap">' +
        '<h1 class="home-header__greeting">Hello, ' + greetingName + '!</h1>' +
        '<p class="home-header__sub">Ready to check your skin today?</p>' +
      '</div>' + html;
    }

    root.innerHTML = html;
  }

  buildHeader();

  function updateNameFromAuth() {
    var sb = window.__supabase;
    if (!sb) return;
    sb.auth.getSession().then(function(result) {
      var session = result.data.session;
      if (!session) return;
      var name = session.user.user_metadata.full_name
              || session.user.user_metadata.name
              || session.user.email;
      if (name) {
        buildHeader(name.split(' ')[0]);
      }
    });
  }

  if (window.__supabase) {
    updateNameFromAuth();
  }
  document.addEventListener('supabase:ready', updateNameFromAuth);
})();
