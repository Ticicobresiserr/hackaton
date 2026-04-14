(function () {
  const SHERPA_API = window.SHERPA_API || 'http://localhost:3001';
  const sessionId = 'session_' + Date.now();
  let userName = '';
  let messages = [];
  let streaming = false;
  let progress = null;
  let started = false;
  let program = null;
  let isOpen = false;

  // Fetch program on load
  fetch(SHERPA_API + '/api/program')
    .then(r => r.json())
    .then(data => { program = data.program; });

  // === STYLES ===
  const style = document.createElement('style');
  style.textContent = `
    #sherpa-widget-btn {
      position: fixed; bottom: 24px; right: 24px; z-index: 99999;
      width: 56px; height: 56px; border-radius: 16px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      border: none; cursor: pointer; box-shadow: 0 8px 32px rgba(99,102,241,0.4);
      display: flex; align-items: center; justify-content: center;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    #sherpa-widget-btn:hover { transform: scale(1.08); box-shadow: 0 12px 40px rgba(99,102,241,0.5); }
    #sherpa-widget-btn svg { width: 26px; height: 26px; fill: white; }

    #sherpa-widget-panel {
      position: fixed; bottom: 92px; right: 24px; z-index: 99999;
      width: 380px; height: 520px; border-radius: 20px;
      background: #0a0a0f; border: 1px solid rgba(255,255,255,0.08);
      box-shadow: 0 24px 80px rgba(0,0,0,0.6);
      display: none; flex-direction: column; overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    #sherpa-widget-panel.open { display: flex; }

    .sherpa-header {
      padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.06);
      background: rgba(255,255,255,0.02);
    }
    .sherpa-header-title { font-size: 14px; font-weight: 700; color: #fff; margin: 0; }
    .sherpa-header-sub { font-size: 11px; color: #6b7280; margin-top: 2px; }

    .sherpa-progress { padding: 12px 20px; border-bottom: 1px solid rgba(255,255,255,0.06); }
    .sherpa-progress-bar { width: 100%; height: 4px; background: #1f1f2e; border-radius: 4px; overflow: hidden; }
    .sherpa-progress-fill { height: 100%; background: linear-gradient(90deg, #6366f1, #a78bfa); border-radius: 4px; transition: width 0.5s; }
    .sherpa-progress-text { font-size: 11px; color: #6b7280; margin-top: 6px; display: flex; justify-content: space-between; }

    .sherpa-messages {
      flex: 1; overflow-y: auto; padding: 16px 20px; display: flex; flex-direction: column; gap: 12px;
    }
    .sherpa-msg { max-width: 85%; padding: 10px 14px; border-radius: 16px; font-size: 13px; line-height: 1.5; word-wrap: break-word; }
    .sherpa-msg.user { align-self: flex-end; background: linear-gradient(135deg, #6366f1, #7c3aed); color: #fff; border-bottom-right-radius: 6px; }
    .sherpa-msg.assistant { align-self: flex-start; background: #16161f; color: #e5e7eb; border: 1px solid rgba(255,255,255,0.06); border-bottom-left-radius: 6px; }
    .sherpa-msg.assistant .sherpa-typing { display: inline-flex; gap: 3px; margin-left: 4px; }
    .sherpa-msg.assistant .sherpa-typing span {
      width: 5px; height: 5px; border-radius: 50%; background: #6366f1;
      animation: sherpa-bounce 1.2s infinite;
    }
    .sherpa-msg.assistant .sherpa-typing span:nth-child(2) { animation-delay: 0.15s; }
    .sherpa-msg.assistant .sherpa-typing span:nth-child(3) { animation-delay: 0.3s; }
    @keyframes sherpa-bounce { 0%,80%,100% { opacity: 0.3; } 40% { opacity: 1; } }

    .sherpa-input-area {
      padding: 12px 16px; border-top: 1px solid rgba(255,255,255,0.06);
      display: flex; gap: 8px;
    }
    .sherpa-input {
      flex: 1; background: #16161f; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px;
      padding: 10px 14px; color: #e5e7eb; font-size: 13px; outline: none;
      transition: border-color 0.2s;
    }
    .sherpa-input:focus { border-color: rgba(99,102,241,0.4); }
    .sherpa-input::placeholder { color: #374151; }
    .sherpa-send {
      background: linear-gradient(135deg, #6366f1, #7c3aed); border: none; border-radius: 12px;
      width: 40px; cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: opacity 0.2s;
    }
    .sherpa-send:disabled { opacity: 0.4; cursor: not-allowed; }
    .sherpa-send svg { width: 16px; height: 16px; fill: white; }

    .sherpa-welcome { padding: 32px 24px; text-align: center; flex: 1; display: flex; flex-direction: column; justify-content: center; }
    .sherpa-welcome h3 { color: #fff; font-size: 18px; font-weight: 700; margin: 0 0 8px; }
    .sherpa-welcome p { color: #6b7280; font-size: 13px; margin: 0 0 20px; line-height: 1.5; }
    .sherpa-welcome input {
      width: 100%; background: #16161f; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px;
      padding: 10px 14px; color: #e5e7eb; font-size: 13px; outline: none; margin-bottom: 12px; box-sizing: border-box;
    }
    .sherpa-welcome input:focus { border-color: rgba(99,102,241,0.4); }
    .sherpa-welcome button {
      width: 100%; padding: 12px; border: none; border-radius: 12px;
      background: linear-gradient(135deg, #6366f1, #7c3aed); color: #fff;
      font-size: 13px; font-weight: 600; cursor: pointer;
      transition: opacity 0.2s;
    }
    .sherpa-welcome button:disabled { opacity: 0.4; cursor: not-allowed; }
  `;
  document.head.appendChild(style);

  // === BUTTON ===
  const btn = document.createElement('button');
  btn.id = 'sherpa-widget-btn';
  btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M13 3L4 14h7l-2 7 9-11h-7l2-7z"/></svg>';
  btn.onclick = () => { isOpen = !isOpen; panel.classList.toggle('open', isOpen); };
  document.body.appendChild(btn);

  // === PANEL ===
  const panel = document.createElement('div');
  panel.id = 'sherpa-widget-panel';
  document.body.appendChild(panel);

  function render() {
    if (!program) {
      panel.innerHTML = '<div class="sherpa-welcome"><h3>Sherpa</h3><p>Loading onboarding program...</p></div>';
      return;
    }

    if (!started) {
      panel.innerHTML = `
        <div class="sherpa-welcome">
          <h3>Welcome to ${program.platformName}</h3>
          <p>${program.platformDescription}</p>
          <input type="text" id="sherpa-name-input" placeholder="Enter your name..." />
          <button id="sherpa-start-btn" ${!userName ? 'disabled' : ''}>Start Onboarding</button>
          <p style="margin-top:12px;font-size:11px;color:#4b5563">${program.flows.length} flows &middot; ${program.flows.reduce((s,f) => s + f.steps.length, 0)} steps</p>
        </div>
      `;
      const nameInput = panel.querySelector('#sherpa-name-input');
      const startBtn = panel.querySelector('#sherpa-start-btn');
      nameInput.addEventListener('input', e => { userName = e.target.value; startBtn.disabled = !userName.trim(); });
      nameInput.addEventListener('keydown', e => { if (e.key === 'Enter' && userName.trim()) startOnboarding(); });
      startBtn.addEventListener('click', startOnboarding);
      return;
    }

    const totalSteps = program.flows.reduce((s,f) => s + f.steps.length, 0);
    const completedCount = progress ? progress.completedSteps.length : 0;
    const pct = Math.round((completedCount / totalSteps) * 100);
    const currentFlow = progress ? program.flows[progress.currentFlowIndex] : program.flows[0];
    const currentStep = currentFlow ? currentFlow.steps[progress?.currentStepIndex ?? 0] : null;
    const isComplete = progress && progress.currentFlowIndex >= program.flows.length;

    let html = `
      <div class="sherpa-header">
        <p class="sherpa-header-title">Sherpa</p>
        <p class="sherpa-header-sub">${isComplete ? 'Onboarding complete!' : currentFlow ? currentFlow.name : 'Getting started...'}</p>
      </div>
      <div class="sherpa-progress">
        <div class="sherpa-progress-bar"><div class="sherpa-progress-fill" style="width:${pct}%"></div></div>
        <div class="sherpa-progress-text">
          <span>${isComplete ? 'All done!' : currentStep ? 'Step ' + ((progress?.currentStepIndex ?? 0) + 1) + ': ' + currentStep.title : ''}</span>
          <span>${pct}%</span>
        </div>
      </div>
      <div class="sherpa-messages" id="sherpa-messages">
    `;

    for (const msg of messages) {
      html += `<div class="sherpa-msg ${msg.role}">${escapeHtml(msg.content)}`;
      if (msg.role === 'assistant' && streaming && msg === messages[messages.length - 1]) {
        html += '<span class="sherpa-typing"><span></span><span></span><span></span></span>';
      }
      html += '</div>';
    }

    html += `</div>
      <div class="sherpa-input-area">
        <input class="sherpa-input" id="sherpa-chat-input" placeholder="Type a message or 'done'..." ${streaming ? 'disabled' : ''} />
        <button class="sherpa-send" id="sherpa-send-btn" ${streaming ? 'disabled' : ''}>
          <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
      </div>
    `;

    panel.innerHTML = html;

    const messagesDiv = panel.querySelector('#sherpa-messages');
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    const input = panel.querySelector('#sherpa-chat-input');
    const sendBtn = panel.querySelector('#sherpa-send-btn');
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && input.value.trim() && !streaming) sendMessage(input.value.trim()); });
    sendBtn.addEventListener('click', () => { if (input.value.trim() && !streaming) sendMessage(input.value.trim()); });
  }

  function escapeHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
  }

  function startOnboarding() {
    if (!userName.trim()) return;
    started = true;
    render();
    sendMessage(`Hi, I'm ${userName.trim()}. I'm ready to start the onboarding.`);
  }

  async function sendMessage(text) {
    if (streaming) return;
    messages.push({ role: 'user', content: text });
    messages.push({ role: 'assistant', content: '' });
    streaming = true;
    render();

    try {
      const res = await fetch(SHERPA_API + '/api/onboard/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, userName, message: text, currentUrl: window.location.href }),
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
    render();
  }

  // Initial render
  render();
})();
