// Inyectado automáticamente por Playwright MCP --init-script
// Captura eventos del usuario en un buffer que el observer drena periódicamente.
window.__copilot = { events: [], lastUrl: location.href };

// Navegación SPA — hook pushState y replaceState
const origPush = history.pushState;
const origReplace = history.replaceState;
history.pushState = function() {
  origPush.apply(this, arguments);
  window.__copilot.events.push({ type: 'navigate', url: location.href, ts: Date.now() });
};
history.replaceState = function() {
  origReplace.apply(this, arguments);
  window.__copilot.events.push({ type: 'navigate', url: location.href, ts: Date.now() });
};
window.addEventListener('popstate', () => {
  window.__copilot.events.push({ type: 'navigate', url: location.href, ts: Date.now() });
});

// URL change polling (fallback para frameworks que no usan pushState directamente)
setInterval(() => {
  if (location.href !== window.__copilot.lastUrl) {
    window.__copilot.events.push({ type: 'navigate', url: location.href, ts: Date.now() });
    window.__copilot.lastUrl = location.href;
  }
}, 1000);

// Capturar TODOS los clicks (sin filtro, para no perder nada)
document.addEventListener('click', (e) => {
  const el = e.target;
  const interactive = el.closest('button, a, [role="button"], input[type="submit"], [data-testid], [role="menuitem"], [role="link"], [role="tab"]');
  const text = (interactive || el).textContent?.slice(0, 60)?.trim() || '';
  const tag = (interactive || el).tagName || 'UNKNOWN';
  window.__copilot.events.push({
    type: 'click',
    tag: tag,
    text: text,
    href: interactive?.getAttribute?.('href') || '',
    ts: Date.now()
  });
}, true);

// Form submits
document.addEventListener('submit', (e) => {
  window.__copilot.events.push({ type: 'submit', action: e.target.action, ts: Date.now() });
}, true);
