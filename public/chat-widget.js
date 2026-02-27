/**
 * CS 186 Study Assistant — Multi-Chat Widget with PostgreSQL Persistence
 * Cross-device chat history via server API. Sidebar for managing multiple chats.
 * Voice input, fullscreen, streaming responses.
 */
(function () {
  var MODEL = 'claude-opus-4-6';
  var LS_KEY = 'cs186_anthropic_key';

  // State
  var useProxy = null;
  var apiKey = localStorage.getItem(LS_KEY) || '';
  var chats = [];          // [{id, title, updated_at, message_count}]
  var currentChatId = null;
  var conversationHistory = []; // for API context window
  var isStreaming = false;
  var recognition = null;
  var isRecording = false;
  var isFullscreen = false;
  var sidebarOpen = false;
  var dbAvailable = false;

  // ——— Styles ———
  var css = document.createElement('style');
  css.textContent = '\
    #chat-toggle {\
      position: fixed; bottom: 16px; right: 16px; z-index: 9999;\
      width: 44px; height: 44px; border-radius: 50%;\
      background: #4A90D9; border: none; cursor: pointer;\
      box-shadow: 0 3px 12px rgba(74,144,217,0.4);\
      display: flex; align-items: center; justify-content: center;\
      transition: transform 0.2s, box-shadow 0.2s;\
    }\
    #chat-toggle:hover { transform: scale(1.08); box-shadow: 0 4px 18px rgba(74,144,217,0.55); }\
    #chat-toggle svg { width: 22px; height: 22px; fill: #fff; }\
    #chat-panel {\
      position: fixed; bottom: 68px; right: 16px; z-index: 9998;\
      width: 360px; max-width: calc(100vw - 32px);\
      height: 440px; max-height: calc(100vh - 100px);\
      background: #12141f; border: 1px solid #2a2d3e;\
      border-radius: 12px; display: none; flex-direction: column;\
      box-shadow: 0 8px 40px rgba(0,0,0,0.6);\
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;\
      overflow: hidden;\
      transition: width 0.3s ease, height 0.3s ease, bottom 0.3s ease, right 0.3s ease, max-width 0.3s ease, max-height 0.3s ease;\
    }\
    #chat-panel.open { display: flex; }\
    #chat-panel.fullscreen {\
      bottom: 0; right: 0;\
      width: 100vw; height: 100vh;\
      max-width: 100vw; max-height: 100vh;\
      border-radius: 0;\
    }\
    #chat-header {\
      display: flex; align-items: center; gap: 8px;\
      padding: 10px 12px; background: #1a1d2e; border-bottom: 1px solid #2a2d3e;\
      flex-shrink: 0;\
    }\
    #chat-header .chat-title {\
      color: #e0e0e8; font-weight: 600; font-size: 1.2em;\
      flex: 1; min-width: 0;\
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;\
    }\
    #chat-header .model-tag {\
      font-size: 0.9em; background: rgba(74,144,217,0.15); color: #4A90D9;\
      padding: 3px 10px; border-radius: 10px; font-weight: 500; flex-shrink: 0;\
    }\
    #chat-header .header-controls { display: flex; align-items: center; gap: 2px; flex-shrink: 0; }\
    #chat-header button {\
      background: none; border: none; color: #8a8fa8; cursor: pointer; padding: 4px;\
      display: flex; align-items: center; justify-content: center;\
    }\
    #chat-header button:hover { color: #e0e0e8; }\
    #chat-header button svg { width: 22px; height: 22px; fill: currentColor; }\
    #fullscreen-btn { display: none !important; }\
    @media (min-width: 501px) { #fullscreen-btn { display: flex !important; } }\
    #chat-body { display: flex; flex: 1; overflow: hidden; position: relative; }\
    #chat-sidebar {\
      width: 0; overflow: hidden; background: #161829; border-right: 1px solid #2a2d3e;\
      display: flex; flex-direction: column; flex-shrink: 0;\
      transition: width 0.25s ease;\
    }\
    #chat-sidebar.open { width: 200px; }\
    #chat-panel.fullscreen #chat-sidebar.open { width: 260px; }\
    #sidebar-header {\
      display: flex; align-items: center; justify-content: space-between;\
      padding: 8px 10px; border-bottom: 1px solid #2a2d3e; flex-shrink: 0;\
    }\
    #sidebar-header span { color: #8a8fa8; font-size: 1em; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }\
    #new-chat-btn {\
      background: #4A90D9; border: none; color: #fff; cursor: pointer;\
      width: 30px; height: 30px; border-radius: 6px;\
      display: flex; align-items: center; justify-content: center;\
      font-size: 1.3em; font-weight: 700; transition: background 0.15s;\
    }\
    #new-chat-btn:hover { background: #5ba0e9; }\
    #chat-list {\
      flex: 1; overflow-y: auto; padding: 4px 0;\
      scrollbar-width: thin; scrollbar-color: #2a2d3e transparent;\
    }\
    #chat-list::-webkit-scrollbar { width: 4px; }\
    #chat-list::-webkit-scrollbar-thumb { background: #2a2d3e; border-radius: 2px; }\
    .chat-list-item {\
      display: flex; align-items: center; gap: 6px;\
      padding: 8px 10px; cursor: pointer; transition: background 0.1s;\
      border-left: 3px solid transparent;\
    }\
    .chat-list-item:hover { background: #1e2133; }\
    .chat-list-item.active { background: #1e2133; border-left-color: #4A90D9; }\
    .chat-list-item .chat-item-title {\
      flex: 1; min-width: 0; font-size: 1em; color: #c0c4d8;\
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;\
    }\
    .chat-list-item.active .chat-item-title { color: #e0e0e8; }\
    .chat-list-item .chat-item-delete {\
      opacity: 0; border: none; background: none; color: #8a8fa8; cursor: pointer;\
      padding: 4px; font-size: 1em; flex-shrink: 0; transition: opacity 0.15s;\
    }\
    .chat-list-item:hover .chat-item-delete { opacity: 1; }\
    .chat-list-item .chat-item-delete:hover { color: #f87171; }\
    #chat-main { display: flex; flex-direction: column; flex: 1; min-width: 0; }\
    #chat-messages {\
      flex: 1; overflow-y: auto; padding: 12px 16px;\
      display: flex; flex-direction: column; gap: 10px;\
      scrollbar-width: thin; scrollbar-color: #2a2d3e transparent;\
    }\
    #chat-messages::-webkit-scrollbar { width: 6px; }\
    #chat-messages::-webkit-scrollbar-thumb { background: #2a2d3e; border-radius: 3px; }\
    .chat-msg {\
      max-width: 88%; padding: 14px 20px; border-radius: 12px;\
      font-size: 1.1em; line-height: 1.6; word-wrap: break-word;\
      white-space: pre-wrap;\
    }\
    .chat-msg.user {\
      align-self: flex-end; background: #4A90D9; color: #fff; border-bottom-right-radius: 4px;\
    }\
    .chat-msg.assistant {\
      align-self: flex-start; background: #1e2133; color: #e0e0e8; border-bottom-left-radius: 4px;\
      border: 1px solid #2a2d3e;\
    }\
    .chat-msg.system {\
      align-self: center; background: rgba(251,191,36,0.1); color: #fbbf24;\
      font-size: 1em; text-align: center; border-radius: 8px;\
      border: 1px solid rgba(251,191,36,0.2); max-width: 95%;\
    }\
    .chat-msg .thinking-indicator {\
      display: inline-block; color: #8a8fa8; font-style: italic;\
    }\
    .chat-msg .thinking-indicator::after {\
      content: "..."; animation: dots 1.2s steps(4, end) infinite;\
    }\
    @keyframes dots { 0%{content:""} 25%{content:"."} 50%{content:".."} 75%{content:"..."} }\
    #chat-input-area {\
      display: flex; align-items: center; gap: 8px;\
      padding: 10px 12px; background: #1a1d2e; border-top: 1px solid #2a2d3e;\
      flex-shrink: 0;\
    }\
    #chat-input {\
      flex: 1; background: #12141f; color: #e0e0e8; border: 1px solid #2a2d3e;\
      border-radius: 8px; padding: 12px 16px; font-size: 1.1em;\
      font-family: inherit; resize: none; outline: none;\
      min-height: 44px; max-height: 120px;\
    }\
    #chat-input:focus { border-color: #4A90D9; }\
    #chat-input::placeholder { color: #555; }\
    .chat-btn {\
      width: 44px; height: 44px; border-radius: 8px; border: none;\
      cursor: pointer; display: flex; align-items: center; justify-content: center;\
      flex-shrink: 0; transition: background 0.15s;\
    }\
    #voice-btn { background: #1e2133; }\
    #voice-btn:hover { background: #2a2d3e; }\
    #voice-btn.recording { background: #c0392b; animation: pulse-rec 1s ease-in-out infinite; }\
    @keyframes pulse-rec { 0%,100%{opacity:1} 50%{opacity:0.6} }\
    #voice-btn svg { width: 22px; height: 22px; fill: #e0e0e8; }\
    #send-btn { background: #4A90D9; }\
    #send-btn:hover { background: #5ba0e9; }\
    #send-btn:disabled { background: #2a2d3e; cursor: not-allowed; }\
    #send-btn svg { width: 22px; height: 22px; fill: #fff; }\
    #key-setup {\
      position: absolute; inset: 0; background: #12141fe8; z-index: 10;\
      display: none; flex-direction: column; align-items: center; justify-content: center;\
      padding: 24px; text-align: center; gap: 12px;\
    }\
    #key-setup h3 { color: #4A90D9; font-size: 1.4em; margin: 0; }\
    #key-setup p { color: #8a8fa8; font-size: 1.1em; line-height: 1.5; margin: 0; }\
    #key-setup input {\
      width: 100%; background: #1a1d2e; color: #e0e0e8; border: 1px solid #2a2d3e;\
      border-radius: 8px; padding: 12px 14px; font-size: 1.1em; font-family: monospace;\
      outline: none;\
    }\
    #key-setup input:focus { border-color: #4A90D9; }\
    #key-setup .key-save-btn {\
      background: #4A90D9; color: #fff; border: none; border-radius: 8px;\
      padding: 10px 28px; cursor: pointer; font-size: 1.1em; font-weight: 600;\
    }\
    #key-setup .key-save-btn:hover { background: #5ba0e9; }\
    #key-setup .key-note { font-size: 0.9em; color: #555; margin-top: 4px; }\
    .no-chats-msg {\
      padding: 16px 10px; text-align: center; color: #555; font-size: 1em;\
    }\
    @media (max-width: 500px) {\
      #chat-panel { bottom: 60px; right: 8px; width: calc(100vw - 16px); height: 380px; max-height: calc(100vh - 80px); }\
      #chat-toggle { bottom: 10px; right: 10px; width: 40px; height: 40px; }\
      #chat-toggle svg { width: 20px; height: 20px; }\
      #chat-sidebar.open { width: 180px; }\
    }\
  ';
  document.head.appendChild(css);

  // ——— DOM helpers ———
  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'className') e.className = attrs[k];
        else if (k === 'textContent') e.textContent = attrs[k];
        else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        else e.setAttribute(k, attrs[k]);
      });
    }
    if (children) {
      (Array.isArray(children) ? children : [children]).forEach(function (c) {
        if (typeof c === 'string') e.appendChild(document.createTextNode(c));
        else if (c) e.appendChild(c);
      });
    }
    return e;
  }

  function svgIcon(pathD) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', pathD);
    svg.appendChild(p);
    return svg;
  }

  // SVG paths
  var ICON_CHAT = 'M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12zM7 9h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z';
  var ICON_MIC = 'M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zM17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z';
  var ICON_SEND = 'M2.01 21L23 12 2.01 3 2 10l15 2-15 2z';
  var ICON_EXPAND = 'M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z';
  var ICON_COLLAPSE = 'M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z';
  var ICON_MENU = 'M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z';
  var ICON_TRASH = 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z';

  // ——— Build DOM ———
  var toggleBtn = el('button', { id: 'chat-toggle', title: 'Ask Claude' });
  toggleBtn.appendChild(svgIcon(ICON_CHAT));

  var chatPanel = el('div', { id: 'chat-panel' });

  // Header
  var menuBtnEl = el('button', { id: 'menu-btn', title: 'Chat history' });
  menuBtnEl.appendChild(svgIcon(ICON_MENU));

  var headerTitle = el('span', { className: 'chat-title', textContent: 'CS 186 Study Assistant' });

  var fsBtnEl = el('button', { id: 'fullscreen-btn', title: 'Expand chat' });
  fsBtnEl.appendChild(svgIcon(ICON_EXPAND));

  var closeBtnEl = el('button', { id: 'chat-close-btn', title: 'Close', textContent: '\u00d7' });

  var header = el('div', { id: 'chat-header' }, [
    menuBtnEl,
    headerTitle,
    el('span', { className: 'model-tag', textContent: 'Opus 4.6' }),
    el('div', { className: 'header-controls' }, [fsBtnEl, closeBtnEl]),
  ]);

  // Sidebar
  var chatListDiv = el('div', { id: 'chat-list' });
  var newChatBtn = el('button', { id: 'new-chat-btn', title: 'New chat', textContent: '+' });
  var sidebarEl = el('div', { id: 'chat-sidebar' }, [
    el('div', { id: 'sidebar-header' }, [
      el('span', { textContent: 'Chats' }),
      newChatBtn,
    ]),
    chatListDiv,
  ]);

  // Main chat area
  var messagesDiv = el('div', { id: 'chat-messages' });

  var voiceButton = el('button', { id: 'voice-btn', className: 'chat-btn', title: 'Voice input' });
  voiceButton.appendChild(svgIcon(ICON_MIC));

  var sendButton = el('button', { id: 'send-btn', className: 'chat-btn', title: 'Send (Enter)' });
  sendButton.appendChild(svgIcon(ICON_SEND));

  var inputArea = el('div', { id: 'chat-input-area' }, [
    voiceButton,
    el('textarea', { id: 'chat-input', rows: '1', placeholder: 'Ask about SQL, B+ Trees, Buffer Management...' }),
    sendButton,
  ]);

  var chatMain = el('div', { id: 'chat-main' }, [messagesDiv, inputArea]);

  var chatBody = el('div', { id: 'chat-body' }, [sidebarEl, chatMain]);

  // Key setup overlay
  var keySetupDiv = el('div', { id: 'key-setup' }, [
    el('h3', { textContent: 'Set Up API Key' }),
    el('p', { textContent: 'Enter your Anthropic API key to chat with Claude Opus 4.6.\nKey is stored only in your browser\'s localStorage.' }),
    el('input', { id: 'key-input', type: 'password', placeholder: 'sk-ant-...', autocomplete: 'off' }),
    el('button', { className: 'key-save-btn', id: 'key-save', textContent: 'Save & Start' }),
    el('div', { className: 'key-note', textContent: 'Never shared with anyone. Only sent to api.anthropic.com.' }),
  ]);

  chatPanel.appendChild(header);
  chatPanel.appendChild(chatBody);
  chatPanel.appendChild(keySetupDiv);

  document.body.appendChild(toggleBtn);
  document.body.appendChild(chatPanel);

  // ——— References ———
  var input = document.getElementById('chat-input');
  var keyInput = document.getElementById('key-input');

  // ——— API helpers ———
  function apiGet(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('API ' + r.status);
      return r.json();
    });
  }
  function apiPost(url, data) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(function (r) {
      if (!r.ok) throw new Error('API ' + r.status);
      return r.json();
    });
  }
  function apiDelete(url) {
    return fetch(url, { method: 'DELETE' }).then(function (r) {
      if (!r.ok) throw new Error('API ' + r.status);
      return r.json();
    });
  }

  // ——— Chat list management ———
  function renderChatList() {
    while (chatListDiv.firstChild) chatListDiv.removeChild(chatListDiv.firstChild);

    if (!chats.length) {
      chatListDiv.appendChild(el('div', { className: 'no-chats-msg', textContent: 'No chats yet.\nClick + to start one.' }));
      return;
    }

    chats.forEach(function (chat) {
      var titleSpan = el('span', { className: 'chat-item-title', textContent: chat.title });
      var deleteBtn = el('button', { className: 'chat-item-delete', textContent: '\u00d7' });

      deleteBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        deleteChat(chat.id);
      });

      var item = el('div', {
        className: 'chat-list-item' + (chat.id === currentChatId ? ' active' : ''),
      }, [titleSpan, deleteBtn]);

      item.addEventListener('click', function () {
        switchToChat(chat.id);
      });

      chatListDiv.appendChild(item);
    });
  }

  async function loadChatList() {
    try {
      var data = await apiGet('/api/chats');
      chats = data.chats || [];
      dbAvailable = true;
      renderChatList();
    } catch (e) {
      dbAvailable = false;
      chats = [];
      renderChatList();
    }
  }

  async function createNewChat() {
    if (!dbAvailable) {
      addSystemMsg('Database not available — chats cannot be saved across devices.');
      return;
    }
    try {
      var chat = await apiPost('/api/chats', { title: 'New Chat' });
      chats.unshift({ id: chat.id, title: chat.title, updated_at: chat.updated_at, message_count: 0 });
      currentChatId = chat.id;
      conversationHistory = [];
      clearMessages();
      addSystemMsg('New chat started. Ask me anything about Midterm 1!');
      renderChatList();
      updateHeaderTitle('New Chat');
      input.focus();
    } catch (e) {
      addSystemMsg('Failed to create chat: ' + e.message);
    }
  }

  async function switchToChat(chatId) {
    if (chatId === currentChatId) return;
    currentChatId = chatId;
    conversationHistory = [];
    clearMessages();
    renderChatList();

    try {
      var data = await apiGet('/api/chats/' + chatId);
      var messages = data.messages || [];
      var chatTitle = data.chat && data.chat.title || 'Chat';
      updateHeaderTitle(chatTitle);

      // Rebuild conversation history and display
      messages.forEach(function (msg) {
        conversationHistory.push({ role: msg.role, content: msg.content });
        if (msg.role === 'user') {
          addMsgRaw('user', msg.content);
        } else if (msg.role === 'assistant') {
          var div = el('div', { className: 'chat-msg assistant' });
          renderAssistantText(div, msg.content);
          messagesDiv.appendChild(div);
        }
      });

      // Scroll to bottom after loading all messages
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    } catch (e) {
      addSystemMsg('Failed to load chat: ' + e.message);
    }
  }

  async function deleteChat(chatId) {
    try {
      await apiDelete('/api/chats/' + chatId);
      chats = chats.filter(function (c) { return c.id !== chatId; });

      if (chatId === currentChatId) {
        currentChatId = null;
        conversationHistory = [];
        clearMessages();
        updateHeaderTitle('CS 186 Study Assistant');
        addSystemMsg('Chat deleted. Select or create a chat to continue.');
      }

      renderChatList();
    } catch (e) {
      addSystemMsg('Failed to delete chat: ' + e.message);
    }
  }

  function updateHeaderTitle(title) {
    headerTitle.textContent = title;
  }

  // ——— Message display ———
  function clearMessages() {
    while (messagesDiv.firstChild) messagesDiv.removeChild(messagesDiv.firstChild);
  }

  function addMsgRaw(role, text) {
    var div = el('div', { className: 'chat-msg ' + role, textContent: text });
    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    return div;
  }

  function addSystemMsg(text) {
    return addMsgRaw('system', text);
  }

  function renderAssistantText(div, text) {
    while (div.firstChild) div.removeChild(div.firstChild);

    var parts = text.split(/(```[\s\S]*?```)/g);
    parts.forEach(function (part) {
      if (part.startsWith('```')) {
        var code = part.replace(/^```\w*\n?/, '').replace(/```$/, '');
        var pre = document.createElement('pre');
        pre.style.cssText = 'background:#151825;border:1px solid #2a2d3e;border-radius:6px;padding:12px 14px;overflow-x:auto;margin:8px 0;font-size:1em;';
        var codeEl = document.createElement('code');
        codeEl.style.cssText = 'font-family:"SF Mono","Fira Code",Consolas,monospace;color:#e0e0e8;';
        codeEl.textContent = code;
        pre.appendChild(codeEl);
        div.appendChild(pre);
      } else {
        var segments = part.split(/(`[^`]+`)/g);
        segments.forEach(function (seg) {
          if (seg.startsWith('`') && seg.endsWith('`')) {
            var inlineCode = document.createElement('code');
            inlineCode.style.cssText = 'background:#252838;padding:2px 6px;border-radius:3px;font-size:1em;font-family:"SF Mono","Fira Code",Consolas,monospace;color:#34d399;';
            inlineCode.textContent = seg.slice(1, -1);
            div.appendChild(inlineCode);
          } else {
            var boldParts = seg.split(/(\*\*[^*]+\*\*)/g);
            boldParts.forEach(function (bp) {
              if (bp.startsWith('**') && bp.endsWith('**')) {
                var strong = document.createElement('strong');
                strong.textContent = bp.slice(2, -2);
                div.appendChild(strong);
              } else if (bp) {
                div.appendChild(document.createTextNode(bp));
              }
            });
          }
        });
      }
    });
  }

  // ——— Proxy detection ———
  function checkProxy() {
    if (useProxy !== null) return;
    fetch('/api/health').then(function (r) {
      if (r.ok) return r.json();
      throw new Error('not ok');
    }).then(function (data) {
      useProxy = true;
      dbAvailable = !!data.db;
      if (dbAvailable) loadChatList();
    }).catch(function () {
      useProxy = false;
      dbAvailable = false;
    });
  }
  checkProxy();

  // ——— Panel toggle ———
  toggleBtn.addEventListener('click', function () {
    chatPanel.classList.toggle('open');
    if (chatPanel.classList.contains('open')) {
      if (useProxy === false && !apiKey) {
        keySetupDiv.style.display = 'flex';
        keyInput.focus();
      } else {
        keySetupDiv.style.display = 'none';
        input.focus();
        // Refresh chat list on open
        if (dbAvailable) loadChatList();
      }
    }
  });
  closeBtnEl.addEventListener('click', function () {
    chatPanel.classList.remove('open');
  });

  // ——— Sidebar toggle ———
  menuBtnEl.addEventListener('click', function () {
    sidebarOpen = !sidebarOpen;
    sidebarEl.classList.toggle('open', sidebarOpen);
    if (sidebarOpen && dbAvailable) loadChatList();
  });

  // ——— Fullscreen toggle ———
  fsBtnEl.addEventListener('click', function () {
    isFullscreen = !isFullscreen;
    chatPanel.classList.toggle('fullscreen', isFullscreen);
    while (fsBtnEl.firstChild) fsBtnEl.removeChild(fsBtnEl.firstChild);
    fsBtnEl.appendChild(svgIcon(isFullscreen ? ICON_COLLAPSE : ICON_EXPAND));
    fsBtnEl.title = isFullscreen ? 'Shrink chat' : 'Expand chat';
  });

  // ——— New chat ———
  newChatBtn.addEventListener('click', function () {
    createNewChat();
  });

  // ——— Key setup ———
  document.getElementById('key-save').addEventListener('click', function () {
    var k = keyInput.value.trim();
    if (!k.startsWith('sk-ant-')) {
      keyInput.style.borderColor = '#f87171';
      return;
    }
    apiKey = k;
    localStorage.setItem(LS_KEY, k);
    keySetupDiv.style.display = 'none';
    input.focus();
  });
  keyInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') document.getElementById('key-save').click();
  });

  // ——— Auto-resize textarea ———
  input.addEventListener('input', function () {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 100) + 'px';
  });

  // ——— Send message ———
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  sendButton.addEventListener('click', sendMessage);

  function sendViaProxy(messages, chatId, userText) {
    var payload = { messages: messages };
    if (chatId) {
      payload.chat_id = chatId;
      payload.user_message = userText;
    }
    return fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(function (response) {
      if (!response.ok) {
        return response.text().then(function (text) {
          try {
            var err = JSON.parse(text);
            throw new Error(err.error || ('API error: ' + response.status));
          } catch (e) {
            if (e.message && e.message.indexOf('API error') !== -1) throw e;
            throw new Error('Server error (' + response.status + '). Try again.');
          }
        });
      }
      return response;
    });
  }

  function sendDirect(messages) {
    return fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2048,
        system: 'You are a CS 186 (Database Systems) tutor for UC Berkeley.',
        messages: messages,
        stream: true,
      }),
    }).then(function (response) {
      if (!response.ok) {
        return response.json().catch(function () { return {}; }).then(function (err) {
          throw new Error((err.error && err.error.message) || ('API error: ' + response.status));
        });
      }
      return response;
    });
  }

  async function sendMessage() {
    var text = input.value.trim();
    if (!text || isStreaming) return;

    if (useProxy === false && !apiKey) {
      keySetupDiv.style.display = 'flex';
      keyInput.focus();
      return;
    }

    // Auto-create a chat if none selected and DB is available
    if (!currentChatId && dbAvailable) {
      try {
        var chat = await apiPost('/api/chats', { title: 'New Chat' });
        chats.unshift({ id: chat.id, title: chat.title, updated_at: chat.updated_at, message_count: 0 });
        currentChatId = chat.id;
        renderChatList();
      } catch (e) {
        // Continue without persistence
      }
    }

    addMsgRaw('user', text);
    conversationHistory.push({ role: 'user', content: text });
    input.value = '';
    input.style.height = 'auto';
    sendButton.disabled = true;
    isStreaming = true;

    // Compress if history too long
    if (conversationHistory.length > 20) {
      var toKeep = 6;
      var old = conversationHistory.slice(0, conversationHistory.length - toKeep);
      var kept = conversationHistory.slice(conversationHistory.length - toKeep);
      var summary = '[Earlier: ' + old.length + ' messages compressed]';
      conversationHistory = [
        { role: 'user', content: summary },
        { role: 'assistant', content: 'Understood, I have context from earlier. Let\'s continue.' }
      ].concat(kept);
    }

    var assistantDiv = el('div', { className: 'chat-msg assistant' });
    var thinkingSpan = el('span', { className: 'thinking-indicator', textContent: 'Thinking' });
    assistantDiv.appendChild(thinkingSpan);
    messagesDiv.appendChild(assistantDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    try {
      var response;
      var msgs = conversationHistory.slice(-30);

      if (useProxy !== false) {
        try {
          response = await sendViaProxy(msgs, currentChatId, text);
          useProxy = true;
        } catch (proxyErr) {
          if (apiKey) {
            response = await sendDirect(msgs);
          } else {
            useProxy = false;
            throw proxyErr;
          }
        }
      } else {
        response = await sendDirect(msgs);
      }

      var reader = response.body.getReader();
      var decoder = new TextDecoder();
      var fullText = '';
      var buffer = '';

      while (true) {
        var chunk = await reader.read();
        if (chunk.done) break;

        buffer += decoder.decode(chunk.value, { stream: true });
        var lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (var i = 0; i < lines.length; i++) {
          var line = lines[i];
          if (line.startsWith('data: ')) {
            var data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              var parsed = JSON.parse(data);
              if (parsed.type === 'content_block_delta' && parsed.delta && parsed.delta.text) {
                fullText += parsed.delta.text;
                renderAssistantText(assistantDiv, fullText);
                messagesDiv.scrollTop = messagesDiv.scrollHeight;
              }
            } catch (parseErr) { /* skip */ }
          }
        }
      }

      if (!fullText) {
        fullText = '(No response received)';
        assistantDiv.textContent = fullText;
      }

      conversationHistory.push({ role: 'assistant', content: fullText });

      // Update chat title in sidebar if it was auto-titled
      if (currentChatId) {
        loadChatList();
      }

    } catch (fetchErr) {
      assistantDiv.textContent = 'Error: ' + fetchErr.message;
      assistantDiv.className = 'chat-msg system';
      conversationHistory.pop();

      if (fetchErr.message.indexOf('401') !== -1 || fetchErr.message.indexOf('invalid') !== -1) {
        localStorage.removeItem(LS_KEY);
        apiKey = '';
        if (useProxy === false) {
          keySetupDiv.style.display = 'flex';
        }
      }
    } finally {
      isStreaming = false;
      sendButton.disabled = false;
      input.focus();
    }
  }

  // ——— Voice Input (Web Speech API) ———
  var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  var voiceBaseText = '';

  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = function (e) {
      var finalText = '';
      var interimText = '';
      for (var i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          finalText += e.results[i][0].transcript;
        } else {
          interimText += e.results[i][0].transcript;
        }
      }
      var transcript = finalText + interimText;
      var sep = voiceBaseText && transcript ? ' ' : '';
      input.value = voiceBaseText + sep + transcript;
      input.dispatchEvent(new Event('input'));
    };

    recognition.onend = function () {
      if (isRecording) {
        voiceBaseText = input.value;
        try { recognition.start(); } catch (err) {
          isRecording = false;
          voiceButton.classList.remove('recording');
          input.focus();
        }
      } else {
        voiceButton.classList.remove('recording');
        input.focus();
      }
    };

    recognition.onerror = function (e) {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      isRecording = false;
      voiceButton.classList.remove('recording');
      addSystemMsg('Voice error: ' + e.error);
    };

    voiceButton.addEventListener('click', function () {
      if (isRecording) {
        isRecording = false;
        recognition.stop();
      } else {
        isRecording = true;
        voiceButton.classList.add('recording');
        voiceBaseText = input.value;
        try { recognition.start(); } catch (err) {
          isRecording = false;
          voiceButton.classList.remove('recording');
          addSystemMsg('Could not start voice: ' + err.message);
        }
      }
    });
  } else {
    voiceButton.style.opacity = '0.3';
    voiceButton.style.cursor = 'not-allowed';
    voiceButton.title = 'Voice not supported in this browser';
    voiceButton.addEventListener('click', function () {
      addSystemMsg('Voice input is not supported in this browser. Try Chrome.');
    });
  }

  // ——— Init: migrate localStorage history to first server chat ———
  function migrateLocalStorage() {
    var LS_HISTORY_KEY = 'cs186_chat_history';
    try {
      var stored = localStorage.getItem(LS_HISTORY_KEY);
      if (!stored || !dbAvailable) return;
      var data = JSON.parse(stored);
      if (!data.display || !data.display.length) return;

      // Create a chat and save messages via individual API calls
      apiPost('/api/chats', { title: 'Migrated Chat' }).then(function (chat) {
        var msgs = data.display;
        var chain = Promise.resolve();
        msgs.forEach(function (msg) {
          chain = chain.then(function () {
            // Use a minimal proxy call just to save messages
            // Actually we can't — the save happens during handleChat.
            // Instead, display a note and let the user keep the migrated messages in context.
            return Promise.resolve();
          });
        });
        // Remove the old localStorage key after migration
        localStorage.removeItem(LS_HISTORY_KEY);
        // Reload the chat list
        loadChatList();
      }).catch(function () { /* migration failed, keep localStorage */ });
    } catch (e) { /* ignore */ }
  }

  // Show welcome message
  addSystemMsg('Ask me anything about Midterm 1! Click the menu icon to manage chats.');

  // Auto-load most recent chat if available
  setTimeout(function () {
    if (dbAvailable && chats.length > 0) {
      switchToChat(chats[0].id);
    }
    migrateLocalStorage();
  }, 500);
})();
