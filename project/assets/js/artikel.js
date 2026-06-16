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
 *   - /assets/data/articles.json (dummy data with 10 articles)
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

    var existingCards = gridContainer.querySelectorAll('.artikel-card');
    if (existingCards.length > 0) {
      wireStaticButtons();
      return;
    }

    fetchArticles().then(function () {
      renderGrid(allArticles);
      wireSearch();
      wireTags();
      wireBackButton();
    });
  }

  function wireStaticButtons() {
    var btns = gridContainer.querySelectorAll('.artikel-card__btn');
    for (var j = 0; j < btns.length; j++) {
      btns[j].addEventListener('click', function (e) {
        var id = this.getAttribute('data-id');
        navigateToDetail(id);
      });
    }
  }

  /* ─── Fetch Data ─── */
  function fetchArticles() {
    return fetch('/assets/data/articles.json')
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        allArticles = data;
      })
      .catch(function (err) {
        console.error('Failed to load articles:', err);
        gridContainer.innerHTML =
          '<div class="artikel-error">Failed to load articles. Please try again later.</div>';
      });
  }

  var CARD_LAYOUTS = ['horizontal', 'square', 'square', 'square', 'vertical', 'square', 'square', 'horizontal', 'square', 'vertical'];

  function getCardLayout(index) {
    return CARD_LAYOUTS[index] || 'square';
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
      var titleHtml = escHtml(a.title);
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
    var baseClass = 'artikel-card artikel-card--' + layout;
    var imgSrc = escAttr(article.image || '/assets/images/SkincareBottleMockup2.png');
    var excerpt = article.content ? escHtml(article.content.substring(0, 80)) + '...' : '';
    var tagEsc = escHtml(tag);
    var tagAttr = escAttr(tag);

    if (layout === 'horizontal') {
      return '' +
        '<article class="' + baseClass + '" data-id="' + escAttr(article.id) + '">' +
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
        '<article class="' + baseClass + '" data-id="' + escAttr(article.id) + '">' +
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
      '<article class="' + baseClass + '" data-id="' + escAttr(article.id) + '">' +
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
        window.location.href = window.location.pathname.replace(/\/+$/, '') + '/';
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
        var haystack = (a.title + ' ' + a.content + ' ' + (a.tags ? a.tags.join(' ') : '')).toLowerCase();
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
      var summaryEl = document.getElementById('article-summary');
      if (titleEl) titleEl.textContent = 'Article Not Found';
      if (summaryEl) summaryEl.textContent = 'The requested article could not be found.';
      return;
    }

    var titleEl = document.getElementById('article-title');
    var summaryEl = document.getElementById('article-summary');
    var sectionsEl = document.getElementById('article-sections');
    var tipsEl = document.getElementById('article-tips-list');
    var imgEl = document.getElementById('article-image');

    if (titleEl) titleEl.textContent = article.title;
    if (summaryEl) summaryEl.textContent = article.content;
    if (imgEl) {
      imgEl.src = article.image || '/assets/images/SkincareBottleMockup2.png';
      imgEl.alt = article.title;
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
          if (articles[i].id === id) {
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
