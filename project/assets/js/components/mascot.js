/**
 * ============================================================
 * FILE: assets/js/components/mascot.js
 * ============================================================
 * FEATURE: Floating Draggable Mascot (LICIN water-drop)
 *
 * PURPOSE:
 *   Injects the LICIN water-drop mascot on every page inside the
 *   main site and keeps it on top of every layer. The mascot can
 *   be dragged freely around the viewport; its position is saved
 *   in localStorage and restored as the user moves between pages.
 *
 *   Animations: gentle vertical float, slight sway, and natural
 *   eye blink (driven entirely by CSS keyframes in mascot.css).
 *
 * DEPENDENCIES:
 *   - assets/css/components/mascot.css (linked in <head> of every page)
 *   - Vanilla JS DOM APIs (no framework dependency)
 *
 * USAGE:
 *   Simply include this script near the end of every page body.
 *   The mascot bootstraps itself; no markup required.
 *
 *   <script defer src="/assets/js/components/mascot.js"></script>
 *
 * STORAGE:
 *   localStorage key "licin:mascot:pos" stores {x, y} in viewport px.
 *
 * PHASE: Frontend — purely cosmetic, no backend dependency
 * ============================================================
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'licin:mascot:pos';
  var DRAG_THRESHOLD_PX = 4;        // smaller movement -> treat as tap, not drag
  var DEFAULT_SIZE = 84;            // matches --mascot-size in mascot.css
  var EDGE_MARGIN = 12;             // prevent mascot from going fully off-screen
  var chatBubble = null;            // created by showChatBubble()

  /**
   * Load the water-drop mascot from the external SVG file at
   * /assets/icons/water-drop-mascot.svg onto an <img> element via a
   * blob: URL.
   *
   * Why an <img> instead of inline SVG:
   *   The mascot SVG contains <g style="mix-blend-mode:color-burn/screen">
   *   groups. Injected inline, these blend against the page backdrop (which
   *   varies per page), causing the pastel body to render black/dark on
   *   light pages. Loaded via <img>, the SVG is rendered in its own
   *   isolated, transparent context — identical to opening the file in a
   *   browser tab — so the gradients always resolve to their pastel colors.
   *
   * Origin: assets/icons/water-drop-mascot.svg
   * Note: inner-SVG CSS animation hooks (.mascot-fab__body, .mascot-fab__eye)
   *       are not reachable through <img>; float/sway are applied to the
   *       <img> itself from mascot.css.
   */
  function loadMascotImage(imgEl) {
    fetch('/assets/icons/water-drop-mascot.svg')
      .then(function (r) {
        if (!r.ok) throw new Error('Failed to load mascot SVG');
        return r.blob();
      })
      .then(function (blob) {
        var url = URL.createObjectURL(blob);
        imgEl.onload = function () {
          // Release the blob URL once the image is decoded to free memory.
          URL.revokeObjectURL(url);
          imgEl.onload = null;
        };
        imgEl.onerror = function () {
          URL.revokeObjectURL(url);
          imgEl.onerror = null;
        };
        imgEl.src = url;
      })
      .catch(function () {
        // Silently ignore — the mascot container remains visible and functional
        // without the SVG graphic. The user simply won't see the water-drop icon.
      });
  }

  /**
   * Restore previously-saved position (or default to bottom-right).
   * @returns {{x:number,y:number}|null}
   */
  function loadSavedPosition() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || typeof data.x !== 'number' || typeof data.y !== 'number') return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  /**
   * Persist position so other pages / refreshes restore it.
   */
  function savePosition(x, y) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ x: x, y: y }));
    } catch (e) {
      // Storage may be unavailable (private mode / quota) — silently ignore.
    }
  }

  /**
   * Clamp the mascot so it stays FULLY inside the viewport with EDGE_MARGIN
   * breathing room on every side. The mascot can never be dragged off the
   * screen or partially clipped into a corner that would hide it.
   *
   * If the viewport shrinks smaller than mascot size + 2*EDGE_MARGIN, we fall
   * back to keeping at least EDGE_MARGIN visible from the closest edge so the
   * mascot never disappears entirely (the user can always grab it back).
   */
  function clampPosition(x, y, w, h) {
    var vw = window.innerWidth;
    var vh = window.innerHeight;

    // Default bounds: mascot fully visible with EDGE_MARGIN on each side.
    var minX = EDGE_MARGIN;
    var minY = EDGE_MARGIN;
    var maxX = vw - w - EDGE_MARGIN;
    var maxY = vh - h - EDGE_MARGIN;

    // Viewport too small to fit mascot + margins on both sides: pin the mascot
    // to the closest edge with EDGE_MARGIN visible, instead of letting it
    // escape off-screen. max() guarantees a sane bound even when negative.
    if (maxX < minX) maxX = Math.max(0, vw - w);
    if (maxY < minY) maxY = Math.max(0, vh - h);

    if (x < minX) x = minX;
    if (x > maxX) x = maxX;
    if (y < minY) y = minY;
    if (y > maxY) y = maxY;
    return { x: x, y: y };
  }

  /**
   * Visual bump: apply the pop animation class for a short moment.
   */
  function triggerPop(svgEl) {
    svgEl.classList.remove('mascot-fab__pop');
    // Force reflow so the animation restarts on every tap.
    void svgEl.offsetWidth;
    svgEl.classList.add('mascot-fab__pop');
    setTimeout(function () { svgEl.classList.remove('mascot-fab__pop'); }, 600);
  }

  /**
   * Create or show the chat bubble above the mascot.
   */
  function showChatBubble(container) {
    if (!chatBubble) {
      chatBubble = document.createElement('span');
      chatBubble.className = 'mascot-fab__chat-bubble';
      chatBubble.textContent = 'Mau ke ChatBot??';
      container.appendChild(chatBubble);
    }
    requestAnimationFrame(function () {
      chatBubble.classList.add('mascot-fab__chat-bubble--visible');
    });
  }

  /**
   * Hide (but keep in DOM) the chat bubble.
   */
  function hideChatBubble() {
    if (chatBubble) {
      chatBubble.classList.remove('mascot-fab__chat-bubble--visible');
    }
  }

  /**
   * Build and append the mascot to <body>.
   */
  function init() {
    // Skip if already injected (e.g., double script tag).
    if (document.querySelector('.mascot-fab')) return;

    // Skip on pages where mascot shouldn't appear.
    var skipPaths = ['/scan', '/login', '/loading', '/'];
    var curPath = window.location.pathname.replace(/\/+$/, '') || '/';
    for (var sp = 0; sp < skipPaths.length; sp++) {
      if (curPath === skipPaths[sp]) return;
    }

    var container = document.createElement('div');
    container.className = 'mascot-fab';
    container.setAttribute('role', 'img');
    container.setAttribute('aria-label', 'LICIN mascot — drag to move');
    container.setAttribute('tabindex', '0');

    // Hint tooltip — shown briefly to nudge first-time users.
    var hint = document.createElement('span');
    hint.className = 'mascot-fab__hint';
    hint.textContent = 'Drag me around!';
    container.appendChild(hint);

    // Use an <img> element with a blob: URL to render the SVG. Loading the
    // SVG via <img> (rather than injecting it inline) gives it its own
    // isolated rendering context — the file's <g style="mix-blend-mode:
    // color-burn/screen"> groups blend against a transparent backdrop,
    // not the page, so the pastel gradients always resolve correctly.
    var imgEl = document.createElement('img');
    imgEl.className = 'mascot-fab__svg';
    imgEl.setAttribute('alt', '');
    imgEl.setAttribute('aria-hidden', 'true');
    imgEl.setAttribute('tabindex', '-1');
    imgEl.setAttribute('draggable', 'false');
    container.appendChild(imgEl);
    document.body.appendChild(container);

    // Load SVG from external file (async, blob URL)
    loadMascotImage(imgEl);

    // ── Position: restore saved or default to bottom-right ──
    var rect = container.getBoundingClientRect();
    var size = rect.width || DEFAULT_SIZE;
    var heightPx = rect.height || (size * 1.0967);
    var saved = loadSavedPosition();
    var posX, posY;

    if (saved) {
      var clamped = clampPosition(saved.x, saved.y, size, heightPx);
      posX = clamped.x;
      posY = clamped.y;
    } else {
      // Default: bottom-right. On mobile, sit higher to clear bottom nav.
      var rightOffset = window.innerWidth <= 380 ? 12
                       : window.innerWidth <= 480 ? 16
                       : 24;
      var bottomOffset = window.innerWidth <= 480 ? 88 : 24;
      posX = window.innerWidth - size - rightOffset;
      posY = window.innerHeight - heightPx - bottomOffset;
    }
    applyPosition(container, posX, posY);

    // Show hint briefly on first contact, then fade.
    requestAnimationFrame(function () {
      hint.classList.add('mascot-fab__hint--visible');
      setTimeout(function () { hint.classList.remove('mascot-fab__hint--visible'); }, 4200);
    });

    // ── Pointer-based drag state ──
    var pointerId = null;
    var startX = 0, startY = 0;
    var originX = 0, originY = 0;
    var dragging = false;
    var moved = false;

    function onPointerDown(ev) {
      if (pointerId !== null) return;            // one pointer at a time
      pointerId = ev.pointerId;
      startX = ev.clientX;
      startY = ev.clientY;
      originX = posX;
      originY = posY;
      dragging = false;
      moved = false;
      try { container.setPointerCapture(pointerId); } catch (e) {}
      ev.preventDefault();
    }

    function onPointerMove(ev) {
      if (ev.pointerId !== pointerId) return;
      var dx = ev.clientX - startX;
      var dy = ev.clientY - startY;
      if (!moved && Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD_PX) {
        moved = true;
        dragging = true;
        container.setAttribute('data-dragging', 'true');
        hint.classList.remove('mascot-fab__hint--visible');
        hideChatBubble();
      }
      if (!dragging) return;
      var next = clampPosition(originX + dx, originY + dy, size, heightPx);
      posX = next.x;
      posY = next.y;
      applyPosition(container, posX, posY);
      ev.preventDefault();
    }

    function endDrag(ev) {
      if (ev.pointerId !== pointerId) return;
      try { container.releasePointerCapture(pointerId); } catch (e) {}
      pointerId = null;
      var wasDragging = dragging;
      dragging = false;
      container.removeAttribute('data-dragging');

      if (wasDragging) {
        savePosition(posX, posY);
      } else {
        // Tap: if bubble already visible, redirect to chatbot
        if (chatBubble && chatBubble.classList.contains('mascot-fab__chat-bubble--visible')) {
          window.location.href = '/chatbot';
          return;
        }
        // First tap: show bubble + pop
        showChatBubble(container);
        triggerPop(imgEl);
      }
    }

    function applyPosition(el, x, y) {
      el.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      // We still need 'right/bottom: auto' set once so the translate
      // is the authoritative position source rather than those props.
      el.style.right = 'auto';
      el.style.bottom = 'auto';
    }

    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerup', endDrag);
    container.addEventListener('pointercancel', endDrag);

    // Keyboard accessibility: arrow keys nudge the mascot.
    container.addEventListener('keydown', function (ev) {
      var step = ev.shiftKey ? 32 : 8;
      var dx = 0, dy = 0;
      switch (ev.key) {
        case 'ArrowLeft':  dx = -step; break;
        case 'ArrowRight': dx =  step; break;
        case 'ArrowUp':    dy = -step; break;
        case 'ArrowDown':  dy =  step; break;
        default: return;
      }
      ev.preventDefault();
      var next = clampPosition(posX + dx, posY + dy, size, heightPx);
      posX = next.x;
      posY = next.y;
      applyPosition(container, posX, posY);
      savePosition(posX, posY);
    });

    // Re-clamp on viewport resize so the mascot never gets lost off-screen.
    var resizeTimer = null;
    window.addEventListener('resize', function () {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        rect = container.getBoundingClientRect();
        size = rect.width || DEFAULT_SIZE;
        heightPx = rect.height || (size * 1.0967);
        var next = clampPosition(posX, posY, size, heightPx);
        posX = next.x;
        posY = next.y;
        applyPosition(container, posX, posY);
      }, 120);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();