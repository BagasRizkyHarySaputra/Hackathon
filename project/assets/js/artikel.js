/**
 * ============================================================
 * FILE: assets/js/artikel.js
 * ============================================================
 * FEATURE: Artikel Listing Page — Dynamic Rendering + Search
 *
 * PURPOSE:
 *   Controls the article listing page. On load, checks for an
 *   `?id=` param. If present, switches to detail view (handled
 *   by artikel-loader.js). Otherwise fetches articles.json,
 *   renders the card grid, and wires up search + tag filtering.
 *
 * DEPENDENCIES:
 *   - /assets/data/articles.json (20+ articles with Title, Description, etc.)
 *   - /assets/css/components/artikel.css (listing grid styles)
 * ============================================================
 */

(function () {
  'use strict';

  /* ─── State ─── */
  let allArticles = [];
  let activeTag = 'all';
  let searchQuery = '';

  /* ─── DOM refs ─── */
  const listingView   = document.getElementById('listing-view');
  const detailView    = document.getElementById('detail-view');
  const gridContainer = document.getElementById('artikel-grid');
  const emptyState    = document.getElementById('artikel-empty');
  const searchInput   = document.getElementById('artikel-search-input');
  const tagContainer  = document.getElementById('artikel-tags');
  const backBtn       = document.getElementById('artikel-back-btn');
  const mainEl        = document.getElementById('article-main');

  /* ─── Init ─── */
  document.addEventListener('DOMContentLoaded', init);

  function init() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');

    if (id) {
      showDetailView(id);
      wireBackButton();
      return;
    }

    fetchArticles().then(function () {
      renderGrid(allArticles);
      wireSearch();
      wireTags();
      wireBackButton();
    });
  }

  /* ─── Fetch Data ─── */
  function fetchArticles() {
    return fetch('/assets/data/articles.json')
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        // Normalize: ensure every article has id, tags, Title, Description, Link-Image
        allArticles = data.map(function (a, i) {
          if (!a.id) a.id = 'artikel-' + i;
          if (!a.tags) a.tags = [];
          return a;
        });
      })
      .catch(function (err) {
        console.error('Failed to load articles:', err);
        gridContainer.innerHTML =
          '<div class="artikel-error">Failed to load articles. Please try again later.</div>';
      });
  }

  // Grid positions: [column, row, colspan, rowspan] for first 6 cards matching design layout
  var GRID_PLACEMENTS = [
    [1, 1, 1, 2],       // Card 1: col 1, row 1, span 1 col, 2 rows → vertical
    [2, 1, 1, 1],       // Card 2: col 2, row 1 → horizontal
    [3, 1, 1, 1],       // Card 3: col 3, row 1 → small
    [3, 2, 1, 1],       // Card 4: col 3, row 2 → small
    [2, 2, 1, 1],       // Card 5: col 2, row 2 → small
    [2, 3, 2, 1],       // Card 6: col 2-3, row 3 → horizontal wide
  ];
  var CARD_LAYOUTS = ['vertical', 'horizontal', 'small', 'small', 'small', 'horizontal'];

  function getCardLayout(index) {
    return CARD_LAYOUTS[index] || 'small';
  }

  /* ─── Render Grid ─── */
  function renderGrid(articles) {
    if (!gridContainer) return;

    if (!articles || articles.length === 0) {
      gridContainer.style.display = 'none';
      if (emptyState) emptyState.style.display = 'flex';
      return;
    }

    gridContainer.style.display = '';
    if (emptyState) emptyState.style.display = 'none';

    var html = '';
    for (var i = 0; i < articles.length; i++) {
      var a = articles[i];
      var tag = (a.tags && a.tags.length > 0) ? a.tags[0] : 'all';
      var layout = getCardLayout(i);
      var titleHtml = escHtml(a.Title || a.title || '');
      if (searchQuery) {
        titleHtml = highlightMatch(titleHtml, searchQuery);
      }

      html += buildCardHtml(a, layout, tag, titleHtml);
    }

    gridContainer.innerHTML = html;

    // Wire up "Read article" buttons
    var btns = gridContainer.querySelectorAll('.artikel-card__btn');
    for (var j = 0; j < btns.length; j++) {
      btns[j].addEventListener('click', function (e) {
        var id = this.getAttribute('data-id');
        navigateToDetail(id);
      });
    }
  }

  function buildCardHtml(article, layout, tag, titleHtml) {
    var idx = allArticles.indexOf(article);
    var baseClass = 'artikel-card artikel-card--' + layout;
    var imgSrc = escAttr(article['Link-Image'] || article.image || '/assets/images/SkincareBottleMockup2.png');
    var descText = article.Description || article['Simple-desc'] || article.content || '';
    var excerpt = descText ? escHtml(descText.substring(0, 80)) + '...' : '';
    var tagEsc = escHtml(tag);
    var tagAttr = escAttr(tag);
    var gridStyle = '';
    if (idx >= 0 && idx < GRID_PLACEMENTS.length) {
      var pos = GRID_PLACEMENTS[idx];
      gridStyle = ' style="grid-column: ' + pos[0] + (pos[2] > 1 ? ' / ' + (pos[0] + pos[2]) : '') + '; grid-row: ' + pos[1] + (pos[3] > 1 ? ' / ' + (pos[1] + pos[3]) : '') + ';"';
    }

    if (layout === 'horizontal') {
      return '' +
        '<article class="' + baseClass + '" data-id="' + escAttr(article.id) + '"' + gridStyle + '>' +
          '<div class="artikel-card__img-wrap">' +
            '<img src="' + imgSrc + '" alt="" class="artikel-card__img" loading="lazy" />' +
          '</div>' +
          '<div class="artikel-card__body">' +
            '<span class="artikel-card__tag article-tag article-tag--' + tagAttr + '">' + tagEsc + '</span>' +
            '<h3 class="artikel-card__title">' + titleHtml + '</h3>' +
            '<p class="artikel-card__excerpt">' + excerpt + '</p>' +
            '<button class="artikel-card__btn" data-id="' + escAttr(article.id) + '">Read article</button>' +
          '</div>' +
        '</article>';
    }

    if (layout === 'vertical') {
      return '' +
        '<article class="' + baseClass + '" data-id="' + escAttr(article.id) + '"' + gridStyle + '>' +
          '<div class="artikel-card__img-wrap">' +
            '<img src="' + imgSrc + '" alt="" class="artikel-card__img" loading="lazy" />' +
          '</div>' +
          '<div class="artikel-card__body">' +
            '<span class="artikel-card__tag article-tag article-tag--' + tagAttr + '">' + tagEsc + '</span>' +
            '<h3 class="artikel-card__title">' + titleHtml + '</h3>' +
            '<p class="artikel-card__excerpt">' + excerpt + '</p>' +
            '<button class="artikel-card__btn" data-id="' + escAttr(article.id) + '">Read article</button>' +
          '</div>' +
        '</article>';
    }

    return '' +
      '<article class="' + baseClass + '" data-id="' + escAttr(article.id) + '"' + gridStyle + '>' +
        '<div class="artikel-card__img-wrap">' +
          '<img src="' + imgSrc + '" alt="" class="artikel-card__img" loading="lazy" />' +
        '</div>' +
        '<div class="artikel-card__body">' +
          '<span class="artikel-card__tag article-tag article-tag--' + tagAttr + '">' + tagEsc + '</span>' +
          '<h3 class="artikel-card__title">' + titleHtml + '</h3>' +
          '<p class="artikel-card__excerpt">' + excerpt + '</p>' +
          '<button class="artikel-card__btn" data-id="' + escAttr(article.id) + '">Read article</button>' +
        '</div>' +
      '</article>';
  }

  /* ─── View Switching ─── */
  function showDetailView(id) {
    if (listingView) listingView.style.display = 'none';
    if (detailView) detailView.style.display = '';

    // Title change
    document.title = 'SkinGlow — Artikel';

    // Load the article detail via article-loader.js
    if (typeof loadArticle === 'function') {
      loadArticle(id);
    }
    // Fallback: directly fetch and render
    else {
      fetch('/assets/data/articles.json')
        .then(function (r) { return r.json(); })
        .then(function (articles) {
          var article = null;
          for (var i = 0; i < articles.length; i++) {
            if (articles[i].id === id) {
              article = articles[i];
              break;
            }
          }
          renderArticleDetail(article);
        })
        .catch(function (err) {
          console.error('Failed to load article detail:', err);
        });
    }
  }

  function navigateToDetail(id) {
    // Use transition like the router
    document.body.style.transition = 'opacity 0.15s';
    document.body.style.opacity = '0';
    var self = this;
    setTimeout(function () {
      window.location.href = '?id=' + encodeURIComponent(id);
    }, 150);
  }

  function showListing() {
    if (listingView) listingView.style.display = '';
    if (detailView) detailView.style.display = 'none';
    document.title = 'SkinGlow — Artikel';
  }

  /* ─── Back button (from detail → listing) ─── */
  function wireBackButton() {
    if (!backBtn) return;
    backBtn.addEventListener('click', function (e) {
      document.body.style.transition = 'opacity 0.15s ease';
      document.body.style.opacity = '0';
      setTimeout(function () {
        window.location.href = window.location.pathname;
      }, 150);
    });
  }

  /* ─── Search ─── */
  function wireSearch() {
    if (!searchInput) return;

    searchInput.addEventListener('input', function () {
      searchQuery = this.value.trim().toLowerCase();
      applyFilters();
    });
  }

  /* ─── Tag Filtering ─── */
  function wireTags() {
    if (!tagContainer) return;

    tagContainer.addEventListener('click', function (e) {
      var tagEl = e.target.closest('[data-tag]');
      if (!tagEl) return;

      var tag = tagEl.getAttribute('data-tag');

      // Update active state
      var allTags = tagContainer.querySelectorAll('[data-tag]');
      for (var i = 0; i < allTags.length; i++) {
        allTags[i].classList.remove('article-tag--active');
      }
      tagEl.classList.add('article-tag--active');

      activeTag = tag;
      applyFilters();
    });

    // Activate "All" by default
    var allTag = tagContainer.querySelector('[data-tag="all"]');
    if (allTag) allTag.classList.add('article-tag--active');
  }

  /* ─── Apply both search + tag filters ─── */
  function applyFilters() {
    var filtered = [];

    for (var i = 0; i < allArticles.length; i++) {
      var a = allArticles[i];
      var matchesTag = activeTag === 'all' || (a.tags && a.tags.indexOf(activeTag) !== -1);

      var matchesSearch = true;
      if (searchQuery) {
        var haystack = ((a.Title || a.title || '') + ' ' + (a.Description || a.content || '') + ' ' + (a.tags ? a.tags.join(' ') : '')).toLowerCase();
        matchesSearch = haystack.indexOf(searchQuery) !== -1;
      }

      if (matchesTag && matchesSearch) {
        filtered.push(a);
      }
    }

    renderGrid(filtered);
  }

  /* ─── Render article detail (fallback if artikel-loader.js not present) ─── */
  function renderArticleDetail(article) {
    if (!article) {
      var titleEl = document.getElementById('article-title');
      if (titleEl) titleEl.textContent = 'Article Not Found';
      var descEl = document.getElementById('article-description');
      if (descEl) descEl.innerHTML = '<p class="article-card__text">The requested article could not be found.</p>';
      return;
    }

    var titleEl = document.getElementById('article-title');
    var descEl = document.getElementById('article-description');
    var sectionsEl = document.getElementById('article-sections');
    var tipsEl = document.getElementById('article-tips-list');
    var imgEl = document.getElementById('article-image');
    var sourceEl = document.getElementById('article-source');
    var sourceTextEl = document.getElementById('article-source-text');

    var artTitle = article.Title || article.title || '';
    if (titleEl) titleEl.textContent = artTitle;
    if (imgEl) {
      imgEl.src = article['Link-Image'] || article.image || '/assets/images/SkincareBottleMockup2.png';
      imgEl.alt = artTitle;
    }

    // Split description into multiple short paragraphs
    if (descEl) {
      var descText = article.Description || article.content || '';
      var paragraphs = splitIntoParagraphs(descText);
      var descHtml = '';
      for (var k = 0; k < paragraphs.length; k++) {
        descHtml += '<p class="article-card__text">' + escHtml(paragraphs[k]) + '</p>';
      }
      descEl.innerHTML = descHtml || '<p class="article-card__text">' + escHtml(descText) + '</p>';
    }

    if (sectionsEl && article.sections) {
      var secHtml = '';
      for (var i = 0; i < article.sections.length; i++) {
        var s = article.sections[i];
        secHtml +=
          '<div class="article-card__section">' +
            '<h3 class="article-card__section-title">' + escHtml(s.heading) + '</h3>' +
            '<p class="article-card__text">' + escHtml(s.text) + '</p>' +
          '</div>';
      }
      sectionsEl.innerHTML = secHtml;
    }

    if (tipsEl && article.tips) {
      var tipHtml =
        '<div class="article-card__section">' +
          '<h3 class="article-card__section-title">Key Tips</h3>' +
          '<ul class="article-card__list">';
      for (var j = 0; j < article.tips.length; j++) {
        tipHtml += '<li>' + escHtml(article.tips[j]) + '</li>';
      }
      tipHtml += '</ul></div>';
      tipsEl.innerHTML = tipHtml;
    }

    // Show source if available
    if (sourceEl && sourceTextEl && article.Source) {
      sourceTextEl.textContent = article.Source;
      sourceEl.style.display = 'flex';
    } else if (sourceEl) {
      sourceEl.style.display = 'none';
    }
  }

  /**
   * Split long description text into short paragraphs (2-3 sentences each).
   * Falls back to single paragraph for short text.
   */
  function splitIntoParagraphs(text) {
    if (!text) return [];
    // Split into sentences by . ! ? followed by space or end
    var sentences = text.match(/([^.!?]+[.!?]+(?:\s|$))/g);
    if (!sentences || sentences.length <= 2) return text ? [text] : [];

    // Group into paragraphs: 2-3 sentences for long text, 1-2 for medium
    var groupSize = sentences.length > 6 ? 3 : 2;
    var paragraphs = [];
    for (var i = 0; i < sentences.length; i += groupSize) {
      var group = sentences.slice(i, i + groupSize);
      var cleaned = [];
      for (var j = 0; j < group.length; j++) {
        cleaned.push(group[j].trim());
      }
      paragraphs.push(cleaned.join(' '));
    }
    return paragraphs;
  }

  /* ─── Helpers ─── */
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

  function highlightMatch(text, query) {
    if (!query || !text) return text;
    var re = new RegExp('(' + query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    return text.replace(re, '<mark class="artikel-highlight">$1</mark>');
  }

  /**
   * Expose loadArticle for article-loader.js to call
   * This allows the detail view to work both from JS and from direct ?id= navigation
   */
  window.loadArticle = function (id) {
    fetch('/assets/data/articles.json')
      .then(function (r) { return r.json(); })
      .then(function (articles) {
        var article = null;
        for (var i = 0; i < articles.length; i++) {
          // Normalize id for lookup
          var aid = articles[i].id || 'artikel-' + i;
          if (aid === id) {
            article = articles[i];
            break;
          }
        }
        renderArticleDetail(article);
      })
      .catch(function (err) {
        console.error('loadArticle error:', err);
      });
  };

})();
