(function() {
  var root = document.getElementById('sidebar-root');
  if (!root) return;

  var active = root.getAttribute('data-active') || 'home';

  var navItems = [
    { id: 'home', label: 'Home', icon: 'home.svg', href: '/pages/home/index.html' },
    { id: 'community', label: 'Community', icon: 'Message.svg', href: '/pages/community/index.html' },
    { id: 'scan', label: 'Scan', icon: 'camera.svg', href: '/pages/scan-page/index.html' },
    { id: 'diary', label: 'Diary', icon: 'document.svg', href: '/pages/artikel/index.html' },
    { id: 'profile', label: 'Profile', icon: 'user.svg', href: '/pages/profile/index.html' }
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


})();
