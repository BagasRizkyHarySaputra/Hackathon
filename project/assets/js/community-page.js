/**
 * LICIN — Community Page Logic
 *
 * Features:
 *   - Dynamic channels + topics loaded from Supabase
 *   - Channel switching (renders topics for selected channel)
 *   - Topic switching (#Acne Fighter / #Review Skincare / #Skincare)
 *   - Realtime chat via Supabase (shared history across all users)
 *   - Admin controls: Add Channel, Add Topic (visible when auth.user.role === 'admin')
 *   - Auth-gated — redirects to /login if not signed in
 *
 * Storage: Supabase tables `community_channels`, `community_topics`, `community_messages`
 * Realtime: Supabase Realtime (postgres_changes INSERT subscription)
 */
(function () {
  'use strict';

  var LS_ACTIVE_KEY = 'licin_community_active';

  /* ─── State ─── */
  var currentUser = null;
  var activeChannel = 'general';
  var activeTopic = null;
  var channels = [];
  var topics = [];
  var messages = [];
  var renderedCount = 0;
  var realtimeChannel = null;
  var pollIntervalId = null;
  var POLL_INTERVAL_MS = 5000;
  var sendCooldownMs = 5000;
  var lastSendTime = 0;
  var _sending = false;
  var _realtimeRetries = 0;
  var MAX_REALTIME_RETRIES = 5;

  /* ─── Poll state ─── */
  var polls = [];
  var myVotes = {}; /* poll_id → option_index */

  /* ─── DOM refs (populated in init) ─── */
  var chatMessages, inputText, btnSend, communityContent, chatMessagesScroll;
  var topicPanel, topicList, topicBurger, topicCollapsedHeader, topicCollapsedBurger;
  var channelSection, btnAddTopic, btnAddChannel, adminCtrlChannel, btnPoll;

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

  /* ─── Helpers ─── */
  function esc(str) {
    var d = document.createElement('div');
    d.textContent = str == null ? '' : String(str);
    return d.innerHTML;
  }

  /* Auto-format name to display label: "acne-fighter" → "Acne Fighter" */
  function formatLabel(str) {
    if (!str) return '';
    return str.replace(/[-_]/g, ' ').replace(/\b\w/g, function (ch) { return ch.toUpperCase(); });
  }

  function authHeaders() {
    return {
      'apikey': APP_CONFIG.SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + (currentUser ? currentUser.token : APP_CONFIG.SUPABASE_ANON_KEY)
    };
  }

  function isAdmin() {
    /* Check currentUser first (resolved synchronously in startChat) */
    if (currentUser && currentUser.role === 'admin') return true;
    /* Fallback to Alpine store */
    var store = window.Alpine && Alpine.store('auth');
    return store && store.isAdmin;
  }

  /* ─── Load channels ─── */
  function loadChannels() {
    var url = APP_CONFIG.SUPABASE_URL + '/rest/v1/community_channels?select=*&order=name.asc';
    return fetch(url, { headers: authHeaders() })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (data) {
        channels = data || [];
        renderChannels();
        /* If activeChannel not in list, use first */
        var found = false;
        for (var i = 0; i < channels.length; i++) {
          if (channels[i].name === activeChannel) { found = true; break; }
        }
        if (!found && channels.length > 0) {
          activeChannel = channels[0].name;
        }
        highlightChannel();
        return loadTopics(activeChannel);
      })
      .catch(function (err) {
        console.warn('[Community] Failed to load channels:', err.message);
        channels = [];
        renderChannels();
      });
  }

  /* ─── Load topics for a channel ─── */
  function loadTopics(channel) {
    var url = APP_CONFIG.SUPABASE_URL + '/rest/v1/community_topics?select=*&channel=eq.' + encodeURIComponent(channel) + '&order=name.asc';
    return fetch(url, { headers: authHeaders() })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (data) {
        topics = data || [];
        renderTopics();
        /* Auto-select first topic if current not in list */
        var found = false;
        for (var i = 0; i < topics.length; i++) {
          if (topics[i].name === activeTopic) { found = true; break; }
        }
        if (!found && topics.length > 0) {
          activeTopic = topics[0].name;
        } else if (topics.length === 0) {
          activeTopic = null;
        }
        highlightTopic();
      })
      .catch(function (err) {
        console.warn('[Community] Failed to load topics:', err.message);
        topics = [];
        renderTopics();
      });
  }

  /* ─── Render channel avatars ─── */
  function renderChannels() {
    if (!channelSection) return;
    /* Remove existing channel-avatar and any orphaned labels */
    var existing = channelSection.querySelectorAll('.channel-avatar');
    for (var i = 0; i < existing.length; i++) { existing[i].remove(); }
    var orphans = channelSection.querySelectorAll('.channel-label');
    for (var i = 0; i < orphans.length; i++) { orphans[i].remove(); }

    /* Insert before the admin control container */
    var ref = adminCtrlChannel || channelSection.lastElementChild;

    for (var j = 0; j < channels.length; j++) {
      var c = channels[j];
      var name = c.name || '';
      var initial = name.charAt(0).toUpperCase();
      var display = formatLabel(name);
      var div = document.createElement('div');
      div.className = 'channel-avatar' + (name === activeChannel ? ' channel-avatar--active' : '');
      div.setAttribute('data-channel', name);
      div.title = display;
      div.innerHTML = '<div class="channel-avatar__circle">' + esc(initial) + '</div>' +
        '<span class="channel-label">' + esc(display) + '</span>';
      channelSection.insertBefore(div, ref);
    }
    /* Re-bind click for dynamically created avatars */
    channelSection.removeEventListener('click', onChannelClick);
    channelSection.addEventListener('click', onChannelClick);
  }

  /* ─── Render topics ─── */
  function renderTopics() {
    if (!topicList) return;
    topicList.innerHTML = '';
    for (var i = 0; i < topics.length; i++) {
      var t = topics[i];
      var name = t.name || '';
      var display = formatLabel(name);
      var div = document.createElement('div');
      div.className = 'topic-item' + (name === activeTopic ? ' topic-item--active' : '');
      div.setAttribute('data-topic', name);
      div.innerHTML = '<span class="topic-item__name">#' + esc(display) + '</span>';
      topicList.appendChild(div);
    }
  }

  /* ─── Channel click handler ─── */
  function onChannelClick(e) {
    var avatar = e.target.closest('.channel-avatar');
    if (!avatar) return;
    var channel = avatar.getAttribute('data-channel');
    if (channel) switchChannel(channel);
  }

  /* ─── Message Row HTML ─── */
  function msgHTML(msg) {
    /* Poll entries render as poll cards */
    if (msg._isPoll) {
      var poll = msg._pollData;
      return '<div class="chat-msg-row chat-msg-row--received">' +
        '<div class="chat-avatar"><div class="chat-avatar__circle">📊</div></div>' +
        '<div class="chat-bubble chat-bubble--received chat-bubble--poll">' +
        renderSinglePoll(poll) +
        '</div></div>';
    }

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
    if (renderedCount === 0) { chatMessages.innerHTML = ''; }
    if (renderedCount < total) {
      var html = '';
      for (var i = renderedCount; i < total; i++) { html += msgHTML(messages[i]); }
      chatMessages.insertAdjacentHTML('beforeend', html);
      renderedCount = total;
    }
    scrollToBottomIfNear();
  }

  /* Only auto-scroll if user is near the bottom (within 150px) */
  function scrollToBottomIfNear() {
    var parent = chatMessages ? chatMessages.closest('.chat-messages-scroll') : null;
    if (!parent) return;
    var threshold = 150;
    if (parent.scrollHeight - parent.scrollTop - parent.clientHeight < threshold) {
      parent.scrollTop = parent.scrollHeight;
    }
  }

  /* ─── Fetch history from Supabase ─── */
  function fetchHistory() {
    if (!activeTopic) {
      messages = [];
      renderedCount = 0;
      renderMessages();
      return Promise.resolve();
    }
    var url = APP_CONFIG.SUPABASE_URL + '/rest/v1/community_messages' +
      '?select=id,user_id,user_name,user_avatar_url,text,created_at' +
      '&channel=eq.' + encodeURIComponent(activeChannel) +
      '&topic=eq.' + encodeURIComponent(activeTopic) +
      '&order=created_at.asc&limit=100';

    return fetch(url, { headers: authHeaders() })
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

  /* --- Send message to Supabase --- */
  function sendMessage(text) {
    if (!text || !text.trim() || !currentUser || !activeTopic) return;
    text = text.trim();
    if (_sending) return;
    _sending = true;
    var now = Date.now();
    if (now - lastSendTime < sendCooldownMs) { _sending = false; return; }
    lastSendTime = now;

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
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(payload)
    })
      .then(function (r) {
        if (!r.ok) { console.warn('[Community] Send failed:', r.status); removeTempMessage(tempId); return; }
        return r.json();
      })
      .then(function (rows) {
        if (rows && rows.length > 0) { replaceTempMessage(tempId, rows[0]); }
        else { removeTempMessage(tempId); }
      })
      .catch(function (err) { console.warn('[Community] Send error:', err.message); removeTempMessage(tempId); })
      .finally(function () { _sending = false; });
  }

  function replaceTempMessage(tempId, realMsg) {
    var found = false;
    for (var i = 0; i < messages.length; i++) {
      if (messages[i].id === tempId) { messages[i] = realMsg; found = true; break; }
    }
    if (found) { renderedCount = 0; renderMessages(); }
  }

  function removeTempMessage(tempId) {
    messages = messages.filter(function (m) { return m.id !== tempId; });
    renderedCount = 0;
    renderMessages();
  }

  /* ─── Dedup ─── */
  function dedupMessages(newMessages) {
    var existingIds = {};
    for (var i = 0; i < messages.length; i++) { existingIds[messages[i].id] = true; }
    var added = false;
    for (var j = 0; j < newMessages.length; j++) {
      if (!existingIds[newMessages[j].id]) {
        messages.push(newMessages[j]);
        existingIds[newMessages[j].id] = true;
        added = true;
      }
    }
    if (added) {
      messages.sort(function (a, b) {
        var aTemp = String(a.id).indexOf('temp_') === 0;
        var bTemp = String(b.id).indexOf('temp_') === 0;
        if (aTemp && !bTemp) return 1;
        if (!aTemp && bTemp) return -1;
        return new Date(a.created_at) - new Date(b.created_at);
      });
      renderedCount = 0;
      renderMessages();
    }
  }

  /* ─── Polling ─── */
  function pollNewMessages() {
    if (!activeTopic) return;
    var url = APP_CONFIG.SUPABASE_URL + '/rest/v1/community_messages' +
      '?select=id,user_id,user_name,user_avatar_url,text,created_at' +
      '&channel=eq.' + encodeURIComponent(activeChannel) +
      '&topic=eq.' + encodeURIComponent(activeTopic) +
      '&order=created_at.asc&limit=100';

    fetch(url, { headers: authHeaders() })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (data) { if (data && data.length > 0) dedupMessages(data); })
      .catch(function (err) { console.warn('[Community] Poll error:', err.message); });
  }

  function startPolling() { stopPolling(); pollIntervalId = setInterval(pollNewMessages, POLL_INTERVAL_MS); }
  function stopPolling() { if (pollIntervalId) { clearInterval(pollIntervalId); pollIntervalId = null; } }

  /* ─── Realtime ─── */
  function subscribeRealtime() {
    var sb = window.__supabase;
    if (!sb || !sb.channel) return;
    unsubscribeRealtime();
    var retryChannel = activeChannel;
    var retryTopic = activeTopic;
    if (!retryTopic) return;

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
        if (currentUser && msg.user_id === currentUser.id) {
          for (var i = messages.length - 1; i >= 0 && i >= messages.length - 5; i--) {
            if (String(messages[i].id).indexOf('temp_') === 0 && messages[i].text === msg.text) {
              messages[i] = msg; renderedCount = 0; renderMessages(); return;
            }
          }
        }
        for (var j = 0; j < messages.length; j++) { if (messages[j].id === msg.id) return; }
        messages.push(msg);
        renderMessages();
      })
      .subscribe(function (status) {
        if (status === 'SUBSCRIBED') {
          console.log('[Community] Realtime subscribed:', retryChannel + '/' + retryTopic);
          _realtimeRetries = 0;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          if (_realtimeRetries < MAX_REALTIME_RETRIES) {
            _realtimeRetries++;
            setTimeout(function () {
              if (activeChannel === retryChannel && activeTopic === retryTopic) subscribeRealtime();
            }, 5000);
          }
        }
      });
  }

  function unsubscribeRealtime() {
    if (realtimeChannel && window.__supabase) {
      try { window.__supabase.removeChannel(realtimeChannel); } catch (e) { /* ignore */ }
    }
    realtimeChannel = null;
  }

  /* ─── Switch topic ─── */
  function switchTopic(topic) {
    if (activeTopic === topic || !topic) return;
    activeTopic = topic;
    localStorage.setItem(LS_ACTIVE_KEY, JSON.stringify({ channel: activeChannel, topic: activeTopic }));
    stopPolling();
    unsubscribeRealtime();
    highlightTopic();
    fetchHistory().then(function () {
      loadPolls();
      subscribeRealtime();
      startPolling();
    });
  }

  /* ─── Switch channel (reloads topics) ─── */
  function switchChannel(channel) {
    if (activeChannel === channel) return;
    activeChannel = channel;
    activeTopic = null; /* will be set by loadTopics */
    localStorage.setItem(LS_ACTIVE_KEY, JSON.stringify({ channel: activeChannel, topic: '' }));
    stopPolling();
    unsubscribeRealtime();
    highlightChannel();
    /* Reload topics for this channel */
    loadTopics(activeChannel).then(function () {
      localStorage.setItem(LS_ACTIVE_KEY, JSON.stringify({ channel: activeChannel, topic: activeTopic || '' }));
      fetchHistory().then(function () {
        loadPolls();
        subscribeRealtime();
        startPolling();
      });
    });
  }

  /* ─── Highlight ─── */
  function highlightTopic() {
    if (!topicList) return;
    var items = topicList.querySelectorAll('.topic-item');
    for (var i = 0; i < items.length; i++) {
      var t = items[i].getAttribute('data-topic');
      if (t === activeTopic) items[i].classList.add('topic-item--active');
      else items[i].classList.remove('topic-item--active');
    }
    if (topicCollapsedHeader) {
      var activeItem = topicList.querySelector('.topic-item--active');
      var titleEl = topicCollapsedHeader.querySelector('.topic-panel__title');
      if (titleEl && activeItem) {
        var nameEl = activeItem.querySelector('.topic-item__name');
        if (nameEl) titleEl.textContent = nameEl.textContent;
      }
    }
  }

  function highlightChannel() {
    if (!channelSection) return;
    var avatars = channelSection.querySelectorAll('.channel-avatar');
    for (var i = 0; i < avatars.length; i++) {
      var c = avatars[i].getAttribute('data-channel');
      if (c === activeChannel) avatars[i].classList.add('channel-avatar--active');
      else avatars[i].classList.remove('channel-avatar--active');
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
      btn.addEventListener('click', function (e) { e.stopPropagation(); insertEmoji(emoji); });
      picker.appendChild(btn);
    });
    return picker;
  }

  function insertEmoji(emoji) {
    var start = inputText.selectionStart, end = inputText.selectionEnd;
    var val = inputText.value;
    inputText.value = val.substring(0, start) + emoji + val.substring(end);
    var newPos = start + emoji.length;
    inputText.selectionStart = newPos; inputText.selectionEnd = newPos;
    inputText.focus();
    autoResizeTextarea();
    closeEmojiPicker();
  }

  function toggleEmojiPicker(e) {
    e.stopPropagation();
    if (emojiPicker.classList.contains('emoji-picker--open')) closeEmojiPicker();
    else openEmojiPicker();
  }
  function openEmojiPicker() { emojiPicker.classList.add('emoji-picker--open'); }
  function closeEmojiPicker() { emojiPicker.classList.remove('emoji-picker--open'); }
  function autoResizeTextarea() { var el = inputText; el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
  function handleSend() { var text = inputText.value.trim(); if (!text) return; inputText.value = ''; sendMessage(text); inputText.style.height = 'auto'; }

  /* ─── Admin: Add Topic ─── */
  function showAddTopicModal() {
    if (!isAdmin()) return;
    var overlay = document.createElement('div');
    overlay.className = 'community-modal-overlay';
    overlay.innerHTML =
      '<div class="community-modal">' +
      '<h3>Add Topic</h3>' +
      '<select id="modal-channel-select">' +
      channels.map(function (c) {
        return '<option value="' + esc(c.name) + '"' + (c.name === activeChannel ? ' selected' : '') + '>' + esc(formatLabel(c.name)) + '</option>';
      }).join('') +
      '</select>' +
      '<input id="modal-topic-name" type="text" placeholder="Topic name (e.g., acne-fighter)" />' +
      '<div class="community-modal-actions">' +
      '<button class="community-modal-btn-cancel" id="modal-cancel">Cancel</button>' +
      '<button class="community-modal-btn-primary" id="modal-confirm">Create</button>' +
      '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    document.getElementById('modal-cancel').addEventListener('click', function () { overlay.remove(); });
    document.getElementById('modal-confirm').addEventListener('click', function () {
      var channel = document.getElementById('modal-channel-select').value;
      var name = document.getElementById('modal-topic-name').value.trim();
      if (!name) return;
      createTopic(channel, name, overlay);
    });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });

    /* Enter to submit */
    var nameInput = document.getElementById('modal-topic-name');
    nameInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); document.getElementById('modal-confirm').click(); }
    });
    setTimeout(function () { document.getElementById('modal-topic-name').focus(); }, 100);
  }

  function createTopic(channel, name, overlay) {
    if (!currentUser) return;
    var url = APP_CONFIG.SUPABASE_URL + '/rest/v1/community_topics';
    fetch(url, {
      method: 'POST',
      headers: {
        'apikey': APP_CONFIG.SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + currentUser.token,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ channel: channel, name: name, label: name, created_by: currentUser.id })
    })
      .then(function (r) {
        if (!r.ok) { return r.json().then(function (e) { throw new Error(e.message || 'HTTP ' + r.status); }); }
        return r.json();
      })
      .then(function (rows) {
        if (rows && rows.length > 0) {
          /* If created for active channel, add to local list and re-render */
          if (channel === activeChannel) {
            topics.push(rows[0]);
            renderTopics();
            highlightTopic();
          }
          overlay.remove();
        }
      })
      .catch(function (err) { alert('Failed to create topic: ' + err.message); });
  }

  /* ─── Admin: Add Channel ─── */
  function showAddChannelModal() {
    if (!isAdmin()) return;
    var overlay = document.createElement('div');
    overlay.className = 'community-modal-overlay';
    overlay.innerHTML =
      '<div class="community-modal">' +
      '<h3>Add Channel</h3>' +
      '<input id="modal-channel-name" type="text" placeholder="Channel name (e.g., lifestyle)" />' +
      '<div class="community-modal-actions">' +
      '<button class="community-modal-btn-cancel" id="modal-cancel">Cancel</button>' +
      '<button class="community-modal-btn-primary" id="modal-confirm">Create</button>' +
      '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    document.getElementById('modal-cancel').addEventListener('click', function () { overlay.remove(); });
    document.getElementById('modal-confirm').addEventListener('click', function () {
      var name = document.getElementById('modal-channel-name').value.trim();
      if (!name) return;
      createChannel(name, overlay);
    });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });

    var nameInput = document.getElementById('modal-channel-name');
    nameInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); document.getElementById('modal-confirm').click(); }
    });
    setTimeout(function () { document.getElementById('modal-channel-name').focus(); }, 100);
  }

  function createChannel(name, overlay) {
    if (!currentUser) return;
    var url = APP_CONFIG.SUPABASE_URL + '/rest/v1/community_channels';
    fetch(url, {
      method: 'POST',
      headers: {
        'apikey': APP_CONFIG.SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + currentUser.token,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ name: name, label: name, created_by: currentUser.id })
    })
      .then(function (r) {
        if (!r.ok) { return r.json().then(function (e) { throw new Error(e.message || 'HTTP ' + r.status); }); }
        return r.json();
      })
      .then(function (rows) {
        if (rows && rows.length > 0) {
          channels.push(rows[0]);
          renderChannels();
          overlay.remove();
        }
      })
      .catch(function (err) { alert('Failed to create channel: ' + err.message); });
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
        token: session.access_token,
        role: session.user.app_metadata?.role || session.user.user_metadata?.role || 'user'
      };

      console.log('[Community] currentUser.role:', currentUser.role, '| app_metadata:', JSON.stringify(session.user.app_metadata), '| user_metadata:', JSON.stringify(session.user.user_metadata));

      console.log('[Community] Authenticated as:', currentUser.name);

      /* Show admin controls if applicable */
      updateAdminUI();

      /* Load channels → topics → messages */
      loadChannels().then(function () {
        localStorage.setItem(LS_ACTIVE_KEY, JSON.stringify({ channel: activeChannel, topic: activeTopic || '' }));
        fetchHistory().then(function () { loadPolls(); subscribeRealtime(); });
        startPolling();
      });
    }).catch(function (err) {
      console.error('[Community] Auth error:', err.message);
      window.location.href = '/login';
    });
  }

  /* ─── Show/hide admin controls ─── */
  function updateAdminUI() {
    /* Check role directly from currentUser (already resolved) */
    var admin = !!(currentUser && currentUser.role === 'admin');
    console.log('[Community] updateAdminUI() — currentUser.role:', currentUser ? currentUser.role : 'null', '→ admin:', admin);
    /* Also check Alpine store as fallback for delayed init */
    if (!admin) {
      try {
        var store = Alpine.store('auth');
        admin = !!(store && store.user && store.user.role === 'admin');
        console.log('[Community] Alpine auth store check — user:', store ? (store.user ? store.user.role : 'null') : 'store not ready', '→ admin:', admin);
      } catch (e) { console.warn('[Community] Alpine store not ready yet'); }
    }
    if (btnAddTopic) btnAddTopic.style.display = admin ? '' : 'none';
    if (adminCtrlChannel) adminCtrlChannel.style.display = admin ? '' : 'none';
    if (btnPoll) btnPoll.style.display = admin ? '' : 'none';
  }

  /* ═══════════════════════════════════════════
   *  POLLS
   * ═══════════════════════════════════════════ */

  function loadPolls() {
    if (!activeTopic) {
      polls = [];
      mergePollsIntoMessages();
      return Promise.resolve([]);
    }
    var url = APP_CONFIG.SUPABASE_URL + '/rest/v1/community_polls' +
      '?select=id,channel,topic,question,options,created_by,created_at' +
      '&channel=eq.' + encodeURIComponent(activeChannel) +
      '&topic=eq.' + encodeURIComponent(activeTopic) +
      '&order=created_at.asc';

    return fetch(url, { headers: authHeaders() })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (data) {
        polls = data || [];
        return loadMyVotes();
      })
      .then(function () {
        mergePollsIntoMessages();
        renderMessages();
        scrollToBottomIfNear();
        return polls;
      })
      .catch(function (err) {
        console.warn('[Community] Failed to load polls:', err.message);
        polls = [];
        mergePollsIntoMessages();
      });
  }

  /* Merge polls into the messages array as poll-type entries */
  function mergePollsIntoMessages() {
    /* Remove old poll entries */
    messages = messages.filter(function (m) { return !m._isPoll; });
    /* Convert polls to message-like objects */
    for (var i = 0; i < polls.length; i++) {
      var p = polls[i];
      var votes = p.votes || [];
      var totalVotes = 0;
      for (var vi = 0; vi < votes.length; vi++) totalVotes += votes[vi];

      messages.push({
        _isPoll: true,
        _pollData: p,
        user_id: p.created_by,
        user_name: '📊 Poll',
        user_avatar_url: '',
        text: p.question,
        created_at: p.created_at
      });
    }
    /* Sort by timestamp */
    messages.sort(function (a, b) {
      return new Date(a.created_at) - new Date(b.created_at);
    });
    renderedCount = 0;
  }

  function loadMyVotes() {
    if (!currentUser || polls.length === 0) {
      myVotes = {};
      return Promise.resolve();
    }
    var pollIds = polls.map(function (p) { return p.id; });
    var url = APP_CONFIG.SUPABASE_URL + '/rest/v1/community_poll_votes' +
      '?select=poll_id,option_index' +
      '&user_id=eq.' + currentUser.id +
      '&poll_id=in.(' + pollIds.join(',') + ')';

    return fetch(url, { headers: authHeaders() })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (votes) {
        myVotes = {};
        for (var i = 0; i < votes.length; i++) {
          myVotes[votes[i].poll_id] = votes[i].option_index;
        }
      })
      .catch(function () { myVotes = {}; });
  }

  function renderSinglePoll(poll) {
    var options = poll.options || [];
    var totalVotes = 0;
    var voteCounts = [];
    for (var i = 0; i < options.length; i++) {
      var cnt = (poll.votes && poll.votes[i]) || 0;
      voteCounts.push(cnt);
      totalVotes += cnt;
    }

    var myVote = myVotes[poll.id];
    var html = '<div class="poll-card" data-poll-id="' + esc(poll.id) + '">' +
      '<div class="poll-card__question">' + esc(poll.question) + '</div>';

    for (var j = 0; j < options.length; j++) {
      var pct = totalVotes > 0 ? Math.round((voteCounts[j] / totalVotes) * 100) : 0;
      var selected = myVote === j ? ' poll-option--selected' : '';
      html +=
        '<div class="poll-option' + selected + '" data-option="' + j + '">' +
        '<div class="poll-option__bar" style="width:' + pct + '%"></div>' +
        '<span class="poll-option__text">' + esc(options[j]) + '</span>' +
        '<span class="poll-option__count">' + voteCounts[j] + '</span>' +
        '</div>';
    }

    html += '<div class="poll-card__footer">' + totalVotes + ' vote' + (totalVotes !== 1 ? 's' : '') + '</div>';
    html += '</div>';
    return html;
  }

  function votePoll(pollId, optionIndex) {
    if (!currentUser) return;
    var myVote = myVotes[pollId];

    var doDelete = (myVote === optionIndex);
    var doUpdate = (myVote !== undefined && myVote !== optionIndex);

    if (doDelete) {
      /* Remove vote */
      var url = APP_CONFIG.SUPABASE_URL + '/rest/v1/community_poll_votes' +
        '?poll_id=eq.' + pollId + '&user_id=eq.' + currentUser.id;
      fetch(url, {
        method: 'DELETE',
        headers: {
          'apikey': APP_CONFIG.SUPABASE_ANON_KEY,
          'Authorization': 'Bearer ' + currentUser.token
        }
      }).then(function () {
        delete myVotes[pollId];
        refreshPollVoteCounts();
      }).catch(function (err) { console.warn('[Community] Vote error:', err.message); });
      return;
    }

    if (doUpdate) {
      /* Delete old vote first */
      var delUrl = APP_CONFIG.SUPABASE_URL + '/rest/v1/community_poll_votes' +
        '?poll_id=eq.' + pollId + '&user_id=eq.' + currentUser.id;
      fetch(delUrl, {
        method: 'DELETE',
        headers: {
          'apikey': APP_CONFIG.SUPABASE_ANON_KEY,
          'Authorization': 'Bearer ' + currentUser.token
        }
      }).then(function () {
        return insertVote(pollId, optionIndex);
      }).catch(function () {
        insertVote(pollId, optionIndex); /* try anyway */
      });
      return;
    }

    /* New vote */
    insertVote(pollId, optionIndex);
  }

  function insertVote(pollId, optionIndex) {
    var url = APP_CONFIG.SUPABASE_URL + '/rest/v1/community_poll_votes';
    fetch(url, {
      method: 'POST',
      headers: {
        'apikey': APP_CONFIG.SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + currentUser.token,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ poll_id: pollId, option_index: optionIndex, user_id: currentUser.id })
    }).then(function (r) {
      if (!r.ok) { console.warn('[Community] Vote insert failed:', r.status); return; }
      myVotes[pollId] = optionIndex;
      refreshPollVoteCounts();
    }).catch(function (err) { console.warn('[Community] Vote error:', err.message); });
  }

  function refreshPollVoteCounts() {
    if (polls.length === 0) return;
    /* Fetch all votes for current polls */
    var pollIds = polls.map(function (p) { return p.id; });
    var url = APP_CONFIG.SUPABASE_URL + '/rest/v1/community_poll_votes?select=poll_id,option_index' +
      '&poll_id=in.(' + pollIds.join(',') + ')';

    fetch(url, { headers: authHeaders() })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (votes) {
        var counts = {};
        for (var i = 0; i < votes.length; i++) {
          var pid = votes[i].poll_id;
          var oi = votes[i].option_index;
          if (!counts[pid]) counts[pid] = {};
          counts[pid][oi] = (counts[pid][oi] || 0) + 1;
        }
        for (var j = 0; j < polls.length; j++) {
          var pollVotes = counts[polls[j].id] || {};
          polls[j].votes = [];
          for (var k = 0; k < (polls[j].options || []).length; k++) {
            polls[j].votes.push(pollVotes[k] || 0);
          }
        }
        mergePollsIntoMessages();
        renderMessages();
      })
      .catch(function () { /* silent */ });
  }

  function showCreatePollModal() {
    if (!isAdmin()) return;
    var overlay = document.createElement('div');
    overlay.className = 'community-modal-overlay';
    overlay.innerHTML =
      '<div class="community-modal community-modal--poll">' +
      '<h3>Create Poll</h3>' +
      '<input id="poll-question" type="text" placeholder="What is your question?" />' +
      '<div class="poll-options-list" id="poll-options-list">' +
      '<div class="poll-option-row"><input type="text" placeholder="Option 1" class="poll-option-input" /></div>' +
      '<div class="poll-option-row"><input type="text" placeholder="Option 2" class="poll-option-input" /></div>' +
      '</div>' +
      '<button class="poll-add-option-btn" id="poll-add-option">+ Add option</button>' +
      '<div class="community-modal-actions">' +
      '<button class="community-modal-btn-cancel" id="modal-cancel">Cancel</button>' +
      '<button class="community-modal-btn-primary" id="modal-confirm">Create Poll</button>' +
      '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    document.getElementById('modal-cancel').addEventListener('click', function () { overlay.remove(); });
    document.getElementById('modal-confirm').addEventListener('click', function () {
      var question = document.getElementById('poll-question').value.trim();
      var inputs = overlay.querySelectorAll('.poll-option-input');
      var options = [];
      for (var i = 0; i < inputs.length; i++) {
        var val = inputs[i].value.trim();
        if (val) options.push(val);
      }
      if (!question || options.length < 2) { alert('Please fill in the question and at least 2 options.'); return; }
      createPollInDb(question, options, overlay);
    });
    document.getElementById('poll-add-option').addEventListener('click', function () {
      var list = document.getElementById('poll-options-list');
      var row = document.createElement('div');
      row.className = 'poll-option-row';
      var idx = list.children.length + 1;
      row.innerHTML = '<input type="text" placeholder="Option ' + idx + '" class="poll-option-input" />';
      list.appendChild(row);
    });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
    setTimeout(function () { document.getElementById('poll-question').focus(); }, 100);
  }

  function createPollInDb(question, options, overlay) {
    if (!currentUser) return;
    var url = APP_CONFIG.SUPABASE_URL + '/rest/v1/community_polls';
    fetch(url, {
      method: 'POST',
      headers: {
        'apikey': APP_CONFIG.SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + currentUser.token,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        channel: activeChannel,
        topic: activeTopic,
        question: question,
        options: options,
        created_by: currentUser.id
      })
    })
      .then(function (r) {
        if (!r.ok) { return r.json().then(function (e) { throw new Error(e.message || 'HTTP ' + r.status); }); }
        return r.json();
      })
      .then(function (rows) {
        if (rows && rows.length > 0) {
          polls.push(rows[0]);
        mergePollsIntoMessages();
        renderMessages();
          overlay.remove();
        }
      })
      .catch(function (err) { alert('Failed to create poll: ' + err.message); });
  }

  /* ─── Init ─── */
  function init() {
    console.log('[Community] init() called');

    chatMessages = document.getElementById('chat-messages');
    inputText = document.getElementById('chat-input-text');
    btnSend = document.getElementById('btn-send');
    communityContent = document.getElementById('community-content');
    chatMessagesScroll = chatMessages ? chatMessages.parentElement : null;
    topicPanel = document.getElementById('topic-panel');
    topicList = document.getElementById('topic-list');
    topicBurger = document.getElementById('topic-burger');
    topicCollapsedHeader = document.getElementById('topic-collapsed-header');
    topicCollapsedBurger = document.getElementById('topic-collapsed-burger');
    channelSection = document.getElementById('channel-section');
    btnAddTopic = document.getElementById('btn-add-topic');
    btnAddChannel = document.getElementById('btn-add-channel');
    btnPoll = document.getElementById('btn-poll');
    adminCtrlChannel = document.getElementById('admin-ctrl-channel');
    console.log('[Community] btnPoll found:', !!btnPoll);

    if (!chatMessages || !inputText || !btnSend) {
      console.warn('[Community] Required elements missing');
      return;
    }

    /* Restore active channel/topic from localStorage */
    try {
      var stored = JSON.parse(localStorage.getItem(LS_ACTIVE_KEY));
      if (stored && stored.channel) {
        activeChannel = stored.channel;
        if (stored.topic) activeTopic = stored.topic;
      }
    } catch (e) { /* ignore */ }

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
          !emojiPicker.contains(e.target) && e.target !== btnEmoji) closeEmojiPicker();
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

    /* Channel clicks are handled by onChannelClick (bound in renderChannels) */

    /* Click chat area closes topic panel (mobile) */
    var chatArea = document.querySelector('.chat-area');
    if (chatArea && topicPanel) {
      chatArea.addEventListener('click', function (e) {
        if (topicPanel.classList.contains('collapsed')) return;
        if (e.target.closest('.topic-panel__burger')) return;
        toggleTopicPanel();
      });
    }

    function toggleTopicPanel() {
      var isCollapsed = topicPanel.classList.toggle('collapsed');
      if (topicCollapsedHeader) topicCollapsedHeader.classList.toggle('topic-collapsed-header--visible', isCollapsed);
    }
    if (topicBurger && topicPanel) topicBurger.addEventListener('click', toggleTopicPanel);
    if (topicCollapsedBurger && topicCollapsedHeader) topicCollapsedBurger.addEventListener('click', toggleTopicPanel);

    /* Admin: Add Topic button */
    if (btnAddTopic) btnAddTopic.addEventListener('click', showAddTopicModal);

    /* Admin: Add Channel button */
    if (btnAddChannel) btnAddChannel.addEventListener('click', showAddChannelModal);

    /* Admin: Create Poll button */
    if (btnPoll) btnPoll.addEventListener('click', showCreatePollModal);

    /* Poll vote clicks via event delegation */
    if (chatMessages) {
      chatMessages.addEventListener('click', function (e) {
        var option = e.target.closest('.poll-option');
        if (!option) return;
        var card = option.closest('.poll-card');
        if (!card) return;
        var pollId = card.getAttribute('data-poll-id');
        var optionIndex = parseInt(option.getAttribute('data-option'));
        if (pollId && !isNaN(optionIndex)) votePoll(pollId, optionIndex);
      });
    }

    /* Watch auth store for admin changes */
    document.addEventListener('alpine:auth-change', function () { updateAdminUI(); });

    /* Wait for Supabase client */
    var sb = window.__supabase;
    if (sb) startChat();
    else document.addEventListener('supabase:ready', function handler() {
      document.removeEventListener('supabase:ready', handler);
      startChat();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
