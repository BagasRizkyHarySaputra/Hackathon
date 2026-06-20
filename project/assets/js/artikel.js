/**
 * ============================================================
 * FILE: assets/js/artikel.js
 * ============================================================
 * FEATURE: Artikel Listing Page — Infinite Scroll + Varied Layouts
 *
 * PURPOSE:
 *   Fetches all article data from Supabase, renders first 10,
 *   then loads 5 more on scroll via IntersectionObserver.
 *   Falls back to local JSON if Supabase is unavailable.
 *
 * DATA SOURCE: Supabase articles table (REST API)
 * ============================================================
 */

(function () {
  'use strict';

  /* ─── Supabase Config ─── */
  var SUPABASE_URL = 'https://gvkzgicbykyjkusxranv.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2a3pnaWNieWt5amt1c3hyYW52Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4OTg0OTAsImV4cCI6MjA5NzQ3NDQ5MH0.8DEahyrZ-IxZmuM7wVuO6-LP3K4IfX3v3eNsXnh_Hzw';

  function supabaseHeaders() {
    return {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
    };
  }

  /* ─── Constants ─── */
  var INITIAL_LOAD = 10;
  var BATCH_SIZE = 5;

  var LAYOUT_CYCLE = [
    'vertical', 'horizontal', 'horizontal-reverse',
    'horizontal-reverse', 'horizontal', 'vertical',
    'horizontal', 'vertical', 'horizontal-reverse', 'vertical'
  ];

  /* ─── State ─── */
  var allArticles = [];
  var displayedCount = 0;
  var isLoading = false;
  var hasMore = true;
  var activeTag = 'all';
  var searchQuery = '';

  /* ─── DOM refs ─── */
  var listingView   = document.getElementById('listing-view');
  var detailView    = document.getElementById('detail-view');
  var gridContainer = document.getElementById('artikel-grid');
  var emptyState    = document.getElementById('artikel-empty');
  var searchInput   = document.getElementById('artikel-search-input');
  var tagContainer  = document.getElementById('artikel-tags');
  var backBtn       = document.getElementById('artikel-back-btn');

  /* ─── Data normalization: Supabase snake_case → unified format ─── */
  function normalizeArticle(row) {
    return {
      id: row.slug || row.id,
      slug: row.slug || row.id,
      title: row.title || '',
      content: row.content || '',
      summary: row.simple_desc || row.summary || '',
      image_url: row.image_url || '',
      tags: row.tags || [],
      source: row.source || '',
      sections: row.sections || [],
      tips: row.tips || [],
      category: row.category || 'general'
    };
  }

  /* ─── Layout helpers ─── */
  function getCardLayout(index) {
    return LAYOUT_CYCLE[index % LAYOUT_CYCLE.length];
  }

  /* ─── Init ─── */
  document.addEventListener('DOMContentLoaded', init);

  function init() {
    var params = new URLSearchParams(window.location.search);
    var id = params.get('id');

    if (id) {
      showDetailView(id);
      wireBackButton();
      return;
    }

    fetchAllArticles().then(function () {
      renderGrid(allArticles);
      setupIntersectionObserver();
      wireSearch();
      wireTags();
      wireBackButton();
    });
  }

  /* ─── Fetch all articles from Supabase ─── */
  function fetchAllArticles() {
    return fetch(SUPABASE_URL + '/rest/v1/articles?select=*&order=published_at.desc', {
      headers: supabaseHeaders()
    })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (rows) {
        allArticles = [];
        for (var i = 0; i < rows.length; i++) {
          var article = normalizeArticle(rows[i]);
          allArticles.push(article);
        }
      })
      .catch(function (err) {
        console.warn('Supabase fetch failed, trying local fallback:', err.message);
        return fetchLocalFallback();
      });
  }

  function fetchLocalFallback() {
    var BATCH_URLS = [
      '/assets/data/artikel/batch-01.json',
      '/assets/data/artikel/batch-02.json',
      '/assets/data/artikel/batch-03.json',
      '/assets/data/artikel/batch-04.json'
    ];

    var fetches = [];
    for (var b = 0; b < BATCH_URLS.length; b++) {
      fetches.push(fetch(BATCH_URLS[b]).then(function (r) { return r.json(); }));
    }

    return Promise.all(fetches)
      .then(function (batches) {
        allArticles = [];
        for (var i = 0; i < batches.length; i++) {
          // Transform old JSON format → normalized format
          for (var k = 0; k < batches[i].length; k++) {
            var a = batches[i][k];
            a = normalizeArticle({
              slug: a.id,
              title: a.Title || a.title,
              content: a.Description || a.content,
              summary: a['Simple-desc'] || a.summary,
              image_url: a['Link-Image'] || a.image,
              tags: a.tags,
              source: a.Source || a.source,
              sections: a.sections,
              tips: a.tips
            });
            allArticles.push(a);
          }
        }
      })
      .catch(function () {
        return fetch('/assets/data/articles.json')
          .then(function (r) { return r.json(); })
          .then(function (data) {
            allArticles = [];
            for (var j = 0; j < data.length; j++) {
              var a = data[j];
              allArticles.push(normalizeArticle({
                slug: a.id,
                title: a.Title || a.title,
                content: a.Description || a.content,
                summary: a['Simple-desc'] || a.summary,
                image_url: a['Link-Image'] || a.image,
                tags: a.tags,
                source: a.Source || a.source,
                sections: a.sections,
                tips: a.tips
              }));
            }
          });
      });
  }

  /* ─── Filter helpers ─── */
  function getFilteredArticles() {
    var filtered = [];
    for (var i = 0; i < allArticles.length; i++) {
      var a = allArticles[i];
      var matchesTag = activeTag === 'all' || (a.tags && a.tags.indexOf(activeTag) !== -1);
      var matchesSearch = true;
      if (searchQuery) {
        var haystack = ((a.title || '') + ' ' + (a.content || '') + ' ' + (a.summary || '') + ' ' + (a.tags ? a.tags.join(' ') : '')).toLowerCase();
        matchesSearch = haystack.indexOf(searchQuery) !== -1;
      }
      if (matchesTag && matchesSearch) filtered.push(a);
    }
    return filtered;
  }

  /* ─── Render Grid (initial) ─── */
  function renderGrid(articles) {
    if (!gridContainer) return;

    if (!articles || articles.length === 0) {
      gridContainer.style.display = 'none';
      if (emptyState) emptyState.style.display = 'flex';
      return;
    }

    gridContainer.style.display = '';
    if (emptyState) emptyState.style.display = 'none';

    displayedCount = Math.min(INITIAL_LOAD, articles.length);
    hasMore = displayedCount < articles.length;

    removeExistingCards();
    appendCards(articles, 0, displayedCount, function () {
      wireCardButtons();
    });
  }

  function removeExistingCards() {
    var existing = gridContainer.querySelectorAll('.artikel-card');
    for (var i = 0; i < existing.length; i++) {
      existing[i].remove();
    }
  }

  /* ─── Append cards to grid (staggered fade-in) ─── */
  function appendCards(articles, startIdx, count, onComplete) {
    var end = Math.min(startIdx + count, articles.length);
    if (startIdx >= end) { if (onComplete) onComplete(); return; }

    var anchor = document.getElementById('artikel-sentinel');
    var inserted = 0, total = end - startIdx;

    function appendOne(i) {
      var a = articles[i];
      var tag = (a.tags && a.tags.length > 0) ? a.tags[0] : 'all';
      var layout = getCardLayout(i);
      var titleHtml = escHtml(a.title || '');
      if (searchQuery) titleHtml = highlightMatch(titleHtml, searchQuery);
      var html = buildCardHtml(a, layout, tag, titleHtml);

      var temp = document.createElement('div');
      temp.innerHTML = html;
      var card = temp.firstChild;
      card.classList.add('artikel-card--entering');

      if (anchor) {
        gridContainer.insertBefore(card, anchor);
      } else {
        gridContainer.appendChild(card);
      }

      inserted++;

      requestAnimationFrame(function () {
        card.classList.add('artikel-card--visible');
      });

      if (inserted < total) {
        setTimeout(function () { appendOne(startIdx + inserted); }, 80);
      } else {
        if (onComplete) onComplete();
      }
    }

    appendOne(startIdx);
  }

  function buildCardHtml(article, layout, tag, titleHtml) {
    var baseClass = 'artikel-card artikel-card--' + layout;
    var imgSrc = escAttr(article.image_url || '/assets/images/SkincareBottleMockup2.png');
    var excerptText = article.summary || article.content || '';
    var excerpt = excerptText ? escHtml(excerptText.substring(0, 80)) + '...' : '';
    var tagEsc = escHtml(tag);
    var tagAttr = escAttr(tag);

    var bodyHtml =
      '<div class="artikel-card__body">' +
        '<span class="artikel-card__tag article-tag article-tag--' + tagAttr + '">' + tagEsc + '</span>' +
        '<h3 class="artikel-card__title">' + titleHtml + '</h3>' +
        '<p class="artikel-card__excerpt">' + excerpt + '</p>' +
        '<button class="artikel-card__btn" data-id="' + escAttr(article.id) + '">Read article</button>' +
      '</div>';

    var imgHtml =
      '<div class="artikel-card__img-wrap">' +
        '<img src="' + imgSrc + '" alt="" class="artikel-card__img" loading="lazy" />' +
      '</div>';

    if (layout === 'horizontal') {
      return '<article class="' + baseClass + '" data-id="' + escAttr(article.id) + '">' +
        imgHtml + bodyHtml + '</article>';
    }
    if (layout === 'horizontal-reverse') {
      return '<article class="' + baseClass + '" data-id="' + escAttr(article.id) + '">' +
        bodyHtml + imgHtml + '</article>';
    }
    return '<article class="' + baseClass + '" data-id="' + escAttr(article.id) + '">' +
      imgHtml + bodyHtml + '</article>';
  }

  /* ─── Wire card buttons ─── */
  function wireCardButtons() {
    var btns = gridContainer.querySelectorAll('.artikel-card__btn:not([data-wired])');
    for (var j = 0; j < btns.length; j++) {
      btns[j].setAttribute('data-wired', 'true');
      btns[j].addEventListener('click', function () {
        navigateToDetail(this.getAttribute('data-id'));
      });
    }
  }

  /* ─── Infinite scroll ─── */
  function setupIntersectionObserver() {
    var sentinel = document.getElementById('artikel-sentinel');
    if (!sentinel) return;

    var scrollContainer = document.getElementById('article-main');
    var observerOptions = { rootMargin: '100px' };
    if (scrollContainer) observerOptions.root = scrollContainer;

    var observer = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting && hasMore && !isLoading) loadMoreCards();
      }
    }, observerOptions);

    observer.observe(sentinel);
  }

  function loadMoreCards() {
    if (isLoading || !hasMore) return;
    isLoading = true;

    var loadEl = document.getElementById('artikel-load-more');
    if (loadEl) loadEl.style.display = 'flex';

    var filtered = getFilteredArticles();
    var nextBatch = Math.min(BATCH_SIZE, filtered.length - displayedCount);

    appendCards(filtered, displayedCount, nextBatch, function () {
      displayedCount += nextBatch;
      hasMore = displayedCount < filtered.length;
      wireCardButtons();

      if (loadEl) {
        if (!hasMore) {
          var textEl = loadEl.querySelector('.artikel-load-more__text');
          if (textEl) textEl.textContent = "You've reached the end";
          loadEl.classList.add('artikel-load-more--done');
        } else {
          loadEl.style.display = 'none';
        }
      }
      isLoading = false;
    });
  }

  /* ─── View Switching ─── */
  function showDetailView(slug) {
    if (listingView) listingView.style.display = 'none';
    if (detailView) detailView.style.display = '';
    document.title = 'SkinGlow — Artikel';
    loadArticleFromSupabase(slug);
  }

  function navigateToDetail(id) {
    document.body.style.transition = 'opacity 0.15s';
    document.body.style.opacity = '0';
    setTimeout(function () {
      window.location.href = '?id=' + encodeURIComponent(id);
    }, 150);
  }

  function showListing() {
    if (listingView) listingView.style.display = '';
    if (detailView) detailView.style.display = 'none';
    document.title = 'SkinGlow — Artikel';
  }

  /* ─── Back button ─── */
  function wireBackButton() {
    if (!backBtn) return;
    backBtn.addEventListener('click', function () {
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
      var allTags = tagContainer.querySelectorAll('[data-tag]');
      for (var i = 0; i < allTags.length; i++) {
        allTags[i].classList.remove('article-tag--active');
      }
      tagEl.classList.add('article-tag--active');
      activeTag = tag;
      applyFilters();
    });

    var allTag = tagContainer.querySelector('[data-tag="all"]');
    if (allTag) allTag.classList.add('article-tag--active');
  }

  /* ─── Apply filters + reset pagination ─── */
  function applyFilters() {
    var filtered = getFilteredArticles();
    displayedCount = 0;
    hasMore = true;
    isLoading = false;

    var loadEl = document.getElementById('artikel-load-more');
    if (loadEl) {
      loadEl.style.display = 'none';
      loadEl.classList.remove('artikel-load-more--done');
      var textEl = loadEl.querySelector('.artikel-load-more__text');
      if (textEl) textEl.textContent = 'Loading more articles...';
    }

    renderGrid(filtered);
  }

  /* ─── Detail view: load article from Supabase by slug ─── */
  function loadArticleFromSupabase(slug) {
    var url = SUPABASE_URL + '/rest/v1/articles?select=*&slug=eq.' + encodeURIComponent(slug);
    fetch(url, { headers: supabaseHeaders() })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var article = data.length > 0 ? normalizeArticle(data[0]) : null;
        renderArticleDetail(article);
      })
      .catch(function (err) {
        console.error('Failed to load article from Supabase:', err);
        // Try local fallback
        fetch('/assets/data/articles.json')
          .then(function (r) { return r.json(); })
          .then(function (articles) {
            var found = null;
            for (var i = 0; i < articles.length; i++) {
              var aid = articles[i].id || 'artikel-' + i;
              if (aid === slug) {
                found = normalizeArticle({
                  slug: articles[i].id,
                  title: articles[i].Title || articles[i].title,
                  content: articles[i].Description || articles[i].content,
                  summary: articles[i]['Simple-desc'] || articles[i].summary,
                  image_url: articles[i]['Link-Image'] || articles[i].image,
                  tags: articles[i].tags,
                  source: articles[i].Source || articles[i].source,
                  sections: articles[i].sections || [],
                  tips: articles[i].tips || []
                });
                break;
              }
            }
            renderArticleDetail(found);
          });
      });
  }

  /* ─── Detail view rendering ─── */
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

    var artTitle = article.title || '';
    if (titleEl) titleEl.textContent = artTitle;
    if (imgEl) {
      imgEl.src = article.image_url || '/assets/images/SkincareBottleMockup2.png';
      imgEl.alt = artTitle;
    }

    if (descEl) {
      var descText = article.content || '';
      var paragraphs = splitIntoParagraphs(descText);
      var descHtml = '';
      for (var k = 0; k < paragraphs.length; k++) {
        descHtml += '<p class="article-card__text">' + escHtml(paragraphs[k]) + '</p>';
      }
      descEl.innerHTML = descHtml || '<p class="article-card__text">' + escHtml(descText) + '</p>';
    }

    if (sectionsEl && article.sections && article.sections.length > 0) {
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

    if (tipsEl && article.tips && article.tips.length > 0) {
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

    if (sourceEl && sourceTextEl && article.source) {
      sourceTextEl.textContent = article.source;
      sourceEl.style.display = 'flex';
    } else if (sourceEl) {
      sourceEl.style.display = 'none';
    }
  }

  function splitIntoParagraphs(text) {
    if (!text) return [];
    var sentences = text.match(/([^.!?]+[.!?]+(?:\s|$))/g);
    if (!sentences || sentences.length <= 2) return text ? [text] : [];
    var groupSize = sentences.length > 6 ? 3 : 2;
    var paragraphs = [];
    for (var i = 0; i < sentences.length; i += groupSize) {
      var group = sentences.slice(i, i + groupSize);
      var cleaned = [];
      for (var j = 0; j < group.length; j++) cleaned.push(group[j].trim());
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

  /* ─── Public: loadArticle for external use ─── */
  window.loadArticle = function (slug) {
    loadArticleFromSupabase(slug);
  };

})();
