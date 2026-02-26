/**
 * CS 186 Study Assistant — Claude Opus 4.6 Chat Widget with Voice Input
 * Self-contained widget that attaches to any page.
 * Uses /api/chat proxy when available (no API key needed).
 * Falls back to direct Anthropic API with localStorage key on static hosts.
 */
(function () {
  var MODEL = 'claude-opus-4-6';
  var SYSTEM_PROMPT = 'You are a CS 186 (Database Systems) study assistant for UC Berkeley Spring 2026 Midterm 1.\nYou ONLY answer questions about topics covered in Midterm 1:\n- SQL (SELECT, FROM, WHERE, GROUP BY, HAVING, ORDER BY, LIMIT, Joins, Subqueries, CTEs, Views)\n- Disks, Files & Records (HDD/SSD, pages, heap files, sorted files, slotted pages, record layout)\n- IO Cost Analysis (heap vs sorted file costs, B = pages, R = records/page)\n- B+ Trees (structure, search, insert with splits, delete, bulk loading, fan-out)\n- B+ Tree Advanced (clustered vs unclustered, composite indexes, prefix rule, IO costs)\n- Spatial Indexes (KD Trees, R-Trees, MBRs, nearest neighbor search)\n- Buffer Management (buffer pool, frames, dirty bit, pin count, LRU, MRU, Clock policy)\n\nNOT on this midterm: Sorting/Hashing, Relational Algebra, Join Algorithms, Query Optimization.\n\nBe concise but thorough. Use examples when helpful. For B+ tree operations, show the tree state step by step.\nIf asked about topics not on this midterm, say so and redirect to relevant topics.';

  var LS_KEY = 'cs186_anthropic_key';

  // Proxy detection: null = unknown, true = proxy works, false = fallback to direct API
  var useProxy = null;

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
      transition: all 0.3s ease;\
    }\
    #chat-panel.open { display: flex; }\
    #chat-panel.fullscreen {\
      bottom: 16px; right: 16px;\
      width: calc(100vw - 32px); height: calc(100vh - 32px);\
      max-width: calc(100vw - 32px); max-height: calc(100vh - 32px);\
      border-radius: 12px;\
    }\
    #chat-header {\
      display: flex; align-items: center; justify-content: space-between;\
      padding: 12px 16px; background: #1a1d2e; border-bottom: 1px solid #2a2d3e;\
      flex-shrink: 0;\
    }\
    #chat-header span { color: #4A90D9; font-weight: 700; font-size: 0.95em; }\
    #chat-header .model-tag {\
      font-size: 0.7em; background: rgba(74,144,217,0.15); color: #4A90D9;\
      padding: 2px 8px; border-radius: 10px; font-weight: 500;\
    }\
    #chat-header .header-controls { display: flex; align-items: center; gap: 4px; }\
    #chat-header button {\
      background: none; border: none; color: #8a8fa8; cursor: pointer; font-size: 1.2em; padding: 4px;\
    }\
    #chat-header button:hover { color: #e0e0e8; }\
    #fullscreen-btn { display: none; }\
    @media (min-width: 501px) { #fullscreen-btn { display: inline-flex; font-size: 1em; } }\
    #chat-messages {\
      flex: 1; overflow-y: auto; padding: 12px 16px;\
      display: flex; flex-direction: column; gap: 10px;\
      scrollbar-width: thin; scrollbar-color: #2a2d3e transparent;\
    }\
    #chat-messages::-webkit-scrollbar { width: 6px; }\
    #chat-messages::-webkit-scrollbar-thumb { background: #2a2d3e; border-radius: 3px; }\
    .chat-msg {\
      max-width: 88%; padding: 10px 14px; border-radius: 12px;\
      font-size: 0.88em; line-height: 1.55; word-wrap: break-word;\
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
      font-size: 0.82em; text-align: center; border-radius: 8px;\
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
      border-radius: 8px; padding: 8px 12px; font-size: 0.88em;\
      font-family: inherit; resize: none; outline: none;\
      min-height: 38px; max-height: 100px;\
    }\
    #chat-input:focus { border-color: #4A90D9; }\
    #chat-input::placeholder { color: #555; }\
    .chat-btn {\
      width: 36px; height: 36px; border-radius: 8px; border: none;\
      cursor: pointer; display: flex; align-items: center; justify-content: center;\
      flex-shrink: 0; transition: background 0.15s;\
    }\
    #voice-btn { background: #1e2133; }\
    #voice-btn:hover { background: #2a2d3e; }\
    #voice-btn.recording { background: #c0392b; animation: pulse-rec 1s ease-in-out infinite; }\
    @keyframes pulse-rec { 0%,100%{opacity:1} 50%{opacity:0.6} }\
    #voice-btn svg { width: 18px; height: 18px; fill: #e0e0e8; }\
    #send-btn { background: #4A90D9; }\
    #send-btn:hover { background: #5ba0e9; }\
    #send-btn:disabled { background: #2a2d3e; cursor: not-allowed; }\
    #send-btn svg { width: 18px; height: 18px; fill: #fff; }\
    #key-setup {\
      position: absolute; inset: 0; background: #12141fe8; z-index: 10;\
      display: none; flex-direction: column; align-items: center; justify-content: center;\
      padding: 24px; text-align: center; gap: 12px;\
    }\
    #key-setup h3 { color: #4A90D9; font-size: 1em; margin: 0; }\
    #key-setup p { color: #8a8fa8; font-size: 0.82em; line-height: 1.5; margin: 0; }\
    #key-setup input {\
      width: 100%; background: #1a1d2e; color: #e0e0e8; border: 1px solid #2a2d3e;\
      border-radius: 8px; padding: 10px 12px; font-size: 0.85em; font-family: monospace;\
      outline: none;\
    }\
    #key-setup input:focus { border-color: #4A90D9; }\
    #key-setup .key-save-btn {\
      background: #4A90D9; color: #fff; border: none; border-radius: 8px;\
      padding: 8px 24px; cursor: pointer; font-size: 0.88em; font-weight: 600;\
    }\
    #key-setup .key-save-btn:hover { background: #5ba0e9; }\
    #key-setup .key-note { font-size: 0.72em; color: #555; margin-top: 4px; }\
    @media (max-width: 500px) {\
      #chat-panel { bottom: 60px; right: 8px; width: calc(100vw - 16px); height: 380px; max-height: calc(100vh - 80px); }\
      #chat-toggle { bottom: 10px; right: 10px; width: 40px; height: 40px; }\
      #chat-toggle svg { width: 20px; height: 20px; }\
    }\
  ';
  document.head.appendChild(css);

  // ——— Build DOM safely ———
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
    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathD);
    svg.appendChild(path);
    return svg;
  }

  var toggleBtn = el('button', { id: 'chat-toggle', title: 'Ask Claude' });
  toggleBtn.appendChild(svgIcon('M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12zM7 9h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z'));

  var chatPanel = el('div', { id: 'chat-panel' });

  var header = el('div', { id: 'chat-header' }, [
    el('span', { textContent: 'CS 186 Study Assistant' }),
    el('span', { className: 'model-tag', textContent: 'Opus 4.6' }),
    el('div', { className: 'header-controls' }, [
      el('button', { id: 'fullscreen-btn', title: 'Toggle fullscreen' }),
      el('button', { id: 'chat-close', title: 'Close', textContent: '\u00d7' }),
    ]),
  ]);

  var messagesDiv = el('div', { id: 'chat-messages' }, [
    el('div', { className: 'chat-msg system', textContent: 'Ask me anything about Midterm 1 topics! Type or use the mic button for voice.' }),
  ]);

  var voiceButton = el('button', { id: 'voice-btn', className: 'chat-btn', title: 'Voice input' });
  voiceButton.appendChild(svgIcon('M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zM17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z'));

  var sendButton = el('button', { id: 'send-btn', className: 'chat-btn', title: 'Send (Enter)' });
  sendButton.appendChild(svgIcon('M2.01 21L23 12 2.01 3 2 10l15 2-15 2z'));

  var inputArea = el('div', { id: 'chat-input-area' }, [
    voiceButton,
    el('textarea', { id: 'chat-input', rows: '1', placeholder: 'Ask about SQL, B+ Trees, Buffer Management...' }),
    sendButton,
  ]);

  // Key setup overlay — hidden by default, only shown when proxy is unavailable AND no saved key
  var keySetupDiv = el('div', { id: 'key-setup' }, [
    el('h3', { textContent: 'Set Up API Key' }),
    el('p', { textContent: 'Enter your Anthropic API key to chat with Claude Opus 4.6.\nKey is stored only in your browser\'s localStorage.' }),
    el('input', { id: 'key-input', type: 'password', placeholder: 'sk-ant-...', autocomplete: 'off' }),
    el('button', { className: 'key-save-btn', id: 'key-save', textContent: 'Save & Start' }),
    el('div', { className: 'key-note', textContent: 'Never shared with anyone. Only sent to api.anthropic.com.' }),
  ]);

  chatPanel.appendChild(header);
  chatPanel.appendChild(messagesDiv);
  chatPanel.appendChild(inputArea);
  chatPanel.appendChild(keySetupDiv);

  document.body.appendChild(toggleBtn);
  document.body.appendChild(chatPanel);

  // ——— Fullscreen toggle ———
  var fsBtn = document.getElementById('fullscreen-btn');
  var isFullscreen = false;
  // Expand icon (arrows pointing outward)
  var expandIcon = svgIcon('M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z');
  // Collapse icon (arrows pointing inward)
  var collapseIcon = svgIcon('M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z');
  fsBtn.appendChild(expandIcon);

  fsBtn.addEventListener('click', function () {
    isFullscreen = !isFullscreen;
    chatPanel.classList.toggle('fullscreen', isFullscreen);
    while (fsBtn.firstChild) fsBtn.removeChild(fsBtn.firstChild);
    fsBtn.appendChild(isFullscreen ? collapseIcon : expandIcon);
    fsBtn.title = isFullscreen ? 'Exit fullscreen' : 'Toggle fullscreen';
  });

  // ——— References ———
  var input = document.getElementById('chat-input');
  var keyInput = document.getElementById('key-input');

  var apiKey = localStorage.getItem(LS_KEY) || '';
  var conversationHistory = [];
  var isStreaming = false;
  var recognition = null;
  var isRecording = false;

  // Conversation compression: when history exceeds this many messages, compress older ones
  var COMPRESS_THRESHOLD = 20; // messages (10 exchanges)
  var KEEP_RECENT = 6; // keep last 6 messages uncompressed

  // ——— Probe proxy availability ———
  function checkProxy() {
    if (useProxy !== null) return;
    fetch('/api/health').then(function (r) {
      useProxy = r.ok;
    }).catch(function () {
      useProxy = false;
    });
  }
  checkProxy();

  // ——— Toggle panel ———
  toggleBtn.addEventListener('click', function () {
    chatPanel.classList.toggle('open');
    if (chatPanel.classList.contains('open')) {
      // Only show key setup if proxy is definitely unavailable AND no key stored
      if (useProxy === false && !apiKey) {
        keySetupDiv.style.display = 'flex';
        keyInput.focus();
      } else {
        keySetupDiv.style.display = 'none';
        input.focus();
      }
    }
  });
  document.getElementById('chat-close').addEventListener('click', function () {
    chatPanel.classList.remove('open');
  });

  // ——— Key setup (fallback for static hosting) ———
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

  function addMessage(role, text) {
    var div = el('div', { className: 'chat-msg ' + role, textContent: text });
    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    return div;
  }

  function renderAssistantText(div, text) {
    while (div.firstChild) div.removeChild(div.firstChild);

    var parts = text.split(/(```[\s\S]*?```)/g);
    parts.forEach(function (part) {
      if (part.startsWith('```')) {
        var code = part.replace(/^```\w*\n?/, '').replace(/```$/, '');
        var pre = document.createElement('pre');
        pre.style.cssText = 'background:#151825;border:1px solid #2a2d3e;border-radius:6px;padding:8px 10px;overflow-x:auto;margin:6px 0;font-size:0.88em;';
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
            inlineCode.style.cssText = 'background:#252838;padding:1px 5px;border-radius:3px;font-size:0.92em;font-family:"SF Mono","Fira Code",Consolas,monospace;color:#34d399;';
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

  // Send via proxy (/api/chat) — no API key needed
  function sendViaProxy(messages) {
    return fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: messages }),
    }).then(function (response) {
      if (!response.ok) {
        return response.text().then(function (text) {
          try {
            var err = JSON.parse(text);
            throw new Error(err.error || ('API error: ' + response.status));
          } catch (e) {
            if (e.message && e.message.indexOf('API error') !== -1) throw e;
            throw new Error('Server error (' + response.status + '). Try again in a moment.');
          }
        });
      }
      return response;
    });
  }

  // Send via direct Anthropic API (fallback when proxy unavailable)
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
        system: SYSTEM_PROMPT,
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

  // Compress older conversation history into a summary
  function compressHistory() {
    if (conversationHistory.length <= COMPRESS_THRESHOLD) return;

    var toCompress = conversationHistory.slice(0, conversationHistory.length - KEEP_RECENT);
    var kept = conversationHistory.slice(conversationHistory.length - KEEP_RECENT);

    // Build a summary of the compressed messages
    var summaryParts = [];
    for (var i = 0; i < toCompress.length; i++) {
      var msg = toCompress[i];
      var prefix = msg.role === 'user' ? 'Student' : 'Tutor';
      var content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      // Truncate long messages in summary
      if (content.length > 200) content = content.substring(0, 200) + '...';
      summaryParts.push(prefix + ': ' + content);
    }

    var summaryText = '[Earlier conversation summary — ' + toCompress.length + ' messages compressed]\n' + summaryParts.join('\n');

    // Replace history with: compressed summary as first user message, then recent messages
    conversationHistory = [
      { role: 'user', content: summaryText },
      { role: 'assistant', content: 'Understood, I have the context from our earlier conversation. Let\'s continue.' }
    ].concat(kept);

    // Show compression notice in UI
    addMessage('system', 'Context compressed to save space. Recent conversation preserved.');
  }

  async function sendMessage() {
    var text = input.value.trim();
    if (!text || isStreaming) return;

    // Check if we can send
    if (useProxy === false && !apiKey) {
      keySetupDiv.style.display = 'flex';
      keyInput.focus();
      return;
    }

    addMessage('user', text);
    conversationHistory.push({ role: 'user', content: text });
    input.value = '';
    input.style.height = 'auto';
    sendButton.disabled = true;
    isStreaming = true;

    // Compress history if too long
    compressHistory();

    var assistantDiv = el('div', { className: 'chat-msg assistant' });
    var thinkingSpan = el('span', { className: 'thinking-indicator', textContent: 'Thinking' });
    assistantDiv.appendChild(thinkingSpan);
    messagesDiv.appendChild(assistantDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    try {
      var response;
      var msgs = conversationHistory.slice(-30);

      if (useProxy !== false) {
        // Try proxy first
        try {
          response = await sendViaProxy(msgs);
          useProxy = true;
        } catch (proxyErr) {
          // Proxy failed — fall back to direct API if we have a key
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

      // Stream the response
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
            } catch (parseErr) {
              // Skip unparseable chunks
            }
          }
        }
      }

      if (!fullText) {
        fullText = '(No response received)';
        assistantDiv.textContent = fullText;
      }

      conversationHistory.push({ role: 'assistant', content: fullText });

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
  // Voice transcribes to text field ONLY. User reviews/edits, then sends manually.
  // Continuous mode: records until user clicks stop. Multiple sessions append.
  var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  var voiceBaseText = ''; // text in input before current recording session

  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = function (e) {
      var transcript = '';
      for (var i = 0; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      var sep = voiceBaseText && transcript ? ' ' : '';
      input.value = voiceBaseText + sep + transcript;
      input.dispatchEvent(new Event('input'));
    };

    recognition.onend = function () {
      if (isRecording) {
        // Browser auto-stopped (timeout/silence) — restart to keep recording
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
      if (e.error === 'no-speech') return; // ignore, keep recording
      if (e.error === 'aborted') return; // ignore on intentional stop
      isRecording = false;
      voiceButton.classList.remove('recording');
      addMessage('system', 'Voice error: ' + e.error);
    };

    voiceButton.addEventListener('click', function () {
      if (isRecording) {
        isRecording = false;
        recognition.stop();
      } else {
        isRecording = true;
        voiceButton.classList.add('recording');
        voiceBaseText = input.value; // preserve existing text
        recognition.start();
      }
    });
  } else {
    voiceButton.style.opacity = '0.3';
    voiceButton.style.cursor = 'not-allowed';
    voiceButton.title = 'Voice not supported in this browser';
    voiceButton.addEventListener('click', function () {
      addMessage('system', 'Voice input is not supported in this browser. Try Chrome on desktop or Android.');
    });
  }
})();
