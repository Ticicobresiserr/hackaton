(function () {
  const SHERPA_API = window.SHERPA_API || 'http://localhost:3001';
  const STORAGE_KEY = 'sherpa_widget_state';

  // Restore persisted state
  function loadState() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch { return {}; }
  }
  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        sessionId, userName, messages, progress, started, isOpen,
      }));
    } catch {}
  }

  const saved = loadState();
  const sessionId = saved.sessionId || 'session_' + Date.now();
  let userName = saved.userName || '';
  let messages = saved.messages || [];
  let streaming = false;
  let progress = saved.progress || null;
  let started = saved.started || false;
  let program = null;
  let published = false;
  let isOpen = saved.isOpen || false;
  let analyzing = false;

  // Fetch program on load
  fetch(SHERPA_API + '/api/program')
    .then(r => r.json())
    .then(data => {
      program = data.program;
      published = data.published;
      render();
    });

  // Connect to SSE for real-time updates (program ready, published, etc.)
  const es = new EventSource(SHERPA_API + '/api/events');
  es.addEventListener('program', (e) => {
    const data = JSON.parse(e.data);
    program = data.program;
    analyzing = false;
    render();
  });
  es.addEventListener('published', (e) => {
    const data = JSON.parse(e.data);
    program = data.program;
    published = true;
    render();
    // Auto-open widget when published — the "magic moment"
    if (!isOpen) {
      isOpen = true;
      panel.classList.add('open');
    }
  });
  es.addEventListener('status', (e) => {
    const data = JSON.parse(e.data);
    if (data.state === 'analyzing') {
      analyzing = true;
      render();
    }
  });

  // === STYLES ===
  const style = document.createElement('style');
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    #sherpa-widget-btn {
      position: fixed; bottom: 24px; right: 24px; z-index: 99999;
      width: 56px; height: 56px; border-radius: 16px;
      background: linear-gradient(135deg, #f97316, #ea580c);
      border: none; cursor: pointer;
      box-shadow: 0 8px 32px rgba(249,115,22,0.35);
      display: flex; align-items: center; justify-content: center;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    #sherpa-widget-btn:hover {
      transform: scale(1.08);
      box-shadow: 0 12px 40px rgba(249,115,22,0.5);
    }
    #sherpa-widget-btn.waiting {
      background: linear-gradient(135deg, #374151, #4b5563);
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    }
    #sherpa-widget-btn.pulse {
      animation: sherpa-btn-pulse 2s ease-in-out infinite;
    }
    @keyframes sherpa-btn-pulse {
      0%, 100% { box-shadow: 0 8px 32px rgba(249,115,22,0.35); }
      50% { box-shadow: 0 8px 48px rgba(249,115,22,0.6); }
    }
    #sherpa-widget-btn svg { width: 26px; height: 26px; fill: none; stroke: white; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

    #sherpa-widget-panel {
      position: fixed; bottom: 92px; right: 24px; z-index: 99999;
      width: 380px; height: 540px; border-radius: 20px;
      background: #0c0c14; border: 1px solid rgba(249,115,22,0.12);
      box-shadow: 0 24px 80px rgba(0,0,0,0.6), 0 0 40px rgba(249,115,22,0.06);
      display: none; flex-direction: column; overflow: hidden;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    }
    #sherpa-widget-panel.open { display: flex; animation: sherpa-slide-up 0.25s ease-out; }
    @keyframes sherpa-slide-up {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .sherpa-header {
      padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.06);
      background: rgba(249,115,22,0.03);
      display: flex; align-items: center; gap: 10px;
    }
    .sherpa-header-icon {
      width: 32px; height: 32px; border-radius: 10px;
      background: linear-gradient(135deg, rgba(249,115,22,0.15), rgba(234,88,12,0.08));
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .sherpa-header-icon svg { width: 16px; height: 16px; fill: none; stroke: #fb923c; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .sherpa-header-text { flex: 1; }
    .sherpa-header-title {
      font-size: 14px; font-weight: 700; color: #fff; margin: 0;
      background: linear-gradient(135deg, #fb923c, #f97316);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    }
    .sherpa-header-sub { font-size: 11px; color: #6b7280; margin-top: 2px; }

    .sherpa-progress { padding: 12px 20px; border-bottom: 1px solid rgba(255,255,255,0.06); }
    .sherpa-progress-bar { width: 100%; height: 4px; background: #1a1a28; border-radius: 4px; overflow: hidden; }
    .sherpa-progress-fill {
      height: 100%; border-radius: 4px; transition: width 0.5s ease;
      background: linear-gradient(90deg, #f97316, #fb923c);
    }
    .sherpa-progress-fill.complete { background: linear-gradient(90deg, #22c55e, #4ade80); }
    .sherpa-progress-text { font-size: 11px; color: #6b7280; margin-top: 6px; display: flex; justify-content: space-between; }
    .sherpa-progress-pct { color: #fb923c; font-weight: 600; }
    .sherpa-progress-pct.complete { color: #4ade80; }

    .sherpa-messages {
      flex: 1; overflow-y: auto; padding: 16px 20px;
      display: flex; flex-direction: column; gap: 12px;
    }
    .sherpa-messages::-webkit-scrollbar { width: 4px; }
    .sherpa-messages::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }

    .sherpa-msg-row { display: flex; gap: 8px; }
    .sherpa-msg-row.user { justify-content: flex-end; }
    .sherpa-msg-row.assistant { justify-content: flex-start; }

    .sherpa-avatar {
      width: 24px; height: 24px; border-radius: 8px; flex-shrink: 0; margin-top: 2px;
      display: flex; align-items: center; justify-content: center;
    }
    .sherpa-avatar.bot {
      background: linear-gradient(135deg, rgba(249,115,22,0.15), rgba(234,88,12,0.08));
    }
    .sherpa-avatar.bot svg { width: 12px; height: 12px; fill: none; stroke: #fb923c; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

    .sherpa-msg {
      max-width: 80%; padding: 10px 14px; font-size: 13px; line-height: 1.55; word-wrap: break-word;
    }
    .sherpa-msg.user {
      background: linear-gradient(135deg, #f97316, #ea580c);
      color: #fff; border-radius: 16px 16px 6px 16px;
    }
    .sherpa-msg.assistant {
      background: #13131f; color: #e5e7eb;
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 16px 16px 16px 6px;
    }

    .sherpa-typing { display: inline-flex; gap: 3px; margin-left: 4px; vertical-align: middle; }
    .sherpa-typing span {
      width: 5px; height: 5px; border-radius: 50%; background: #fb923c;
      animation: sherpa-bounce 1.2s infinite;
    }
    .sherpa-typing span:nth-child(2) { animation-delay: 0.15s; }
    .sherpa-typing span:nth-child(3) { animation-delay: 0.3s; }
    @keyframes sherpa-bounce {
      0%,80%,100% { opacity: 0.3; transform: translateY(0); }
      40% { opacity: 1; transform: translateY(-3px); }
    }

    .sherpa-input-area {
      padding: 12px 16px; border-top: 1px solid rgba(255,255,255,0.06);
      display: flex; gap: 8px; background: rgba(255,255,255,0.01);
    }
    .sherpa-input {
      flex: 1; background: #13131f; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px;
      padding: 10px 14px; color: #e5e7eb; font-size: 13px; font-family: inherit; outline: none;
      transition: border-color 0.2s;
    }
    .sherpa-input:focus { border-color: rgba(249,115,22,0.4); }
    .sherpa-input::placeholder { color: #374151; }
    .sherpa-send {
      background: linear-gradient(135deg, #f97316, #ea580c); border: none; border-radius: 12px;
      width: 40px; cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: opacity 0.2s; box-shadow: 0 2px 8px rgba(249,115,22,0.2);
    }
    .sherpa-send:disabled { opacity: 0.4; cursor: not-allowed; box-shadow: none; }
    .sherpa-send svg { width: 16px; height: 16px; fill: white; }

    .sherpa-welcome {
      padding: 32px 24px; text-align: center; flex: 1;
      display: flex; flex-direction: column; justify-content: center; align-items: center;
    }
    .sherpa-welcome-icon {
      width: 56px; height: 56px; border-radius: 16px; margin-bottom: 16px;
      background: linear-gradient(135deg, rgba(249,115,22,0.15), rgba(234,88,12,0.08));
      border: 1px solid rgba(249,115,22,0.12);
      display: flex; align-items: center; justify-content: center;
    }
    .sherpa-welcome-icon svg { width: 28px; height: 28px; fill: none; stroke: #fb923c; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .sherpa-welcome-icon.waiting svg { stroke: #6b7280; }
    .sherpa-welcome-icon.waiting {
      background: linear-gradient(135deg, rgba(107,114,128,0.1), rgba(75,85,99,0.05));
      border-color: rgba(107,114,128,0.12);
    }
    .sherpa-welcome h3 {
      color: #fff; font-size: 20px; font-weight: 700; margin: 0 0 6px;
    }
    .sherpa-welcome p { color: #6b7280; font-size: 13px; margin: 0 0 24px; line-height: 1.6; max-width: 280px; }
    .sherpa-welcome input {
      width: 100%; background: #13131f; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px;
      padding: 12px 14px; color: #e5e7eb; font-size: 13px; font-family: inherit; outline: none;
      margin-bottom: 12px; box-sizing: border-box; transition: border-color 0.2s;
    }
    .sherpa-welcome input:focus { border-color: rgba(249,115,22,0.4); }
    .sherpa-welcome input::placeholder { color: #374151; }
    .sherpa-welcome .sherpa-start-btn {
      width: 100%; padding: 12px; border: none; border-radius: 12px;
      background: linear-gradient(135deg, #f97316, #ea580c); color: #fff;
      font-size: 13px; font-weight: 600; font-family: inherit; cursor: pointer;
      transition: opacity 0.2s, box-shadow 0.2s;
      box-shadow: 0 4px 16px rgba(249,115,22,0.25);
    }
    .sherpa-welcome .sherpa-start-btn:hover { box-shadow: 0 6px 24px rgba(249,115,22,0.35); }
    .sherpa-welcome .sherpa-start-btn:disabled { opacity: 0.4; cursor: not-allowed; box-shadow: none; }
    .sherpa-welcome .sherpa-meta { margin-top: 16px; font-size: 11px; color: #4b5563; }

    .sherpa-powered {
      padding: 8px 20px; text-align: center; font-size: 10px; color: #374151;
      border-top: 1px solid rgba(255,255,255,0.04);
    }
    .sherpa-powered span { color: #fb923c; font-weight: 600; }

    .sherpa-spinner {
      width: 20px; height: 20px; border: 2px solid rgba(249,115,22,0.2);
      border-top-color: #fb923c; border-radius: 50%;
      animation: sherpa-spin 0.8s linear infinite; margin: 0 auto 12px;
    }
    @keyframes sherpa-spin { to { transform: rotate(360deg); } }

    .sherpa-status-dot {
      display: inline-block; width: 6px; height: 6px; border-radius: 50%; margin-right: 6px;
    }
    .sherpa-status-dot.analyzing { background: #818cf8; animation: sherpa-dot-pulse 1.5s ease-in-out infinite; }
    .sherpa-status-dot.ready { background: #4ade80; }
    @keyframes sherpa-dot-pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 1; } }
  `;
  document.head.appendChild(style);

  // Mountain SVG icon
  const mountainSvg = '<svg viewBox="0 0 24 24"><path d="m8 3 4 8 5-5 5 16H2L8 3z"/></svg>';
  const sendSvg = '<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';

  // === BUTTON ===
  const btn = document.createElement('button');
  btn.id = 'sherpa-widget-btn';
  btn.innerHTML = mountainSvg;
  btn.onclick = () => { isOpen = !isOpen; panel.classList.toggle('open', isOpen); saveState(); };
  document.body.appendChild(btn);

  // === PANEL ===
  const panel = document.createElement('div');
  panel.id = 'sherpa-widget-panel';
  document.body.appendChild(panel);

  function updateButtonState() {
    btn.classList.remove('waiting', 'pulse');
    if (!program || !published) {
      btn.classList.add('waiting');
    } else if (published && !started) {
      btn.classList.add('pulse');
    }
  }

  function render() {
    updateButtonState();

    // State: No program yet, analyzing
    if (!program && analyzing) {
      panel.innerHTML = `
        <div class="sherpa-welcome">
          <div class="sherpa-welcome-icon waiting">${mountainSvg}</div>
          <h3>Sherpa</h3>
          <div class="sherpa-spinner"></div>
          <p><span class="sherpa-status-dot analyzing"></span>AI is analyzing this codebase. Your onboarding guide will be ready shortly.</p>
        </div>`;
      return;
    }

    // State: No program yet
    if (!program) {
      panel.innerHTML = `
        <div class="sherpa-welcome">
          <div class="sherpa-welcome-icon waiting">${mountainSvg}</div>
          <h3>Sherpa</h3>
          <p>No onboarding program yet. The app owner needs to analyze and publish one first.</p>
        </div>`;
      return;
    }

    // State: Program exists but not published
    if (!published) {
      panel.innerHTML = `
        <div class="sherpa-welcome">
          <div class="sherpa-welcome-icon waiting">${mountainSvg}</div>
          <h3>Almost ready</h3>
          <p><span class="sherpa-status-dot ready"></span>Onboarding program detected for <strong style="color:#e5e7eb">${escapeHtml(program.platformName)}</strong>. Waiting for the owner to publish it.</p>
          <div class="sherpa-meta">${program.flows.length} flows &middot; ${program.flows.reduce((s,f) => s + f.steps.length, 0)} steps ready</div>
        </div>`;
      return;
    }

    // State: Published, waiting for user to start
    if (!started) {
      panel.innerHTML = `
        <div class="sherpa-welcome">
          <div class="sherpa-welcome-icon">${mountainSvg}</div>
          <h3>Welcome to ${escapeHtml(program.platformName)}</h3>
          <p>${escapeHtml(program.platformDescription)}</p>
          <input type="text" id="sherpa-name-input" placeholder="Enter your name..." />
          <button class="sherpa-start-btn" id="sherpa-start-btn" ${!userName ? 'disabled' : ''}>Start Onboarding</button>
          <div class="sherpa-meta">${program.flows.length} flows &middot; ${program.flows.reduce((s,f) => s + f.steps.length, 0)} steps</div>
        </div>
      `;
      const nameInput = panel.querySelector('#sherpa-name-input');
      const startBtn = panel.querySelector('#sherpa-start-btn');
      nameInput.addEventListener('input', e => { userName = e.target.value; startBtn.disabled = !userName.trim(); });
      nameInput.addEventListener('keydown', e => { if (e.key === 'Enter' && userName.trim()) startOnboarding(); });
      startBtn.addEventListener('click', startOnboarding);
      return;
    }

    // State: Active onboarding chat
    const totalSteps = program.flows.reduce((s,f) => s + f.steps.length, 0);
    const completedCount = progress ? progress.completedSteps.length : 0;
    const pct = Math.round((completedCount / totalSteps) * 100);
    const currentFlow = progress ? program.flows[progress.currentFlowIndex] : program.flows[0];
    const currentStep = currentFlow ? currentFlow.steps[progress?.currentStepIndex ?? 0] : null;
    const isComplete = progress && progress.currentFlowIndex >= program.flows.length;

    let html = `
      <div class="sherpa-header">
        <div class="sherpa-header-icon">${mountainSvg}</div>
        <div class="sherpa-header-text">
          <p class="sherpa-header-title">Sherpa</p>
          <p class="sherpa-header-sub">${isComplete ? 'Onboarding complete!' : currentFlow ? escapeHtml(currentFlow.name) : 'Getting started...'}</p>
        </div>
      </div>
      <div class="sherpa-progress">
        <div class="sherpa-progress-bar"><div class="sherpa-progress-fill${isComplete ? ' complete' : ''}" style="width:${pct}%"></div></div>
        <div class="sherpa-progress-text">
          <span>${isComplete ? 'All done!' : currentStep ? 'Step ' + ((progress?.currentStepIndex ?? 0) + 1) + ': ' + escapeHtml(currentStep.title) : ''}</span>
          <span class="sherpa-progress-pct${isComplete ? ' complete' : ''}">${pct}%</span>
        </div>
      </div>
      <div class="sherpa-messages" id="sherpa-messages">
    `;

    for (const msg of messages) {
      if (msg.role === 'user') {
        html += `<div class="sherpa-msg-row user">`;
        html += `<div class="sherpa-msg user">${escapeHtml(msg.content)}</div></div>`;
      } else {
        // Split assistant messages on ||| into separate bubbles
        const isLast = msg === messages[messages.length - 1];
        const parts = msg.content.split('|||').map(p => p.trim()).filter(Boolean);
        if (parts.length === 0 && streaming && isLast) {
          // Empty streaming message — show typing indicator
          html += `<div class="sherpa-msg-row assistant">`;
          html += `<div class="sherpa-avatar bot">${mountainSvg}</div>`;
          html += `<div class="sherpa-msg assistant"><span class="sherpa-typing"><span></span><span></span><span></span></span></div></div>`;
        } else {
          for (let p = 0; p < parts.length; p++) {
            html += `<div class="sherpa-msg-row assistant">`;
            if (p === 0) {
              html += `<div class="sherpa-avatar bot">${mountainSvg}</div>`;
            } else {
              html += `<div class="sherpa-avatar" style="visibility:hidden"></div>`;
            }
            html += `<div class="sherpa-msg assistant">${formatMsg(parts[p])}</div></div>`;
          }
          // Show typing dots as a separate bubble below while streaming
          if (streaming && isLast) {
            html += `<div class="sherpa-msg-row assistant">`;
            html += `<div class="sherpa-avatar" style="visibility:hidden"></div>`;
            html += `<div class="sherpa-msg assistant"><span class="sherpa-typing"><span></span><span></span><span></span></span></div></div>`;
          }
        }
      }
    }

    html += `</div>
      <div class="sherpa-input-area">
        <input class="sherpa-input" id="sherpa-chat-input" placeholder="Type a message or 'done'..." ${streaming ? 'disabled' : ''} />
        <button class="sherpa-send" id="sherpa-send-btn" ${streaming ? 'disabled' : ''}>${sendSvg}</button>
      </div>
      <div class="sherpa-powered">Guided by <span>Sherpa</span></div>
    `;

    panel.innerHTML = html;

    const messagesDiv = panel.querySelector('#sherpa-messages');
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    const input = panel.querySelector('#sherpa-chat-input');
    const sendBtn = panel.querySelector('#sherpa-send-btn');
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && input.value.trim() && !streaming) sendMessage(input.value.trim()); });
    sendBtn.addEventListener('click', () => { if (input.value.trim() && !streaming) sendMessage(input.value.trim()); });
    input.focus();
  }

  function formatMsg(s) {
    // Escape HTML, then convert **bold** markdown and newlines
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#fb923c">$1</strong>')
      .replace(/\n/g,'<br>');
  }

  function escapeHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
  }

  function startOnboarding() {
    if (!userName.trim()) return;
    started = true;
    saveState();
    render();
    sendMessage(`Hi, I'm ${userName.trim()}. I'm ready to start the onboarding.`);
  }

  // ── EVENT CAPTURE (ported from copilot/src/listeners.js) ──
  const eventBuffer = [];
  let lastCapturedUrl = location.href;

  // SPA navigation hooks
  const origPush = history.pushState;
  const origReplace = history.replaceState;
  history.pushState = function() {
    origPush.apply(this, arguments);
    eventBuffer.push({ type: 'navigate', url: location.href, ts: Date.now() });
  };
  history.replaceState = function() {
    origReplace.apply(this, arguments);
    eventBuffer.push({ type: 'navigate', url: location.href, ts: Date.now() });
  };
  window.addEventListener('popstate', () => {
    eventBuffer.push({ type: 'navigate', url: location.href, ts: Date.now() });
  });

  // URL polling fallback
  setInterval(() => {
    if (location.href !== lastCapturedUrl) {
      eventBuffer.push({ type: 'navigate', url: location.href, ts: Date.now() });
      lastCapturedUrl = location.href;
    }
  }, 1000);

  // Debounce for auto-send — don't flood the API
  let autoSendTimer = null;
  function scheduleAutoSend() {
    if (!started || streaming || !published) return;
    clearTimeout(autoSendTimer);
    autoSendTimer = setTimeout(() => {
      if (!started || streaming) return;
      // Auto-send a silent context update — the AI sees what happened
      sendMessage('[USER_ACTION]');
    }, 1500); // Wait 1.5s after last action to batch clicks
  }

  // Capture ALL clicks on interactive elements
  document.addEventListener('click', (e) => {
    const el = e.target;
    // Ignore clicks inside the widget itself
    if (el.closest('#sherpa-widget-panel') || el.closest('#sherpa-widget-btn')) return;
    const interactive = el.closest('button, a, [role="button"], input[type="submit"], [data-testid], [role="menuitem"], [role="link"], [role="tab"], select, .task-card, [class*="card"], [onclick]');
    const target = interactive || el;
    const text = target.textContent?.slice(0, 80)?.trim() || '';
    const tag = target.tagName || 'UNKNOWN';
    const href = target.getAttribute?.('href') || '';
    const classes = target.className?.toString?.().slice(0, 100) || '';
    eventBuffer.push({ type: 'click', tag, text, href, classes, ts: Date.now() });
    scheduleAutoSend();
  }, true);

  // Capture form submissions
  document.addEventListener('submit', (e) => {
    const inputs = [...e.target.querySelectorAll('input,select,textarea')].map(i => ({
      name: i.name || i.placeholder || i.type,
      value: i.type === 'password' ? '***' : i.value?.slice(0, 50),
    }));
    eventBuffer.push({ type: 'submit', action: e.target.action, inputs, ts: Date.now() });
    scheduleAutoSend();
  }, true);

  // Capture input changes (for dropdowns, text fields)
  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.tagName === 'SELECT' || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      eventBuffer.push({
        type: 'input_change',
        tag: el.tagName,
        name: el.name || el.placeholder || el.type,
        value: el.type === 'password' ? '***' : el.value?.slice(0, 50),
        ts: Date.now(),
      });
    }
  }, true);

  function drainEvents() {
    const events = eventBuffer.splice(0);
    return events;
  }

  // ── PAGE CONTEXT (enhanced DOM snapshot) ──
  function getPageContext() {
    const title = document.title || '';
    const headings = [...document.querySelectorAll('h1,h2,h3')].slice(0, 10).map(h => h.textContent.trim()).filter(Boolean);
    const buttons = [...document.querySelectorAll('button,a[class*="bg-"],a[href]')].slice(0, 20).map(b => {
      const text = b.textContent.trim().slice(0, 50);
      const href = b.getAttribute('href') || '';
      return text ? (href ? `${text} (→${href})` : text) : null;
    }).filter(Boolean);
    const inputs = [...document.querySelectorAll('input,select,textarea')].slice(0, 10).map(i => {
      const label = i.closest('label')?.textContent?.trim()?.slice(0, 30) || '';
      return `${i.tagName.toLowerCase()}[${i.name || i.placeholder || i.type}]${label ? ' "' + label + '"' : ''}${i.value ? ' = "' + i.value.slice(0, 30) + '"' : ''}`;
    });
    const navLinks = [...document.querySelectorAll('nav a, aside a')].map(a => {
      const active = a.classList.contains('active') || a.closest('[class*="active"]') || a.closest('[class*="brand-600"]');
      return a.textContent.trim() + (active ? ' (ACTIVE)' : '');
    }).filter(Boolean);

    // Visible text content summary (main area only, skip nav/aside)
    const mainEl = document.querySelector('main') || document.querySelector('[class*="flex-1"]') || document.body;
    const visibleText = mainEl?.innerText?.slice(0, 500) || '';

    return { title, headings, buttons, inputs, navLinks, visibleText, url: window.location.href };
  }

  async function sendMessage(text) {
    if (streaming) return;
    const isAutoAction = text === '[USER_ACTION]';
    if (!isAutoAction) {
      messages.push({ role: 'user', content: text });
    }
    messages.push({ role: 'assistant', content: '' });
    streaming = true;
    render();

    const pageContext = getPageContext();
    const recentEvents = drainEvents();

    try {
      const res = await fetch(SHERPA_API + '/api/onboard/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, userName, message: text, currentUrl: window.location.href, pageContext, userEvents: recentEvents }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'text') {
              const last = messages[messages.length - 1];
              const raw = last.content + data.content;
              last.content = raw
                .replace(/===STEP_COMPLETE===/g, '')
                .replace(/===FLOW_COMPLETE===/g, '')
                .replace(/===PROGRAM_JSON===[\s\S]*/g, '')
                .trim();
              render();
            } else if (data.type === 'progress') {
              progress = data;
              render();
            }
          } catch {}
        }
      }
    } catch (err) {
      const last = messages[messages.length - 1];
      last.content = 'Connection error. Please try again.';
    }

    streaming = false;
    saveState();
    render();
  }

  // Initial render — restore open state
  if (isOpen) panel.classList.add('open');
  render();
})();
