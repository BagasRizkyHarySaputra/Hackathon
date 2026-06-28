/**
 * LICIN — Home Page Logic
 *
 * Loads diary photos from Supabase scan_results and displays them
 * in the 3 diary-thumb cards. Photos are served via Telegram proxy.
 * Also handles the before/after image slider and progress table.
 */

(function () {
  var DIARY_THUMBS = document.querySelectorAll('.diary-thumb');
  var PLACEHOLDER_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="#95B4C6" stroke-width="1.5" width="48" height="48"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="12" r="4"/></svg>';

  /** Maps Supabase column names to display labels */
  var ACNE_LABELS = {
    blackheads: 'Blackheads',
    dark_spot: 'Dark Spot',
    nodules: 'Nodules',
    papules: 'Papules',
    pustules: 'Pustules',
    whiteheads: 'Whiteheads',
  };

  /** Acne type display order */
  var ACNE_ORDER = ['blackheads', 'dark_spot', 'nodules', 'papules', 'pustules', 'whiteheads'];

  function setThumbPhoto(index, fileId) {
    if (!DIARY_THUMBS[index]) return;
    var thumb = DIARY_THUMBS[index];
    var photoUrl = '/api/telegram/photo?file_id=' + encodeURIComponent(fileId);
    console.log('[Home] setThumbPhoto(' + index + ') - Week ' + (index+1) + ' - URL:', photoUrl);
    thumb.innerHTML = '<img src="' + photoUrl +
      '" alt="Diary photo" style="width:100%;height:100%;object-fit:cover;border-radius:1vw;" ' +
      'onerror="this.parentElement.innerHTML=\'' + PLACEHOLDER_SVG + '\'; console.error(\'[Home] Photo load failed for Week ' + (index+1) + '\');" />';
  }

  function resetThumb(index) {
    if (!DIARY_THUMBS[index]) return;
    DIARY_THUMBS[index].innerHTML = PLACEHOLDER_SVG;
  }

  /**
   * Fetches scan_results and profile data.
   * Returns { userId, profiles, scans } or null if not ready.
   */
  function fetchScanData(callback) {
    var sb = window.__supabase;
    if (!sb) { return; }

    var authStore = window.Alpine && Alpine.store('auth');
    if (!authStore || !authStore.user || !authStore.user.id) {
      setTimeout(function () { fetchScanData(callback); }, 500);
      return;
    }

    var userId = authStore.user.id;

    Promise.all([
      fetch(window.APP_CONFIG.SUPABASE_URL + '/rest/v1/profiles?id=eq.' + encodeURIComponent(userId) + '&select=created_at', {
        headers: getHeaders(authStore),
      }).then(function (r) { return r.json(); }),
      fetch(window.APP_CONFIG.SUPABASE_URL + '/rest/v1/scan_results?user_id=eq.' + encodeURIComponent(userId) + '&select=*&order=created_at.asc', {
        headers: getHeaders(authStore),
      }).then(function (r) { return r.json(); }),
    ])
      .then(function (results) {
        callback({
          userId: userId,
          profiles: results[0],
          scans: results[1],
        });
      })
      .catch(function (err) {
        console.warn('[Home] Failed to fetch scan data:', err.message);
      });
  }

  function getHeaders(authStore) {
    return {
      'apikey': window.APP_CONFIG.SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + (authStore.token || window.APP_CONFIG.SUPABASE_ANON_KEY),
    };
  }

  function loadDiaryPhotos() {
    fetchScanData(function (data) {
      var scans = data.scans;
      var profiles = data.profiles;

      if (!scans || scans.length === 0) {
        console.log('[Home] No scans yet.');
        return;
      }

      var profile = (profiles && profiles.length > 0) ? profiles[0] : null;
      var cycleStart = profile && profile.created_at
        ? new Date(profile.created_at)
        : new Date(scans[0].created_at);

      var bucketStart = new Date(cycleStart);
      var buckets = [[], [], []];

      console.log('[Home] Bucketing ' + scans.length + ' scans. Start date:', bucketStart.toISOString());

      scans.forEach(function (scan) {
        var scanDate = new Date(scan.created_at);
        var dayOffset = Math.floor((scanDate - bucketStart) / (1000 * 60 * 60 * 24)) + 1;

        console.log('[Home] Scan date:', scanDate.toISOString(), '| Day offset:', dayOffset);

        if (dayOffset >= 1 && dayOffset <= 7) buckets[0].push(scan);
        else if (dayOffset >= 8 && dayOffset <= 14) buckets[1].push(scan);
        else if (dayOffset >= 15 && dayOffset <= 21) buckets[2].push(scan);
      });

      console.log('[Home] Bucket counts - Week 1:', buckets[0].length, '| Week 2:', buckets[1].length, '| Week 3:', buckets[2].length);

      var picks = [
        buckets[0].length > 0 ? buckets[0][0] : null,
        buckets[1].length > 0 ? buckets[1][buckets[1].length - 1] : null,
        buckets[2].length > 0 ? buckets[2][buckets[2].length - 1] : null,
      ];

      console.log('[Home] Picks selected:', picks.map(function(p, i) {
        return 'Week ' + (i+1) + ': ' + (p ? 'scan with file_id=' + p.telegram_file_id : 'null');
      }).join(' | '));

      // Fallback: if all buckets empty, show most recent 3 scans
      var allEmpty = !picks[0] && !picks[1] && !picks[2];
      if (allEmpty && scans.length > 0) {
        // Take up to 3 most recent scans
        var recent = scans.slice(-3);
        picks = [
          recent[0] || null,
          recent[1] || null,
          recent[2] || null,
        ];
        console.log('[Home] Using fallback: showing ' + recent.length + ' most recent scans');
      }

      picks.forEach(function (scan, i) {
        if (scan && scan.telegram_file_id) {
          setThumbPhoto(i, scan.telegram_file_id);
        } else {
          resetThumb(i);
        }
      });

      console.log('[Home] Diary photos loaded.');

      // Also load progress data (reuse the same scan data)
      loadProgressData(scans);

      // Also populate before/after slider photos
      loadBeforeAfterPhotos(scans);
    });
  }

  /**
   * Populates the progress-table with before/after/delta values.
   * "Before" = first scan ever. "After" = last scan ever.
   */
  function loadProgressData(scans) {
    if (!scans || scans.length < 2) {
      console.log('[Home] Need 2+ scans for progress comparison.');
      return;
    }

    var first = scans[0];
    var last = scans[scans.length - 1];

    ACNE_ORDER.forEach(function (key) {
      var beforeVal = (first[key] !== undefined && first[key] !== null) ? Number(first[key]) : null;
      var afterVal = (last[key] !== undefined && last[key] !== null) ? Number(last[key]) : null;

      if (beforeVal === null || afterVal === null) return;

      var delta = afterVal - beforeVal;
      var deltaStr;
      var deltaClass;
      if (Math.abs(delta) < 0.1) {
        deltaStr = '— ' + afterVal.toFixed(1) + '%';
        deltaClass = '';
      } else if (delta < 0) {
        // Negative = improvement (fewer acne %)
        deltaStr = '↓ ' + Math.abs(delta).toFixed(1) + '%';
        deltaClass = 'progress-row__delta--down';
      } else {
        deltaStr = '↑ ' + delta.toFixed(1) + '%';
        deltaClass = 'progress-row__delta--up';
      }

      updateProgressRow(key, {
        label: ACNE_LABELS[key] || key,
        before: beforeVal.toFixed(1) + '%',
        after: afterVal.toFixed(1) + '%',
        delta: deltaStr,
        deltaClass: deltaClass,
      });
    });

    // Update donut chart with clear_skin improvement
    var clearBefore = Number(first.clear_skin) || 0;
    var clearAfter = Number(last.clear_skin) || 0;
    updateDonutChart(clearBefore, clearAfter);
  }

  /**
   * Updates a single progress-row in the DOM by matching the label text.
   */
  function updateProgressRow(key, data) {
    var rows = document.querySelectorAll('.progress-row');
    rows.forEach(function (row) {
      var nameEl = row.querySelector('.progress-row__name');
      if (!nameEl) return;
      // Match by the acne label
      if (nameEl.textContent.trim() === data.label) {
        var beforeEl = row.querySelector('.progress-row__before');
        var afterEl = row.querySelector('.progress-row__after');
        var deltaEl = row.querySelector('.progress-row__delta');
        if (beforeEl) beforeEl.textContent = data.before;
        if (afterEl) afterEl.textContent = data.after;
        if (deltaEl) {
          deltaEl.textContent = data.delta;
          deltaEl.className = 'progress-row__delta ' + data.deltaClass;
        }
      }
    });
  }

  /**
   * Updates the donut chart percentage and label.
   */
  function updateDonutChart(clearBefore, clearAfter) {
    var pctEl = document.querySelector('.donut__pct');
    var labelEl = document.querySelector('.donut__label');
    var donutCircle = document.querySelector('.donut__svg circle:nth-child(2)');

    // Donut shows the latest clear_skin value (not delta)
    if (pctEl) {
      pctEl.textContent = Math.round(clearAfter) + '%';
    }
    if (labelEl) {
      labelEl.textContent = 'Clear Skin';
    }

    if (donutCircle) {
      // Scale clear_skin 0-100 to circumference
      var circumference = 2 * Math.PI * 52; // r=52
      var pct = Math.max(0, Math.min(100, clearAfter)) / 100;
      var offset = circumference * (1 - pct);
      donutCircle.setAttribute('stroke-dasharray', circumference);
      donutCircle.setAttribute('stroke-dashoffset', offset);
    }
  }

  /**
   * Populates the before/after image slider with real scan photos.
   * "Before" (left) = first scan. "After" (right) = last scan.
   */
  function loadBeforeAfterPhotos(scans) {
    if (!scans || scans.length === 0) return;

    var first = scans[0];
    var last = scans[scans.length - 1];

    var baRight = document.querySelector('.before-after__right .ba-thumb');
    var baLeft = document.querySelector('.before-after__left .ba-thumb');

    function setBaPhoto(el, fileId) {
      if (!el || !fileId) return;
      el.innerHTML = '<img src="/api/telegram/photo?file_id=' + encodeURIComponent(fileId) +
        '" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:1vw;" ' +
        'onerror="this.style.display=\'none\'" />';
    }

    if (first && first.telegram_file_id) {
      setBaPhoto(baLeft, first.telegram_file_id);
    }
    if (last && last.telegram_file_id) {
      setBaPhoto(baRight, last.telegram_file_id);
    }
  }

  // ── Before / After Slider ──
  function initSlider() {
    var container = document.querySelector('.before-after__container');
    if (!container) return;
    var slider = container.querySelector('.ba-slider');
    if (!slider) return;

    function updateSlider(pos) {
      container.style.setProperty('--ba-position', pos + '%');
    }

    slider.addEventListener('input', function (e) {
      updateSlider(e.target.value);
    });

    container.addEventListener('click', function (e) {
      var rect = container.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var pct = Math.round((x / rect.width) * 100);
      pct = Math.max(1, Math.min(100, pct));
      slider.value = pct;
      updateSlider(pct);
    });

    updateSlider(slider.value);
  }

  // ── Init ──
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

  function initAll() {
    initSlider();
    setTimeout(function () {
      loadDiaryPhotos();
    }, 800);
  }
})();
