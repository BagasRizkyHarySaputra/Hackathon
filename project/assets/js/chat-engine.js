/**
 * LICIN — Shared Chat Engine
 *
 * Handles send/receive, auto-reply, localStorage persistence,
 * seed loading from /db-sementara/, and DOM rendering.
 * Shared by both /pages/chatbot/ and /pages/community/.
 */
(function () {
  'use strict';

  const LS_PREFIX = 'licin_chat_';
  const AVATAR_SRC = '/assets/icons/water-drop-mascot.svg';
  const AUTO_REPLY_TEXT = 'Meehh…';
  const AUTO_REPLY_DELAY = 700;

  /* ─── HTML Escape ─── */
  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  /* ─── Message Row Template ─── */
  function msgHTML(msg) {
    const isReceived = msg.type === 'received';
    if (isReceived) {
      return (
        '<div class="chat-msg-row chat-msg-row--received">' +
        '<div class="chat-avatar">' +
        '<img src="' + AVATAR_SRC + '" alt="" class="chat-avatar__mascot" />' +
        '</div>' +
        '<div class="chat-bubble chat-bubble--received">' +
        '<p class="chat-bubble__text">' + esc(msg.text) + '</p>' +
        '</div>' +
        '</div>'
      );
    }
    return (
      '<div class="chat-msg-row chat-msg-row--sent">' +
      '<div class="chat-bubble chat-bubble--sent">' +
      '<p class="chat-bubble__text">' + esc(msg.text) + '</p>' +
      '</div>' +
      '<div class="chat-avatar">' +
      '<div class="chat-avatar__circle chat-avatar__circle--self"></div>' +
      '</div>' +
      '</div>'
    );
  }

  /* ─── Storage Helpers ─── */
  function load(chatId) {
    try {
      var raw = localStorage.getItem(LS_PREFIX + chatId);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function save(chatId, messages) {
    try {
      localStorage.setItem(LS_PREFIX + chatId, JSON.stringify(messages));
    } catch (e) { /* quota exceeded — silent */ }
  }

  /**
   * ChatEngine — context-bound instance.
   *
   *   new ChatEngine('.chat-messages', {
   *     chatId: 'community_general_general',
   *     seed:  [{type:'received',text:'...'}]        // optional
   *   });
   */
  function ChatEngine(containerEl, opts) {
    this.el = containerEl;
    if (!this.el) throw new Error('ChatEngine: container not found');

    this.chatId = opts.chatId || 'default';
    this.messages = [];
    this._rendered = 0;

    /* seed messages from server (first-time only — if localStorage is empty) */
    var stored = load(this.chatId);
    if (stored.length > 0) {
      this.messages = stored;
    } else if (opts.seed) {
      this.messages = opts.seed.map(function (m, i) {
        return { id: i + 1, type: m.type, text: m.text, timestamp: m.timestamp || new Date().toISOString() };
      });
      save(this.chatId, this.messages);
    }
  }

  ChatEngine.prototype.render = function () {
    var total = this.messages.length;

    /* Incremental: only append new messages instead of rebuilding all DOM */
    if (this._rendered < total) {
      var html = '';
      for (var i = this._rendered; i < total; i++) {
        html += msgHTML(this.messages[i]);
      }
      if (this._rendered === 0) {
        this.el.innerHTML = html;
      } else {
        this.el.insertAdjacentHTML('beforeend', html);
      }
      this._rendered = total;
    }

    /* animate new messages */
    var rows = this.el.querySelectorAll('.chat-msg-row:not(.chat-msg-row--animated)');
    for (var j = 0; j < rows.length; j++) {
      rows[j].classList.add('chat-msg-row--animated');
    }

    /* scroll to bottom */
    var scrollParent = this.el.closest('.chat-messages-scroll');
    if (scrollParent) {
      scrollParent.scrollTop = scrollParent.scrollHeight;
    } else {
      this.el.scrollTop = this.el.scrollHeight;
    }
  };

  ChatEngine.prototype.send = function (text) {
    if (!text || !text.trim()) return;
    text = text.trim();

    /* sent message */
    var sentMsg = { id: Date.now(), type: 'sent', text: text, timestamp: new Date().toISOString() };
    this.messages.push(sentMsg);
    save(this.chatId, this.messages);
    this.render();

    /* auto‑reply */
    var self = this;
    setTimeout(function () {
      var replyMsg = { id: Date.now() + 1, type: 'received', text: AUTO_REPLY_TEXT, timestamp: new Date().toISOString() };
      self.messages.push(replyMsg);
      save(self.chatId, self.messages);
      self.render();
    }, AUTO_REPLY_DELAY);
  };

  ChatEngine.prototype.switchChat = function (chatId, seed) {
    this.chatId = chatId;
    var stored = load(this.chatId);
    if (stored.length > 0) {
      this.messages = stored;
    } else if (seed) {
      this.messages = seed.map(function (m, i) {
        return { id: i + 1, type: m.type, text: m.text, timestamp: m.timestamp || new Date().toISOString() };
      });
      save(this.chatId, this.messages);
    } else {
      this.messages = [];
    }
    this._rendered = 0;
    this.render();
  };

  /* ─── Export ─── */
  window.ChatEngine = ChatEngine;
  window.ChatEngine__lsPrefix = LS_PREFIX;
})();
