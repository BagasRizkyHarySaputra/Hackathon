/**
 * SkinGlow — ChatBot Page Logic
 *
 * Features:
 *   - New Chat button → creates a new chat session
 *   - History click → switch active chat
 *   - History double-click → rename chat
 *   - Send message → auto-reply "Meehh…"
 *   - localStorage persistence with db-sementara seed fallback
 */
(function () {
  'use strict';

  var LS_LIST_KEY = 'skinglow_chatbot_list';
  var LS_ACTIVE_KEY = 'skinglow_chatbot_active';

  var historyList = document.getElementById('history-list');
  var chatMessages = document.getElementById('chat-messages');
  var inputText = document.getElementById('chat-input-text');
  var btnSend = document.getElementById('btn-send');
  var btnNewChat = document.getElementById('btn-new-chat');

  var engine = null;
  var chats = [];
  var activeChatId = null;

  /* ─── Load chat list from localStorage (with seed fallback) ─── */
  function loadChatList() {
    try {
      var raw = localStorage.getItem(LS_LIST_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }

    /* Seed from db-sementara */
    return loadSeed();
  }

  function loadSeed() {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/db-sementara/chatbot.json', false); // sync for init
    try {
      xhr.send();
      if (xhr.status === 200) {
        var data = JSON.parse(xhr.responseText);
        return (data.chats || []).map(function (c) {
          return { id: c.id, name: c.name, createdAt: c.createdAt };
        });
      }
    } catch (e) { /* offline — return empty */ }
    return [];
  }

  function saveChatList() {
    try {
      localStorage.setItem(LS_LIST_KEY, JSON.stringify(chats));
    } catch (e) { /* quota exceeded */ }
  }

  /* ─── Generate unique ID ─── */
  function uid() {
    return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  /* ─── Find chat by ID ─── */
  function findChat(id) {
    for (var i = 0; i < chats.length; i++) {
      if (chats[i].id === id) return chats[i];
    }
    return null;
  }

  /* ─── Render history list ─── */
  function renderHistory() {
    if (!historyList) return;
    var html = '';
    for (var i = 0; i < chats.length; i++) {
      var c = chats[i];
      var cls = c.id === activeChatId ? ' history-item active' : 'history-item';
      html += '<div class="' + cls + '" data-chat-id="' + c.id + '">' +
              '<span class="history-item__name">' + esc(c.name) + '</span>' +
              '</div>';
    }
    historyList.innerHTML = html;
    bindHistoryEvents();
  }

  function esc(str) {
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  /* ─── Bind history click / dblclick ─── */
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

          /* Replace span with input */
          var input = document.createElement('input');
          input.type = 'text';
          input.className = 'history-item__input';
          input.value = oldName;
          input.setAttribute('data-chat-id', id);

          nameSpan.replaceWith(input);
          input.focus();
          input.select();

          /* Save on Enter or blur */
          function finishRename() {
            var newName = input.value.trim() || oldName;
            chat.name = newName;
            saveChatList();
            renderHistory();
          }
          input.addEventListener('keydown', function (ev) {
            if (ev.key === 'Enter') { ev.preventDefault(); finishRename(); }
          });
          input.addEventListener('blur', finishRename);
        });
      })(items[i]);
    }
  }

  /* ─── Switch to a chat session ─── */
  function switchToChat(chatId) {
    if (activeChatId === chatId) return;
    activeChatId = chatId;
    localStorage.setItem(LS_ACTIVE_KEY, chatId);

    var chat = findChat(chatId);
    if (!chat) return;

    engine.switchChat('chatbot_' + chatId, chat.messages || []);
    renderHistory();
  }

  /* ─── Create new chat ─── */
  function createNewChat() {
    var id = uid();
    var chat = { id: id, name: 'Chat ' + (chats.length + 1), createdAt: new Date().toISOString() };
    chats.push(chat);
    saveChatList();
    switchToChat(id);
  }

  /* ─── Handle sending ─── */
  function handleSend() {
    var text = inputText.value.trim();
    if (!text) return;
    inputText.value = '';
    engine.send(text);
  }

  /* ─── Init ─── */
  function init() {
    if (!chatMessages || !inputText || !btnSend) {
      console.warn('ChatBot: required elements missing');
      return;
    }

    /* Load chat list */
    chats = loadChatList();

    /* Determine active chat */
    var stored = localStorage.getItem(LS_ACTIVE_KEY);
    if (stored && findChat(stored)) {
      activeChatId = stored;
    } else if (chats.length > 0) {
      activeChatId = chats[0].id;
    } else {
      /* No chats yet — create default */
      createNewChat();
      return;
    }

    /* Init engine */
    var chat = findChat(activeChatId);
    engine = new ChatEngine(chatMessages, {
      chatId: 'chatbot_' + activeChatId,
      seed: chat ? chat.messages : []
    });
    engine.render();
    renderHistory();

    /* Wire events */
    btnSend.addEventListener('click', handleSend);
    inputText.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); handleSend(); }
    });
    if (btnNewChat) {
      btnNewChat.addEventListener('click', createNewChat);
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
