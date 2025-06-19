export function getWebviewContent(content: string): string {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DevFlow AI Review</title>
    <style>
      body {
        font-family: sans-serif;
        padding: 1rem;
        background: #0d1117;
        color: #c9d1d9;
      }
      pre {
        background: #161b22;
        padding: 1rem;
        border-radius: 8px;
        overflow-x: auto;
      }
      #chat {
        margin-top: 2rem;
        background: #161b22;
        border-radius: 8px;
        padding: 1rem;
      }
      #messages {
        min-height: 120px;
        max-height: 200px;
        overflow-y: auto;
        margin-bottom: 1rem;
      }
      .msg {
        margin-bottom: 0.5rem;
      }
      .msg.user { color: #58a6ff; }
      .msg.ai { color: #a5d6ff; }
      #inputRow {
        display: flex;
        gap: 0.5rem;
      }
      #chatInput {
        flex: 1;
        padding: 0.5rem;
        border-radius: 4px;
        border: none;
        background: #0d1117;
        color: #c9d1d9;
      }
      #sendBtn, #helpBtn, #clearBtn {
        padding: 0.5rem 1rem;
        border-radius: 4px;
        border: none;
        background: #238636;
        color: #fff;
        cursor: pointer;
        margin-left: 0.25rem;
      }
      #sendBtn:disabled, #helpBtn:disabled, #clearBtn:disabled {
        background: #444c56;
        cursor: not-allowed;
      }
      #loading {
        display: none;
        color: #ffb347;
        margin-left: 0.5rem;
      }
      #loading.active {
        display: inline;
      }
    </style>
  </head>
  <body>
    <h2>DevFlow AI Summary</h2>
    <div>${content}</div>
    <div id="chat">
      <div id="messages"></div>
      <div id="inputRow">
        <input id="chatInput" type="text" placeholder="Type a git command or question..." autofocus />
        <button id="sendBtn">Send</button>
        <button id="helpBtn" title="Show help">/help</button>
        <button id="clearBtn" title="Clear chat">Clear</button>
        <span id="loading">⏳</span>
      </div>
    </div>
    <script>
      // VS Code API
      const vscode = acquireVsCodeApi();
      const messagesDiv = document.getElementById('messages');
      const input = document.getElementById('chatInput');
      const sendBtn = document.getElementById('sendBtn');
      const helpBtn = document.getElementById('helpBtn');
      const clearBtn = document.getElementById('clearBtn');
      const loading = document.getElementById('loading');

      // Add a message to the chat area
      function addMessage(sender, text) {
        const div = document.createElement('div');
        div.className = 'msg ' + sender;
        div.textContent = (sender === 'user' ? 'You: ' : 'AI: ') + text;
        messagesDiv.appendChild(div);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
      }

      // Send chat input to extension
      function sendChat(text) {
        addMessage('user', text);
        vscode.postMessage({ type: 'chat', text });
        input.value = '';
        sendBtn.disabled = true;
        helpBtn.disabled = true;
        loading.classList.add('active');
      }

      // Handle send button
      sendBtn.onclick = () => {
        const value = input.value.trim();
        if (!value) return;
        sendChat(value);
        input.focus();
      };
      // Handle enter key
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') sendBtn.onclick();
      });
      // Handle /help button
      helpBtn.onclick = () => {
        sendChat('/help');
        input.focus();
      };
      // Handle clear button
      clearBtn.onclick = () => {
        messagesDiv.innerHTML = '';
        input.focus();
      };
      // Listen for responses from extension
      window.addEventListener('message', event => {
        const msg = event.data;
        if (msg.type === 'chatResponse') {
          addMessage('ai', msg.text);
          sendBtn.disabled = false;
          helpBtn.disabled = false;
          loading.classList.remove('active');
          input.focus();
        }
      });
    </script>
  </body>
  </html>
  `;
}

export function getSidebarWebviewContent(): string {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DevFlow AI Chat</title>
    <style>
      body {
        font-family: system-ui, sans-serif;
        background: var(--vscode-sideBar-background, #1e1e1e);
        color: var(--vscode-sideBar-foreground, #d4d4d4);
        margin: 0;
        padding: 0;
      }
      #container {
        display: flex;
        flex-direction: column;
        height: 100vh;
        padding: 0.5rem;
      }
      #context {
        font-size: 0.95em;
        margin-bottom: 0.5rem;
        color: var(--vscode-descriptionForeground, #999);
      }
      #messages {
        flex: 1;
        overflow-y: auto;
        background: var(--vscode-editor-background, #181818);
        border-radius: 8px;
        padding: 0.5rem;
        margin-bottom: 0.5rem;
      }
      .msg {
        display: flex;
        align-items: flex-start;
        margin-bottom: 0.5rem;
      }
      .avatar {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        margin-right: 0.5rem;
        background: #222;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 1.1em;
      }
      .avatar.user { background: #58a6ff; color: #fff; }
      .avatar.ai { background: #a5d6ff; color: #222; }
      .bubble {
        background: var(--vscode-input-background, #222);
        color: var(--vscode-input-foreground, #fff);
        border-radius: 8px;
        padding: 0.5rem 0.75rem;
        max-width: 80%;
        word-break: break-word;
        box-shadow: 0 1px 2px #0002;
        position: relative;
      }
      .bubble pre {
        background: #181818;
        color: #d4d4d4;
        border-radius: 6px;
        padding: 0.5em;
        margin: 0.5em 0 0 0;
        font-size: 0.95em;
        overflow-x: auto;
        position: relative;
      }
      .copy-btn {
        position: absolute;
        top: 0.25em;
        right: 0.25em;
        background: #444a;
        color: #fff;
        border: none;
        border-radius: 4px;
        font-size: 0.8em;
        cursor: pointer;
        padding: 0.1em 0.5em;
        display: none;
      }
      .bubble pre:hover .copy-btn {
        display: inline-block;
      }
      #inputRow {
        display: flex;
        gap: 0.5rem;
        margin-top: 0.25rem;
      }
      #chatInput {
        flex: 1;
        padding: 0.5rem;
        border-radius: 4px;
        border: none;
        background: var(--vscode-input-background, #222);
        color: var(--vscode-input-foreground, #fff);
      }
      #sendBtn, #helpBtn, #clearBtn {
        padding: 0.5rem 1rem;
        border-radius: 4px;
        border: none;
        background: #238636;
        color: #fff;
        cursor: pointer;
        margin-left: 0.25rem;
      }
      #sendBtn:disabled, #helpBtn:disabled, #clearBtn:disabled {
        background: #444c56;
        cursor: not-allowed;
      }
      #loading {
        display: none;
        color: #ffb347;
        margin-left: 0.5rem;
      }
      #loading.active {
        display: inline;
      }
    </style>
  </head>
  <body>
    <div id="container">
      <div id="context">Loading repo context...</div>
      <div id="messages"></div>
      <div id="inputRow">
        <input id="chatInput" type="text" placeholder="Type a git command or question..." autofocus />
        <button id="sendBtn">Send</button>
        <button id="helpBtn" title="Show help">/help</button>
        <button id="clearBtn" title="Clear chat">Clear</button>
        <span id="loading">⏳</span>
      </div>
    </div>
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <script>
      const vscode = acquireVsCodeApi();
      const messagesDiv = document.getElementById('messages');
      const input = document.getElementById('chatInput');
      const sendBtn = document.getElementById('sendBtn');
      const helpBtn = document.getElementById('helpBtn');
      const clearBtn = document.getElementById('clearBtn');
      const loading = document.getElementById('loading');
      const contextDiv = document.getElementById('context');
      let history = [];
      function renderMessages() {
        messagesDiv.innerHTML = '';
        for (const msg of history) {
          const div = document.createElement('div');
          div.className = 'msg';
          const avatar = document.createElement('div');
          avatar.className = 'avatar ' + msg.sender;
          avatar.textContent = msg.sender === 'user' ? 'U' : 'AI';
          const bubble = document.createElement('div');
          bubble.className = 'bubble';
          if (msg.markdown) {
            bubble.innerHTML = marked.parse(msg.text);
            // Add copy button to code blocks
            bubble.querySelectorAll('pre code').forEach((block) => {
              const btn = document.createElement('button');
              btn.className = 'copy-btn';
              btn.textContent = 'Copy';
              btn.onclick = (e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(block.textContent);
              };
              block.parentElement.insertBefore(btn, block);
            });
          } else {
            bubble.textContent = msg.text;
          }
          div.appendChild(avatar);
          div.appendChild(bubble);
          messagesDiv.appendChild(div);
        }
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
      }
      function addMessage(sender, text, markdown = true) {
        history.push({ sender, text, markdown });
        renderMessages();
        sessionStorage.setItem('devflow-history', JSON.stringify(history));
      }
      function sendChat(text) {
        addMessage('user', text, false);
        vscode.postMessage({ type: 'chat', text });
        input.value = '';
        sendBtn.disabled = true;
        helpBtn.disabled = true;
        loading.classList.add('active');
      }
      sendBtn.onclick = () => {
        const value = input.value.trim();
        if (!value) return;
        sendChat(value);
        input.focus();
      };
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') sendBtn.onclick();
      });
      helpBtn.onclick = () => {
        sendChat('/help');
        input.focus();
      };
      clearBtn.onclick = () => {
        history = [];
        renderMessages();
        sessionStorage.removeItem('devflow-history');
        input.focus();
      };
      window.addEventListener('message', event => {
        const msg = event.data;
        if (msg.type === 'chatResponse') {
          addMessage('ai', msg.text, true);
          sendBtn.disabled = false;
          helpBtn.disabled = false;
          loading.classList.remove('active');
          input.focus();
        } else if (msg.type === 'context') {
          if (msg.repo) {
            contextDiv.textContent = 'Repo: ' + msg.repo + ' | Branch: ' + msg.branch + ' | Last: ' + msg.lastCommit + ' (' + msg.author + ')';
          } else {
            contextDiv.textContent = 'No git repository detected.';
          }
        }
      });
      // Load history from session
      try {
        history = JSON.parse(sessionStorage.getItem('devflow-history') || '[]');
        renderMessages();
      } catch {}
      // Request context on load
      vscode.postMessage({ type: 'getContext' });
      input.focus();
    </script>
  </body>
  </html>
  `;
}
