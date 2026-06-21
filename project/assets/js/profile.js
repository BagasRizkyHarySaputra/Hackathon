/**
 * ============================================================
 * FILE: assets/js/profile.js
 * ============================================================
 * FEATURE: Profile Page — Fetch & Render from Supabase
 *
 * PURPOSE:
 *   Reads the authenticated user's profile, skin type, routines,
 *   and skin score from Supabase and renders into the profile page.
 *   Handles edit form population and save to Supabase.
 *
 * DATA SOURCE: Supabase profiles + skincare_routines tables (REST API)
 * ============================================================
 */
(function () {
  'use strict';

  /* ─── Supabase Config ─── */
  var SUPABASE_URL = 'https://gvkzgicbykyjkusxranv.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2a3pnaWNieWt5amt1c3hyYW52Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4OTg0OTAsImV4cCI6MjA5NzQ3NDQ5MH0.8DEahyrZ-IxZmuM7wVuO6-LP3K4IfX3v3eNsXnh_Hzw';

  function getUserToken() {
    var authStore = window.Alpine && Alpine.store('auth');
    if (authStore && authStore.token) return authStore.token;
    return null;
  }

  function supabaseHeaders(useAuth) {
    var token = useAuth ? getUserToken() : null;
    return {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + (token || SUPABASE_ANON_KEY)
    };
  }

  /* ─── State ─── */
  var currentUserId = null;
  var currentProfile = null;
  var morningRoutines = [];
  var nightRoutines = [];

  /* ─── DOM refs ─── */
  function getEl(id) { return document.getElementById(id); }

  /* ─── Init ─── */
  function init() {
    getCurrentUser().then(function (userId) {
      if (!userId) {
        console.warn('[Profile] No authenticated user found.');
        return;
      }
      currentUserId = userId;
      fetchProfileAndRender(userId);
      fetchRoutinesAndRender(userId);
    });
  }

  /* ─── Get current user from Supabase session ─── */
  function getCurrentUser() {
    return new Promise(function (resolve) {
      // Try Alpine auth store first
      var authStore = window.Alpine && Alpine.store('auth');
      if (authStore && authStore.user && authStore.user.id && authStore.token) {
        resolve(authStore.user.id);
        return;
      }

      var sb = window.__supabase;
      if (sb) {
        sb.auth.getSession().then(function (result) {
          var session = result.data && result.data.session;
          if (session && session.user) {
            if (authStore && !authStore.token) {
              authStore.login(session.access_token, {
                id: session.user.id,
                email: session.user.email,
                name: session.user.user_metadata && session.user.user_metadata.full_name || session.user.email,
                avatar: session.user.user_metadata && session.user.user_metadata.avatar_url || ''
              });
            }
            resolve(session.user.id);
          } else {
            resolve(null);
          }
        }).catch(function () {
          resolve(null);
        });
        return;
      }

      resolve(null);
    });
  }

  /* ─── Fetch user profile ─── */
  function fetchProfileAndRender(userId) {
    var url = SUPABASE_URL + '/rest/v1/profiles?select=*&id=eq.' + encodeURIComponent(userId);

    fetch(url, { headers: supabaseHeaders() })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        if (data && data.length > 0) {
          currentProfile = data[0];
          renderProfile(currentProfile);
        } else {
          console.log('[Profile] No profile found for user, creating one...');
          createDefaultProfile(userId);
        }
      })
      .catch(function (err) {
        console.error('[Profile] Failed to fetch profile:', err);
      });
  }

  function createDefaultProfile(userId) {
    // Get user metadata from auth for name/avatar/email
    var sb = window.__supabase;
    var name = 'User';
    var avatarUrl = '';
    var email = '';

    if (sb) {
      sb.auth.getSession().then(function (result) {
        var user = result.data && result.data.session && result.data.session.user;
        if (user) {
          name = user.user_metadata.full_name || user.user_metadata.name || user.email || 'User';
          avatarUrl = user.user_metadata.avatar_url || '';
          email = user.email || '';
        }
        upsertProfile(userId, name, avatarUrl, 'unsure', email);
      }).catch(function () {
        upsertProfile(userId, 'User', '', 'unsure', '');
      });
    } else {
      upsertProfile(userId, 'User', '', 'unsure', '');
    }
  }

  function upsertProfile(userId, name, avatarUrl, skinType, email) {
    var url = SUPABASE_URL + '/rest/v1/profiles?on_conflict=id';
    var payload = {
      id: userId,
      name: name,
      profile_image_url: avatarUrl,
      skin_type: skinType
    };
    if (email) payload.email = email;
    var body = JSON.stringify(payload);

    fetch(url, {
      method: 'POST',
      headers: Object.assign({}, supabaseHeaders(true), { 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates' }),
      body: body
    })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      })
      .then(function () {
        // Re-fetch to get the complete profile with timestamps
        fetchProfileAndRender(userId);
      })
      .catch(function (err) {
        console.error('[Profile] Failed to upsert profile:', err);
      });
  }

  /* ─── Render profile data into page ─── */
  function renderProfile(profile) {
    // Avatar
    var avatarImg = getEl('profile-avatar-img');
    if (avatarImg && profile.profile_image_url) {
      avatarImg.src = profile.profile_image_url;
    }

    // Name
    var nameEl = document.querySelector('.account-profile-header__name');
    if (nameEl && profile.name) {
      nameEl.textContent = profile.name;
    }

    // Skin Type — profile header
    var skinTypeEl = document.querySelector('.account-profile-header__type');
    if (skinTypeEl) {
      skinTypeEl.textContent = profile.skin_type ? capitalize(profile.skin_type) : 'Unknown';
    }

    // Member since
    var memberEl = document.querySelector('.account-profile-header__member span');
    if (memberEl && profile.created_at) {
      var d = new Date(profile.created_at);
      var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      memberEl.textContent = 'Member since ' + months[d.getMonth()] + ' ' + d.getFullYear();
    }

    // Skin Type Card
    var stLabel = document.querySelector('.skin-type__label');
    var stDesc = document.querySelector('.skin-type__desc');
    if (stLabel) {
      stLabel.textContent = profile.skin_type ? capitalize(profile.skin_type) : 'Unknown';
      if (stDesc) {
        stDesc.textContent = profile.skin_type ? getSkinTypeDescription(profile.skin_type) : 'Take our skin analysis to find out your skin type!';
      }
    }

    // Populate account edit form fields
    populateEditForm(profile);

    // Populate edit-profile page if on that page
    var editAvatar = getEl('edit-avatar-img');
    if (editAvatar && profile.profile_image_url) {
      editAvatar.src = profile.profile_image_url;
    }
    var editName = document.querySelector('#account-grid-wrap .account-field__input');
    if (editName && profile.name) {
      editName.value = profile.name;
    }
  }

  function populateEditForm(profile) {
    // Name
    var nameInput = document.getElementById('edit-name');
    if (nameInput && profile.name) nameInput.value = profile.name;

    // Email — from auth store first, then fall back to profile.email column
    var emailInput = document.getElementById('edit-email');
    if (emailInput) {
      var authStore = window.Alpine && Alpine.store('auth');
      var authEmail = authStore && authStore.user && authStore.user.email;
      emailInput.value = authEmail || profile.email || '';
    }

    // Gender
    var genderSelect = document.getElementById('edit-gender');
    if (genderSelect && profile.gender) {
      genderSelect.value = profile.gender;
    }

    // Birth date
    var birthdateInput = document.getElementById('edit-birthdate');
    if (birthdateInput && profile.birth_date) {
      // birth_date is YYYY-MM-DD from Postgres DATE type
      birthdateInput.value = profile.birth_date;
    }

    // Pre-select skin type — use .account-skin-option regardless of page
    var skinOpts = document.querySelectorAll('.account-skin-option');
    skinOpts.forEach(function (opt) {
      var skin = opt.getAttribute('data-skin');
      if (skin === profile.skin_type) {
        opt.classList.add('account-skin-option--selected');
      } else {
        opt.classList.remove('account-skin-option--selected');
      }
    });
  }

  /* ─── Fetch skincare routines ─── */
  function fetchRoutinesAndRender(userId) {
    var url = SUPABASE_URL + '/rest/v1/skincare_routines?select=*&user_id=eq.' + encodeURIComponent(userId) + '&order=step_order.asc';

    fetch(url, { headers: supabaseHeaders(true) })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        morningRoutines = [];
        nightRoutines = [];

        for (var i = 0; i < data.length; i++) {
          var r = data[i];
          if (r.routine_type === 'morning') {
            morningRoutines.push(r);
          } else if (r.routine_type === 'night') {
            nightRoutines.push(r);
          }
        }

        renderRoutines();
        updateSkinScore(morningRoutines.length + nightRoutines.length);
      })
      .catch(function (err) {
        // 404 = table doesn't exist yet, keep hardcoded examples
        console.warn('[Profile] skincare_routines table not found (404). Run migration. Using hardcoded.', err.message);
        renderRoutines();
        updateSkinScore(6);  // assume full routine
      });
  }

  /* ─── Render routine items ─── */
  function renderRoutines() {
    var morningEl = getEl('routine-morning');
    var nightEl = getEl('routine-night');

    if (morningEl && morningRoutines.length > 0) {
      morningEl.innerHTML = buildRoutineHtml(morningRoutines);
    }

    if (nightEl && nightRoutines.length > 0) {
      nightEl.innerHTML = buildRoutineHtml(nightRoutines);
    }
  }

  function buildRoutineHtml(routines) {
    var html = '';
    for (var i = 0; i < routines.length; i++) {
      var r = routines[i];
      var imgHtml;

      if (r.product_image_url) {
        imgHtml = '<img src="' + escAttr(r.product_image_url) + '" alt="" />';
      } else {
        // Placeholder SVG icon
        imgHtml = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">' +
          '<circle cx="12" cy="12" r="10"/>' +
          '<path d="M12 6v6l4 2"/>' +
          '</svg>';
      }

      html +=
        '<div class="routine-item">' +
          '<div class="routine-item__img">' + imgHtml + '</div>' +
          '<div class="routine-item__info">' +
            '<div class="routine-item__name">' + escHtml(r.product_name || '') + '</div>' +
            '<p class="routine-item__desc">' + escHtml(r.product_description || '') + '</p>' +
          '</div>' +
        '</div>';
    }
    return html;
  }

  /* ─── Skin Score ─── */
  function updateSkinScore(routineProductCount) {
    // Score = percentage of a "complete" routine (6 products: 3 morning + 3 night)
    var maxRoutines = 6;
    var percentage = Math.min(100, Math.round((routineProductCount / maxRoutines) * 100));

    var label;
    if (percentage >= 80) {
      label = 'Great';
    } else if (percentage >= 40) {
      label = 'Good';
    } else {
      label = 'Bad';
    }

    // Update DOM
    var scoreValue = document.querySelector('.skin-score__value');
    var scoreLabel = document.querySelector('.skin-score__label');
    var scoreCircle = document.querySelector('.skin-score__circle svg circle:nth-child(2)');

    if (scoreValue) scoreValue.textContent = percentage;
    if (scoreLabel) scoreLabel.textContent = label;

    // Update SVG circle stroke offset
    if (scoreCircle) {
      var circumference = 2 * Math.PI * 63;  // r=63
      var offset = circumference - (percentage / 100) * circumference;
      scoreCircle.setAttribute('stroke-dasharray', circumference);
      scoreCircle.setAttribute('stroke-dashoffset', offset);
    }
  }

  /* ─── Save Profile (wired to account save button) ─── */
  function wireSaveButton() {
    var saveBtn = document.querySelector('.account-save-btn');
    if (!saveBtn) return;

    // Remove existing listeners by cloning (simple approach)
    var newBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newBtn, saveBtn);

    newBtn.addEventListener('click', function () {
      if (!currentUserId) {
        console.warn('[Profile] Cannot save — no authenticated user.');
        return;
      }

      var nameInput = document.getElementById('edit-name');
      var emailInput = document.getElementById('edit-email');
      var genderSelect = document.getElementById('edit-gender');
      var birthdateInput = document.getElementById('edit-birthdate');

      var name = nameInput ? nameInput.value.trim() : '';
      var email = emailInput ? emailInput.value.trim() : '';
      var gender = genderSelect ? genderSelect.value : '';
      var birthDate = birthdateInput ? birthdateInput.value : '';

      // Get selected skin type
      var selectedSkin = 'unsure';
      var skinOpts = document.querySelectorAll('.account-skin-option');
      skinOpts.forEach(function (opt) {
        if (opt.classList.contains('account-skin-option--selected')) {
          selectedSkin = opt.getAttribute('data-skin');
        }
      });

      if (!name) {
        console.warn('[Profile] Name is required.');
        return;
      }

      var url = SUPABASE_URL + '/rest/v1/profiles?on_conflict=id';
      var payload = {
        id: currentUserId,
        name: name,
        skin_type: selectedSkin
      };
      if (email) payload.email = email;
      if (gender) payload.gender = gender;
      if (birthDate) payload.birth_date = birthDate;

      var body = JSON.stringify(payload);

      fetch(url, {
        method: 'POST',
        headers: Object.assign({}, supabaseHeaders(true), { 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates' }),
        body: body
      })
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.text();
        })
        .then(function () {
          // Update display
          currentProfile.name = name;
          currentProfile.email = email;
          currentProfile.gender = gender;
          currentProfile.birth_date = birthDate;
          currentProfile.skin_type = selectedSkin;

          newBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg> Saved!';
          setTimeout(function () {
            newBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg> Save';
          }, 1500);
        })
        .catch(function (err) {
          console.error('[Profile] Failed to save profile:', err);
        });
    });
  }

  /* ─── Avatar upload handler ─── */
  function wireAvatarUpload() {
    var uploadInput = getEl('profile-avatar-upload') || getEl('edit-avatar-upload');
    if (!uploadInput) return;

    uploadInput.addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;

      // For now just store it locally — Supabase Storage integration can be added later
      // The existing compression + DataURL logic in the inline script handles display
      console.log('[Profile] Avatar selected:', file.name, '(' + (file.size / 1024).toFixed(1) + 'KB)');
    });
  }

  function wireSignOut() {
    var signOutItems = document.querySelectorAll('.settings-bar__item');
    signOutItems.forEach(function (item) {
      var label = item.querySelector('.settings-bar__label');
      if (!label || label.textContent.trim() !== 'Sign Out') return;
      if (item.hasAttribute('data-signout-wired')) return;

      item.setAttribute('data-signout-wired', 'true');
      item.classList.remove('settings-bar__item--disabled');
      item.style.cursor = 'pointer';
      item.addEventListener('click', function () {
        var authStore = window.Alpine && Alpine.store('auth');
        if (authStore) authStore.logout();
        // authStore.logout() calls sb.auth.signOut() internally,
        // no need to call it again here — just redirect.
        window.location.href = '/';
      });
    });
  }

  /* ─── Helpers ─── */
  function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function escHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function escAttr(str) {
    if (!str) return '';
    return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function getSkinTypeDescription(skinType) {
    var descs = {
      'oily': 'Produces excess sebum, especially on the T-zone area.',
      'dry': 'Lacks moisture and natural oils. Can feel tight or flaky.',
      'combination': 'Balance but can be oily on T-Zone and dry on cheeks.',
      'sensitive': 'Easily irritated, prone to redness and reactions.',
      'normal': 'Well-balanced, neither too oily nor too dry.',
      'unsure': 'Take our skin analysis to find out your skin type!'
    };
    return descs[skinType] || '';
  }

  /* ─── Wait for Supabase client and Alpine, then init ─── */
  function waitAndInit() {
    if (window.Alpine && window.Alpine.store && window.Alpine.store('auth')) {
      init();
      wireSaveButton();
      wireAvatarUpload();
      wireSignOut();
      return;
    }

    document.addEventListener('alpine:init', function () {
      init();
      wireSaveButton();
      wireAvatarUpload();
      wireSignOut();
    });
  }

  // Wait for supabase:ready if not already available
  if (window.__supabase) {
    waitAndInit();
  } else {
    document.addEventListener('supabase:ready', waitAndInit);
  }
})();
