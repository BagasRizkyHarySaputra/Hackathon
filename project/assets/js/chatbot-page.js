/**
 * SkinGlow — ChatBot Page Logic
 *
 * Features:
 *   - Chat list (create/switch/rename) stored in Supabase `chatbot_chats`
 *   - Messages stored in Supabase `chatbot_messages`
 *   - Bot auto-replies "Mehh…" after each user message (client-side insert)
 *   - Realtime subscription for live message updates
 *   - Auth-gated — redirects to /login if not signed in
 *   - Each user has their own isolated chat space (RLS-protected)
 *
 * Storage: Supabase tables `chatbot_chats` + `chatbot_messages` (RLS-protected)
 * Realtime: Supabase Realtime (postgres_changes INSERT subscription)
 */
(function () {
  'use strict';

  /* ─── State ─── */
  var currentUser = null;
  var chats = [];
  var activeChatId = null;
  var messages = [];
  var renderedCount = 0;
  var realtimeChannel = null;
  var pollIntervalId = null;
  var POLL_INTERVAL_MS = 5000;
  var _sending = false;
  var _realtimeRetries = 0;
  var MAX_REALTIME_RETRIES = 5;

  var BOT_AVATAR = '/assets/icons/water-drop-mascot.svg';
  var BOT_REPLY_TEXT = 'Mehh…';
  var BOT_REPLY_DELAY = 700;

  /* ─── DOM refs (populated in init) ─── */
  var historyList, chatMessages, inputText, btnSend, btnNewChat;

  /* ─── HTML Escape ─── */
  function esc(str) {
    var d = document.createElement('div');
    d.textContent = str == null ? '' : String(str);
    return d.innerHTML;
  }

  /* ─── Message Row HTML ─── */
  function msgHTML(msg) {
    var text = esc(msg.text);
    var isUser = msg.sender_type === 'user';

    if (isUser) {
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

    /* Bot message — show mascot avatar */
    return (
      '<div class="chat-msg-row chat-msg-row--received">' +
      '<div class="chat-avatar">' +
      '<img src="' + BOT_AVATAR + '" alt="" class="chat-avatar__mascot" />' +
      '</div>' +
      '<div class="chat-bubble chat-bubble--received">' +
      '<p class="chat-bubble__text">' + text + '</p>' +
      '</div>' +
      '</div>'
    );
  }

  /* ─── Render messages (incremental append) ─── */
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

  /* ─── Render history list (chat list sidebar) ─── */
  function renderHistory() {
    if (!historyList) return;
    var html = '';
    for (var i = 0; i < chats.length; i++) {
      var c = chats[i];
      var cls = c.id === activeChatId ? 'history-item active' : 'history-item';
      html += '<div class="' + cls + '" data-chat-id="' + esc(c.id) + '">' +
              '<span class="history-item__name">' + esc(c.name) + '</span>' +
              '</div>';
    }
    historyList.innerHTML = html;
    bindHistoryEvents();
  }

  function bindHistoryEvents() {
    var items = historyList.querySelectorAll('.history-item');
    for (var i = 0; i < items.length; i++) {
      (function (item) {
        /* Single click → switch chat */
        item.addEventListener('click', function () {
          var id = item.getAttribute('data-chat-id');
          switchToChat(id);
        });

        /* Double click → rename */
        item.addEventListener('dblclick', function (e) {
          e.stopPropagation();
          var id = item.getAttribute('data-chat-id');
          var chat = findChat(id);
          if (!chat) return;

          var nameSpan = item.querySelector('.history-item__name');
          var oldName = chat.name;

          var input = document.createElement('input');
          input.type = 'text';
          input.className = 'history-item__input';
          input.value = oldName;
          input.setAttribute('data-chat-id', id);

          nameSpan.replaceWith(input);
          input.focus();
          input.select();

          function finishRename() {
            var newName = input.value.trim() || oldName;
            if (newName === oldName) {
              renderHistory();
              return;
            }
            renameChat(id, newName);
          }
          input.addEventListener('keydown', function (ev) {
            if (ev.key === 'Enter') { ev.preventDefault(); finishRename(); }
          });
          input.addEventListener('blur', finishRename);
        });
      })(items[i]);
    }
  }

  /* ─── Find chat by ID ─── */
  function findChat(id) {
    for (var i = 0; i < chats.length; i++) {
      if (chats[i].id === id) return chats[i];
    }
    return null;
  }

  /* ─── Fetch chat list from Supabase ─── */
  function fetchChats() {
    if (!currentUser) return Promise.resolve();

    var url = APP_CONFIG.SUPABASE_URL + '/rest/v1/chatbot_chats' +
      '?select=id,name,created_at' +
      '&user_id=eq.' + encodeURIComponent(currentUser.id) +
      '&order=created_at.asc';

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
        chats = data || [];
        renderHistory();
      })
      .catch(function (err) {
        console.warn('[ChatBot] Failed to fetch chats:', err.message);
        chats = [];
        renderHistory();
      });
  }

  /* ─── Fetch messages for active chat ─── */
  function fetchMessages() {
    if (!currentUser || !activeChatId) return Promise.resolve();

    var url = APP_CONFIG.SUPABASE_URL + '/rest/v1/chatbot_messages' +
      '?select=id,chat_id,user_id,sender_type,text,created_at' +
      '&chat_id=eq.' + encodeURIComponent(activeChatId) +
      '&order=created_at.asc&limit=200';

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
        console.warn('[ChatBot] Failed to fetch messages:', err.message);
        messages = [];
        renderedCount = 0;
        renderMessages();
      });
  }

  /* ─── Create new chat in Supabase ─── */
  function createNewChat() {
    if (!currentUser) return;

    var url = APP_CONFIG.SUPABASE_URL + '/rest/v1/chatbot_chats';
    var payload = {
      user_id: currentUser.id,
      name: 'Chat ' + (chats.length + 1)
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
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (rows) {
        if (rows && rows.length > 0) {
          chats.push(rows[0]);
          renderHistory();
          switchToChat(rows[0].id);
        }
      })
      .catch(function (err) {
        console.warn('[ChatBot] Failed to create chat:', err.message);
      });
  }

  /* ─── Rename chat in Supabase ─── */
  function renameChat(chatId, newName) {
    if (!currentUser) return;

    var url = APP_CONFIG.SUPABASE_URL + '/rest/v1/chatbot_chats' +
      '?id=eq.' + encodeURIComponent(chatId);

    fetch(url, {
      method: 'PATCH',
      headers: {
        'apikey': APP_CONFIG.SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + currentUser.token,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ name: newName })
    })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (rows) {
        if (rows && rows.length > 0) {
          var chat = findChat(chatId);
          if (chat) chat.name = rows[0].name;
          renderHistory();
        }
      })
      .catch(function (err) {
        console.warn('[ChatBot] Failed to rename chat:', err.message);
        renderHistory();
      });
  }

  /* ─── Insert message to Supabase ─── */
  function insertMessage(chatId, senderType, text) {
    var url = APP_CONFIG.SUPABASE_URL + '/rest/v1/chatbot_messages';
    var payload = {
      chat_id: chatId,
      user_id: currentUser.id,
      sender_type: senderType,
      text: text
    };

    return fetch(url, {
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
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (rows) {
        if (rows && rows.length > 0) {
          return rows[0];
        }
        return null;
      });
  }

  /* ─── Send message + bot auto-reply ─── */
  function sendMessage(text) {
    if (!text || !text.trim() || !currentUser || !activeChatId) return;
    text = text.trim();

    if (_sending) return;
    _sending = true;

    /* Optimistic: show user message immediately */
    var tempId = 'temp_' + Date.now();
    var tempMsg = {
      id: tempId,
      chat_id: activeChatId,
      user_id: currentUser.id,
      sender_type: 'user',
      text: text,
      created_at: new Date().toISOString()
    };
    messages.push(tempMsg);
    renderMessages();

    /* Insert user message to Supabase */
    insertMessage(activeChatId, 'user', text)
      .then(function (realMsg) {
        if (realMsg) {
          replaceTempMessage(tempId, realMsg);
        } else {
          removeTempMessage(tempId);
        }

        /* Bot auto-reply after delay */
        setTimeout(function () {
          insertMessage(activeChatId, 'bot', BOT_REPLY_TEXT)
            .then(function (botMsg) {
              if (botMsg) {
                messages.push(botMsg);
                renderMessages();
              }
            })
            .catch(function (err) {
              console.warn('[ChatBot] Bot reply failed:', err.message);
            });
        }, BOT_REPLY_DELAY);
      })
      .catch(function (err) {
        console.warn('[ChatBot] Send failed:', err.message);
        removeTempMessage(tempId);
      })
      .finally(function () {
        _sending = false;
      });
  }

  function replaceTempMessage(tempId, realMsg) {
    for (var i = 0; i < messages.length; i++) {
      if (messages[i].id === tempId) {
        messages[i] = realMsg;
        renderedCount = 0;
        renderMessages();
        return;
      }
    }
  }

  function removeTempMessage(tempId) {
    messages = messages.filter(function (m) { return m.id !== tempId; });
    renderedCount = 0;
    renderMessages();
  }

  /* ─── Switch to a chat ─── */
  function switchToChat(chatId) {
    if (activeChatId === chatId) return;
    activeChatId = chatId;

    stopPolling();
    unsubscribeRealtime();

    fetchMessages().then(function () {
      subscribeRealtime();
      startPolling();
    });
    renderHistory();
  }

  /* ─── Realtime subscription ─── */
  function subscribeRealtime() {
    var sb = window.__supabase;
    if (!sb || !sb.channel || !activeChatId) {
      console.warn('[ChatBot] Realtime not available — messages will not update live.');
      return;
    }

    unsubscribeRealtime();

    var retryChatId = activeChatId;

    realtimeChannel = sb.channel('chatbot:' + activeChatId, {
      config: { broadcast: { self: false } }
    })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chatbot_messages',
        filter: 'chat_id=eq.' + activeChatId
      }, function (payload) {
        var msg = payload.new;
        if (!msg) return;

        /* Dedup: skip if already exists */
        for (var i = 0; i < messages.length; i++) {
          if (messages[i].id === msg.id) return;
        }

        /* If this is our own user message, replace temp if exists */
        if (currentUser && msg.user_id === currentUser.id && msg.sender_type === 'user') {
          for (var j = messages.length - 1; j >= 0 && j >= messages.length - 5; j--) {
            if (String(messages[j].id).indexOf('temp_') === 0 && messages[j].text === msg.text) {
              messages[j] = msg;
              renderedCount = 0;
              renderMessages();
              return;
            }
          }
        }

        messages.push(msg);
        renderMessages();
      })
      .subscribe(function (status) {
        if (status === 'SUBSCRIBED') {
          console.log('[ChatBot] Realtime subscribed to chat:', retryChatId);
          _realtimeRetries = 0;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[ChatBot] Realtime ' + status + ' — auto-retry in 5s (' + (_realtimeRetries + 1) + '/' + MAX_REALTIME_RETRIES + ')');
          if (_realtimeRetries < MAX_REALTIME_RETRIES) {
            _realtimeRetries++;
            setTimeout(function () {
              if (activeChatId === retryChatId) {
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

  /* ─── Polling fallback ─── */
  function pollNewMessages() {
    if (!currentUser || !activeChatId) return;

    var url = APP_CONFIG.SUPABASE_URL + '/rest/v1/chatbot_messages' +
      '?select=id,chat_id,user_id,sender_type,text,created_at' +
      '&chat_id=eq.' + encodeURIComponent(activeChatId) +
      '&order=created_at.asc&limit=200';

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
        console.warn('[ChatBot] Poll error:', err.message);
      });
  }

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

  /* ─── Handle send button ─── */
  function handleSend() {
    var text = inputText.value.trim();
    if (!text) return;
    inputText.value = '';
    sendMessage(text);
  }

  /* ─── Start chatbot after auth confirmed ─── */
  function startChatbot() {
    var sb = window.__supabase;
    if (!sb) return;

    sb.auth.getSession().then(function (result) {
      var session = result.data && result.data.session;
      if (!session || !session.user) {
        console.warn('[ChatBot] No session — redirecting to /login');
        window.location.href = '/login';
        return;
      }

      currentUser = {
        id: session.user.id,
        email: session.user.email,
        name: (session.user.user_metadata && (session.user.user_metadata.full_name || session.user.user_metadata.name)) || session.user.email,
        token: session.access_token
      };

      console.log('[ChatBot] Authenticated as:', currentUser.name);

      /* Fetch chat list, then auto-select first chat or create new */
      fetchChats().then(function () {
        if (chats.length > 0) {
          switchToChat(chats[0].id);
        } else {
          /* No chats yet — create default */
          createNewChat();
        }
      });
    }).catch(function (err) {
      console.error('[ChatBot] Auth error:', err.message);
      window.location.href = '/login';
    });
  }

  /* ─── Init ─── */
  function init() {
    historyList = document.getElementById('history-list');
    chatMessages = document.getElementById('chat-messages');
    inputText = document.getElementById('chat-input-text');
    btnSend = document.getElementById('btn-send');
    btnNewChat = document.getElementById('btn-new-chat');

    if (!chatMessages || !inputText || !btnSend) {
      console.warn('[ChatBot] Required elements missing');
      return;
    }

    /* Wire send events */
    btnSend.addEventListener('click', handleSend);
    inputText.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); handleSend(); }
    });

    /* New chat button */
    if (btnNewChat) {
      btnNewChat.addEventListener('click', createNewChat);
    }

    /* Wait for Supabase client, then start */
    var sb = window.__supabase;
    if (sb) {
      startChatbot();
    } else {
      document.addEventListener('supabase:ready', function handler() {
        document.removeEventListener('supabase:ready', handler);
        startChatbot();
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

/* ==========================================================================
   Emoji Picker
   ========================================================================== */
(function () {
  'use strict';

  var EMOJI_DATA = [
    { cat: 'smileys', label: '😀', items: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😊','😇','🥰','😍','🤩','😘','😗','😚','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤔','🤐','😐','😑','😶','😏','😒','🙄','😬','😮','😯','😲','😳','🥺','😢','😭','😤','😡','🤬','💀','☠️','💩','🤡'] },
    { cat: 'gestures', label: '👋', items: ['👋','🤚','✋','🖐️','✌️','🤞','🤟','🤘','🤙','👌','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','💪','👍🏻','👍🏼','👍🏽','👍🏾','👍🏿'] },
    { cat: 'people', label: '🧑', items: ['🧑','👨','👩','🧓','👴','👵','👶','👦','👧','🧒','👱','👳','👸','🤴','🦸','🦹','🧙','🧚','🧛','🧜','🧝','🧞','🧟','💃','🕺','👯','🧖','🧗'] },
    { cat: 'animals', label: '🐱', items: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🐤','🐥','🦆','🦅','🦉','🦇','🐺','🐴','🦄','🐝','🦋','🐌','🐞','🐜','🐢','🐍','🦎','🐙','🦑','🐡','🐬','🐳','🐋','🦈'] },
    { cat: 'food', label: '🍕', items: ['🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑','🥦','🥬','🌽','🥕','🥔','🍠','🍞','🥖','🧀','🥚','🍳','🥞','🥓','🥩','🍗','🍖','🌭','🍔','🍟','🍕','🥪','🥙','🌮','🌯','🥗'] },
    { cat: 'activities', label: '⚽', items: ['⚽','🏀','🏈','⚾','🎾','🏐','🏉','🎱','🏓','🏸','🏒','🏑','🥍','🏏','⛳','🏹','🎣','🥊','🥋','🎽','🛹','🛼','🥌','🎿','🏂','🏋️','🤼','🤸','🤺','🏄','🏊','🚴','🚵','🏇','🧘','🎯','🎮','🎲','♟️','🎨'] },
    { cat: 'objects', label: '💡', items: ['👓','🕶️','🥽','👔','👕','👖','🧣','🧤','🧥','🧦','👗','👘','👙','👛','👜','👝','🎒','💼','👞','👟','👠','👡','👢','👑','🎩','🧢','💄','💍','💎','📱','💻','⌚','📷','🔈','🔔','📖','✂️','🔑','🛒','💡','🔦','🧴','🪥'] },
    { cat: 'symbols', label: '❤️', items: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️','☯️','🕉️','✡️','🔯','☦️','🛐','♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓','🆔','⚕️','♻️','⚜️','🔰','🔱','❌','✅','💯','🔥','⭐','🌟'] },
    { cat: 'flags', label: '🚩', items: ['🏳️','🏴','🏁','🚩','🎌','🏴‍☠️','🇮🇩','🇲🇾','🇸🇬','🇵🇭','🇻🇳','🇹🇭','🇯🇵','🇰🇷','🇨🇳','🇮🇳','🇺🇸','🇬🇧','🇫🇷','🇩🇪','🇮🇹','🇪🇸','🇵🇹','🇳🇱','🇧🇪','🇨🇭','🇸🇪','🇳🇴','🇩🇰','🇫🇮','🇷🇺','🇧🇷','🇲🇽','🇦🇷','🇨🇱','🇦🇺'] }
  ];

  var picker = document.getElementById('emoji-picker');
  var catsEl = document.getElementById('emoji-cats');
  var gridEl = document.getElementById('emoji-grid');
  var smileyIcon = document.getElementById('btn-emoji');
  var inputText = document.getElementById('chat-input-text');
  var activeCat = 'smileys';

  function renderCategories() {
    var html = '';
    for (var i = 0; i < EMOJI_DATA.length; i++) {
      var c = EMOJI_DATA[i];
      var active = c.cat === activeCat ? ' emoji-picker__cat--active' : '';
      html += '<button class="emoji-picker__cat' + active + '" data-cat="' + c.cat + '">' + c.label + '</button>';
    }
    catsEl.innerHTML = html;

    var btns = catsEl.querySelectorAll('.emoji-picker__cat');
    for (var j = 0; j < btns.length; j++) {
      (function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          activeCat = btn.getAttribute('data-cat');
          renderCategories();
          renderGrid();
        });
      })(btns[j]);
    }
  }

  function renderGrid() {
    var data = null;
    for (var i = 0; i < EMOJI_DATA.length; i++) {
      if (EMOJI_DATA[i].cat === activeCat) { data = EMOJI_DATA[i]; break; }
    }
    if (!data) return;

    var html = '';
    for (var j = 0; j < data.items.length; j++) {
      html += '<button class="emoji-picker__item" data-emoji="' + data.items[j] + '">' + data.items[j] + '</button>';
    }
    gridEl.innerHTML = html;

    var items = gridEl.querySelectorAll('.emoji-picker__item');
    for (var k = 0; k < items.length; k++) {
      (function (item) {
        item.addEventListener('click', function (e) {
          e.stopPropagation();
          var emoji = item.getAttribute('data-emoji');
          insertEmoji(emoji);
        });
      })(items[k]);
    }
  }

  function insertEmoji(emoji) {
    if (!inputText) return;
    var cursor = inputText.selectionStart;
    var val = inputText.value;
    inputText.value = val.slice(0, cursor) + emoji + val.slice(cursor);
    var newPos = cursor + emoji.length;
    inputText.setSelectionRange(newPos, newPos);
    inputText.focus();
  }

  function togglePicker() {
    if (!picker) return;
    var isOpen = picker.classList.contains('emoji-picker--open');
    if (isOpen) {
      picker.classList.remove('emoji-picker--open');
    } else {
      picker.classList.add('emoji-picker--open');
    }
  }

  function closePicker() {
    if (picker) picker.classList.remove('emoji-picker--open');
  }

  document.addEventListener('click', function (e) {
    if (!picker || !smileyIcon) return;
    var target = e.target;
    if (!picker.contains(target) && !smileyIcon.contains(target)) {
      closePicker();
    }
  });

  if (picker && catsEl && gridEl && smileyIcon) {
    renderCategories();
    renderGrid();
    smileyIcon.addEventListener('click', function (e) {
      e.stopPropagation();
      togglePicker();
    });
  }
})();
