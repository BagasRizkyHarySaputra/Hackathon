/**
 * SkinGlow — Community Page Logic
 *
 * Features:
 *   - Channel switching (General / Skincare)
 *   - Topic switching (#Acne Fighter / #Review Skincare / #Skincare)
 *   - Per-topic chat history (persisted in localStorage)
 *   - Send message → auto-reply "Meehh…"
 */
(function () {
  'use strict';

  var LS_ACTIVE_KEY = 'skinglow_community_active';

  var chatMessages = document.getElementById('chat-messages');
  var inputText = document.getElementById('chat-input-text');
  var btnSend = document.getElementById('btn-send');
  var topicPanel = document.getElementById('topic-panel');
  var topicBurger = document.getElementById('topic-burger');
  var topicCollapsedHeader = document.getElementById('topic-collapsed-header');
  var topicCollapsedBurger = document.getElementById('topic-collapsed-burger');
  var channelSection = document.getElementById('channel-section');

  var engine = null;
  var activeChannel = 'general';
  var activeTopic = 'acne-fighter';

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

  /* ─── Build chat ID ─── */
  function buildChatId() {
    return 'community_' + activeChannel + '_' + activeTopic;
  }

  /* ─── Load seed from db-sementara ─── */
  function loadSeed() {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/db-sementara/community.json', false);
    try {
      xhr.send();
      if (xhr.status === 200) {
        var data = JSON.parse(xhr.responseText);
        var topicData = data[activeTopic];
        return (topicData && topicData.messages) || [];
      }
    } catch (e) { /* offline */ }
    return [];
  }

  /* ─── Switch topic ─── */
  function switchTopic(topic) {
    if (activeTopic === topic) return;
    activeTopic = topic;
    localStorage.setItem(LS_ACTIVE_KEY, JSON.stringify({ channel: activeChannel, topic: activeTopic }));

    var seed = loadSeed();
    engine.switchChat(buildChatId(), seed);
    highlightTopic();
  }

  /* ─── Switch channel ─── */
  function switchChannel(channel) {
    if (activeChannel === channel) return;
    activeChannel = channel;
    localStorage.setItem(LS_ACTIVE_KEY, JSON.stringify({ channel: activeChannel, topic: activeTopic }));

    var seed = loadSeed();
    engine.switchChat(buildChatId(), seed);
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
    /* Update collapsed header title with active topic name */
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

  /* ─── Auto-resize textarea (grow up to ~3 lines, then scroll) ─── */
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
    engine.send(text);
    inputText.style.height = 'auto';
  }

  /* ─── Init ─── */
  function init() {
    if (!chatMessages || !inputText || !btnSend) {
      console.warn('Community: required elements missing');
      return;
    }

    /* Restore active state */
    try {
      var stored = JSON.parse(localStorage.getItem(LS_ACTIVE_KEY));
      if (stored && stored.channel && stored.topic) {
        activeChannel = stored.channel;
        activeTopic = stored.topic;
      }
    } catch (e) { /* ignore */ }

    highlightTopic();
    highlightChannel();

    /* Init engine with seed */
    var seed = loadSeed();
    engine = new ChatEngine(chatMessages, {
      chatId: buildChatId(),
      seed: seed
    });
    engine.render();

    /* Build emoji picker */
    emojiPicker = buildEmojiPicker();
    var emojiIcons = document.querySelectorAll('.chat-input__actions .chat-input__icon');
    btnEmoji = emojiIcons.length > 0 ? emojiIcons[0] : null;
    if (btnEmoji) {
      btnEmoji.parentNode.appendChild(emojiPicker);
      btnEmoji.addEventListener('click', toggleEmojiPicker);
    }
    /* Close emoji picker on outside click */
    document.addEventListener('click', function (e) {
      if (emojiPicker && emojiPicker.classList.contains('emoji-picker--open') &&
          !emojiPicker.contains(e.target) && e.target !== btnEmoji) {
        closeEmojiPicker();
      }
    });

    /* Wire events */
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
  }

  /* ─── DOM ready ─── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
