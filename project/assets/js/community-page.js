/**
 * SkinGlow — Community Page Logic
 *
 * Features:
 *   - Channel switching (General / Skincare)
 *   - Topic switching (#Acne Fighter / #Review Skincare / #Skincare)
 *   - Realtime chat via Supabase (shared history across all users)
 *   - User identity (name + avatar) in message bubbles
 *   - Auth-gated — redirects to /login if not signed in
 *
 * Storage: Supabase table `community_messages` (RLS-protected)
 * Realtime: Supabase Realtime (postgres_changes INSERT subscription)
 */
(function () {
  'use strict';

  var LS_ACTIVE_KEY = 'skinglow_community_active';

  /* ─── State ─── */
  var currentUser = null;
  var activeChannel = 'general';
  var activeTopic = 'acne-fighter';
  var messages = [];
  var renderedCount = 0;
  var realtimeChannel = null;
  var pollIntervalId = null;
  var POLL_INTERVAL_MS = 5000;  /* 5 detik — polling fallback */
  var SEND_COOLDOWN_MS = 5000;  /* 5 detik antar kirim pesan */
  var lastSendTime = 0;
  var _realtimeRetries = 0;
  var MAX_REALTIME_RETRIES = 5;

  /* ─── DOM refs (populated in init) ─── */
  var chatMessages, inputText, btnSend;
  var topicPanel, topicBurger, topicCollapsedHeader, topicCollapsedBurger;
  var channelSection;

  /* ─── Emoji data ─── */
  var EMOJIS = [
    '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😊',
    '😇','🥰','😍','🤩','😘','😗','😚','😋','😛','😜',
    '🤪','😝','🤑','🤗','🤭','🤫','🤔','😐','😏','😒',
    '😬','😮','😲','😳','🥺','😢','😭','😤','😡','🤬',
    '👍','👎','👌','✌️','🤞','👏','🙌','🤝','🙏','💪',
    '❤️','🧡','💛','💚','💙','💜','🖤','💔','💕','💞',
    '✨','🔥','⭐','🌟','💫','🎉','🎊','🎈','💋','💅'
  ];
  var btnEmoji = null;
  var emojiPicker = null;

  /* ─── HTML Escape ─── */
  function esc(str) {
    var d = document.createElement('div');
    d.textContent = str == null ? '' : String(str);
    return d.innerHTML;
  }

  /* ─── Message Row HTML ─── */
  function msgHTML(msg) {
    var isSelf = currentUser && msg.user_id === currentUser.id;
    var text = esc(msg.text);

    if (isSelf) {
      return (
        '<div class="chat-msg-row chat-msg-row--sent">' +
        '<div class="chat-bubble chat-bubble--sent">' +
        '<p class="chat-bubble__text">' + text + '</p>' +
        '</div>' +
        '<div class="chat-avatar">' +
        '<div class="chat-avatar__circle chat-avatar__circle--self"></div>' +
        '</div>' +
        '</div>'
      );
    }

    /* Other user — show avatar + name */
    var name = msg.user_name || 'Anonymous';
    var initial = esc(name.charAt(0).toUpperCase());
    var avatar = msg.user_avatar_url;
    var avatarHTML = avatar
      ? '<img src="' + esc(avatar) + '" alt="" class="chat-avatar__mascot" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'" />' +
        '<div class="chat-avatar__circle" style="display:none">' + initial + '</div>'
      : '<div class="chat-avatar__circle">' + initial + '</div>';

    return (
      '<div class="chat-msg-row chat-msg-row--received">' +
      '<div class="chat-avatar">' + avatarHTML + '</div>' +
      '<div class="chat-bubble chat-bubble--received">' +
      '<p class="chat-bubble__name">' + esc(name) + '</p>' +
      '<p class="chat-bubble__text">' + text + '</p>' +
      '</div>' +
      '</div>'
    );
  }

  /* ─── Render (incremental append) ─── */
  function renderMessages() {
    if (!chatMessages) return;
    var total = messages.length;

    if (renderedCount === 0) {
      chatMessages.innerHTML = '';
    }

    if (renderedCount < total) {
      var html = '';
      for (var i = renderedCount; i < total; i++) {
        html += msgHTML(messages[i]);
      }
      chatMessages.insertAdjacentHTML('beforeend', html);
      renderedCount = total;
    }

    /* scroll to bottom */
    var scrollParent = chatMessages.closest('.chat-messages-scroll');
    if (scrollParent) {
      scrollParent.scrollTop = scrollParent.scrollHeight;
    }
  }

  /* ─── Fetch history from Supabase ─── */
  function fetchHistory() {
    var url = APP_CONFIG.SUPABASE_URL + '/rest/v1/community_messages' +
      '?select=id,user_id,user_name,user_avatar_url,text,created_at' +
      '&channel=eq.' + encodeURIComponent(activeChannel) +
      '&topic=eq.' + encodeURIComponent(activeTopic) +
      '&order=created_at.asc&limit=100';

    return fetch(url, {
      headers: {
        'apikey': APP_CONFIG.SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + currentUser.token
      }
    })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        messages = data || [];
        renderedCount = 0;
        renderMessages();
      })
      .catch(function (err) {
        console.warn('[Community] Failed to fetch history:', err.message);
        messages = [];
        renderedCount = 0;
        renderMessages();
      });
  }

  /* ─── Send message to Supabase ─── */
  function sendMessage(text) {
    if (!text || !text.trim() || !currentUser) return;
    text = text.trim();

    /* Send cooldown: max 1 message per 5 detik */
    var now = Date.now();
    if (now - lastSendTime < SEND_COOLDOWN_MS) {
      console.log('[Community] Send cooldown — wait ' + Math.ceil((SEND_COOLDOWN_MS - (now - lastSendTime)) / 1000) + 's');
      return;
    }
    lastSendTime = now;

    /* Optimistic: add temp message immediately */
    var tempId = 'temp_' + Date.now();
    var tempMsg = {
      id: tempId,
      user_id: currentUser.id,
      user_name: currentUser.name,
      user_avatar_url: currentUser.avatar,
      text: text,
      created_at: new Date().toISOString()
    };
    messages.push(tempMsg);
    renderMessages();

    /* POST to Supabase — realtime will deliver the real row */
    var url = APP_CONFIG.SUPABASE_URL + '/rest/v1/community_messages';
    var payload = {
      channel: activeChannel,
      topic: activeTopic,
      user_id: currentUser.id,
      user_name: currentUser.name,
      user_avatar_url: currentUser.avatar || '',
      text: text
    };

    fetch(url, {
      method: 'POST',
      headers: {
        'apikey': APP_CONFIG.SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + currentUser.token,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(payload)
    })
      .then(function (r) {
        if (!r.ok) {
          console.warn('[Community] Send failed:', r.status);
          removeTempMessage(tempId);
        }
      })
      .catch(function (err) {
        console.warn('[Community] Send error:', err.message);
        removeTempMessage(tempId);
      });
  }

  function removeTempMessage(tempId) {
    messages = messages.filter(function (m) { return m.id !== tempId; });
    renderedCount = 0;
    renderMessages();
  }

  /* ─── Dedup: merge fetched messages with existing, keep sorted ─── */
  function dedupMessages(newMessages) {
    var existingIds = {};
    for (var i = 0; i < messages.length; i++) {
      existingIds[messages[i].id] = true;
    }
    var added = false;
    for (var j = 0; j < newMessages.length; j++) {
      if (!existingIds[newMessages[j].id]) {
        messages.push(newMessages[j]);
        existingIds[newMessages[j].id] = true;
        added = true;
      }
    }
    if (added) {
      /* Sort by created_at ascending */
      messages.sort(function (a, b) {
        return new Date(a.created_at) - new Date(b.created_at);
      });
      renderedCount = 0;
      renderMessages();
    }
  }

  /* ─── Polling fallback: fetch latest messages every 10s ─── */
  function pollNewMessages() {
    var url = APP_CONFIG.SUPABASE_URL + '/rest/v1/community_messages' +
      '?select=id,user_id,user_name,user_avatar_url,text,created_at' +
      '&channel=eq.' + encodeURIComponent(activeChannel) +
      '&topic=eq.' + encodeURIComponent(activeTopic) +
      '&order=created_at.asc&limit=100';

    fetch(url, {
      headers: {
        'apikey': APP_CONFIG.SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + currentUser.token
      }
    })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (data) {
        if (data && data.length > 0) {
          dedupMessages(data);
        }
      })
      .catch(function (err) {
        console.warn('[Community] Poll error:', err.message);
      });
  }

  function startPolling() {
    stopPolling();
    pollIntervalId = setInterval(pollNewMessages, POLL_INTERVAL_MS);
  }

  function stopPolling() {
    if (pollIntervalId) {
      clearInterval(pollIntervalId);
      pollIntervalId = null;
    }
  }

  /* ─── Realtime subscription ─── */
  function subscribeRealtime() {
    var sb = window.__supabase;
    if (!sb || !sb.channel) {
      console.warn('[Community] Realtime not available — messages will not update live.');
      return;
    }

    unsubscribeRealtime();

    /* Capture current topic so retry doesn't subscribe to wrong channel */
    var retryChannel = activeChannel;
    var retryTopic = activeTopic;

    realtimeChannel = sb.channel('community:' + activeChannel + ':' + activeTopic, {
      config: { broadcast: { self: false } }
    })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'community_messages',
        filter: 'channel=eq.' + activeChannel + '&topic=eq.' + activeTopic
      }, function (payload) {
        var msg = payload.new;
        if (!msg) return;

        /* Dedup: if this is our own message, replace the temp optimistic one */
        if (currentUser && msg.user_id === currentUser.id) {
          for (var i = messages.length - 1; i >= 0 && i >= messages.length - 5; i--) {
            if (String(messages[i].id).indexOf('temp_') === 0 && messages[i].text === msg.text) {
              messages[i] = msg;
              renderedCount = 0;
              renderMessages();
              return;
            }
          }
        }

        /* Skip if already exists */
        for (var j = 0; j < messages.length; j++) {
          if (messages[j].id === msg.id) return;
        }

        messages.push(msg);
        renderMessages();
      })
      .subscribe(function (status) {
        if (status === 'SUBSCRIBED') {
          console.log('[Community] Realtime subscribed:', retryChannel + '/' + retryTopic);
          _realtimeRetries = 0;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[Community] Realtime ' + status + ' — auto-retry in 5s (' + (_realtimeRetries + 1) + '/' + MAX_REALTIME_RETRIES + ')');
          if (_realtimeRetries < MAX_REALTIME_RETRIES) {
            _realtimeRetries++;
            setTimeout(function () {
              /* Only retry if still on same topic (user didn't switch away) */
              if (activeChannel === retryChannel && activeTopic === retryTopic) {
                subscribeRealtime();
              }
            }, 5000);
          }
        }
      });
  }

  function unsubscribeRealtime() {
    if (realtimeChannel && window.__supabase) {
      try {
        window.__supabase.removeChannel(realtimeChannel);
      } catch (e) { /* ignore */ }
    }
    realtimeChannel = null;
  }

  /* ─── Switch topic ─── */
  function switchTopic(topic) {
    if (activeTopic === topic) return;
    activeTopic = topic;
    localStorage.setItem(LS_ACTIVE_KEY, JSON.stringify({ channel: activeChannel, topic: activeTopic }));
    stopPolling();
    unsubscribeRealtime();
    fetchHistory().then(function () {
      subscribeRealtime();
      startPolling();
    });
    highlightTopic();
  }

  /* ─── Switch channel ─── */
  function switchChannel(channel) {
    if (activeChannel === channel) return;
    activeChannel = channel;
    localStorage.setItem(LS_ACTIVE_KEY, JSON.stringify({ channel: activeChannel, topic: activeTopic }));
    stopPolling();
    unsubscribeRealtime();
    fetchHistory().then(function () {
      subscribeRealtime();
      startPolling();
    });
    highlightChannel();
  }

  /* ─── Highlight active topic ─── */
  function highlightTopic() {
    if (!topicPanel) return;
    var items = topicPanel.querySelectorAll('.topic-item');
    for (var i = 0; i < items.length; i++) {
      var t = items[i].getAttribute('data-topic');
      if (t === activeTopic) {
        items[i].classList.add('topic-item--active');
      } else {
        items[i].classList.remove('topic-item--active');
      }
    }
    if (topicCollapsedHeader) {
      var activeItem = topicPanel.querySelector('.topic-item--active');
      var titleEl = topicCollapsedHeader.querySelector('.topic-panel__title');
      if (titleEl && activeItem) {
        var nameEl = activeItem.querySelector('.topic-item__name');
        if (nameEl) titleEl.textContent = nameEl.textContent;
      }
    }
  }

  /* ─── Highlight active channel ─── */
  function highlightChannel() {
    if (!channelSection) return;
    var avatars = channelSection.querySelectorAll('.channel-avatar');
    for (var i = 0; i < avatars.length; i++) {
      var c = avatars[i].getAttribute('data-channel');
      if (c === activeChannel) {
        avatars[i].classList.add('channel-avatar--active');
      } else {
        avatars[i].classList.remove('channel-avatar--active');
      }
    }
  }

  /* ─── Emoji picker ─── */
  function buildEmojiPicker() {
    var picker = document.createElement('div');
    picker.className = 'emoji-picker';
    EMOJIS.forEach(function (emoji) {
      var btn = document.createElement('button');
      btn.className = 'emoji-picker__item';
      btn.textContent = emoji;
      btn.type = 'button';
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        insertEmoji(emoji);
      });
      picker.appendChild(btn);
    });
    return picker;
  }

  function insertEmoji(emoji) {
    var start = inputText.selectionStart;
    var end = inputText.selectionEnd;
    var val = inputText.value;
    inputText.value = val.substring(0, start) + emoji + val.substring(end);
    var newPos = start + emoji.length;
    inputText.selectionStart = newPos;
    inputText.selectionEnd = newPos;
    inputText.focus();
    autoResizeTextarea();
    closeEmojiPicker();
  }

  function toggleEmojiPicker(e) {
    e.stopPropagation();
    if (emojiPicker.classList.contains('emoji-picker--open')) {
      closeEmojiPicker();
    } else {
      openEmojiPicker();
    }
  }

  function openEmojiPicker() {
    emojiPicker.classList.add('emoji-picker--open');
  }

  function closeEmojiPicker() {
    emojiPicker.classList.remove('emoji-picker--open');
  }

  /* ─── Auto-resize textarea ─── */
  function autoResizeTextarea() {
    var el = inputText;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }

  /* ─── Handle sending ─── */
  function handleSend() {
    var text = inputText.value.trim();
    if (!text) return;
    inputText.value = '';
    sendMessage(text);
    inputText.style.height = 'auto';
  }

  /* ─── Start chat after auth confirmed ─── */
  function startChat() {
    var sb = window.__supabase;
    if (!sb) return;

    sb.auth.getSession().then(function (result) {
      var session = result.data && result.data.session;
      if (!session || !session.user) {
        console.warn('[Community] No session — redirecting to /login');
        window.location.href = '/login';
        return;
      }

      currentUser = {
        id: session.user.id,
        email: session.user.email,
        name: (session.user.user_metadata && (session.user.user_metadata.full_name || session.user.user_metadata.name)) || session.user.email,
        avatar: (session.user.user_metadata && session.user.user_metadata.avatar_url) || '',
        token: session.access_token
      };

      console.log('[Community] Authenticated as:', currentUser.name);

      /* Fetch history + subscribe to realtime + start polling fallback */
      fetchHistory().then(subscribeRealtime);
      startPolling();
    }).catch(function (err) {
      console.error('[Community] Auth error:', err.message);
      window.location.href = '/login';
    });
  }

  /* ─── Init ─── */
  function init() {
    chatMessages = document.getElementById('chat-messages');
    inputText = document.getElementById('chat-input-text');
    btnSend = document.getElementById('btn-send');
    topicPanel = document.getElementById('topic-panel');
    topicBurger = document.getElementById('topic-burger');
    topicCollapsedHeader = document.getElementById('topic-collapsed-header');
    topicCollapsedBurger = document.getElementById('topic-collapsed-burger');
    channelSection = document.getElementById('channel-section');

    if (!chatMessages || !inputText || !btnSend) {
      console.warn('[Community] Required elements missing');
      return;
    }

    /* Restore active channel/topic from localStorage */
    try {
      var stored = JSON.parse(localStorage.getItem(LS_ACTIVE_KEY));
      if (stored && stored.channel && stored.topic) {
        activeChannel = stored.channel;
        activeTopic = stored.topic;
      }
    } catch (e) { /* ignore */ }

    highlightTopic();
    highlightChannel();

    /* Build emoji picker */
    emojiPicker = buildEmojiPicker();
    var emojiIcons = document.querySelectorAll('.chat-input__actions .chat-input__icon');
    btnEmoji = emojiIcons.length > 0 ? emojiIcons[0] : null;
    if (btnEmoji) {
      btnEmoji.parentNode.appendChild(emojiPicker);
      btnEmoji.addEventListener('click', toggleEmojiPicker);
    }
    document.addEventListener('click', function (e) {
      if (emojiPicker && emojiPicker.classList.contains('emoji-picker--open') &&
          !emojiPicker.contains(e.target) && e.target !== btnEmoji) {
        closeEmojiPicker();
      }
    });

    /* Wire send events */
    btnSend.addEventListener('click', handleSend);
    inputText.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    });
    inputText.addEventListener('input', autoResizeTextarea);

    /* Topic clicks */
    if (topicPanel) {
      topicPanel.addEventListener('click', function (e) {
        var item = e.target.closest('.topic-item');
        if (!item) return;
        var topic = item.getAttribute('data-topic');
        if (topic) switchTopic(topic);
      });
    }

    /* Channel clicks */
    if (channelSection) {
      channelSection.addEventListener('click', function (e) {
        var avatar = e.target.closest('.channel-avatar');
        if (!avatar) return;
        var channel = avatar.getAttribute('data-channel');
        if (channel) switchChannel(channel);
      });
    }

    /* Click chat area closes topic panel (mobile) */
    var chatArea = document.querySelector('.chat-area');
    if (chatArea && topicPanel) {
      chatArea.addEventListener('click', function (e) {
        if (topicPanel.classList.contains('collapsed')) return;
        if (e.target.closest('.topic-panel__burger')) return;
        toggleTopicPanel();
      });
    }

    /* Topic burger toggle (mobile) */
    function toggleTopicPanel() {
      var isCollapsed = topicPanel.classList.toggle('collapsed');
      if (topicCollapsedHeader) {
        topicCollapsedHeader.classList.toggle('topic-collapsed-header--visible', isCollapsed);
      }
    }
    if (topicBurger && topicPanel) {
      topicBurger.addEventListener('click', toggleTopicPanel);
    }
    if (topicCollapsedBurger && topicCollapsedHeader) {
      topicCollapsedBurger.addEventListener('click', toggleTopicPanel);
    }

    /* Wait for Supabase client, then start chat */
    var sb = window.__supabase;
    if (sb) {
      startChat();
    } else {
      document.addEventListener('supabase:ready', function handler() {
        document.removeEventListener('supabase:ready', handler);
        startChat();
      });
    }
  }

  /* ─── DOM ready ─── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
