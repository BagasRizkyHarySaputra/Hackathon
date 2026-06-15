(function() {
  var root = document.getElementById('header-root');
  if (!root) return;

  var showGreeting = root.getAttribute('data-show-greeting') === 'true';
  var greetingName = root.getAttribute('data-name') || 'Username';

  var html = '<div class="home-header__actions">' +
    '<button class="header-action-btn" aria-label="Notifications">' +
      '<img src="/assets/icons/nav/Notification.svg" alt="" class="header-action-icon" />' +
    '</button>' +
    '<button class="avatar-btn" aria-label="Profile">' +
      '<img src="/assets/icons/nav/Profile.svg" alt="" class="avatar-btn__icon" />' +
    '</button>' +
  '</div>';

  if (showGreeting) {
    html = '<div>' +
      '<h1 class="home-header__greeting">Hello, ' + greetingName + '!</h1>' +
      '<p class="home-header__sub">Ready to check your skin today?</p>' +
    '</div>' + html;
  }

  root.innerHTML = html;
})();
