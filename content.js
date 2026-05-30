// Inject fetch interceptor into page's MAIN world
const s = document.createElement('script');
s.src = chrome.runtime.getURL('interceptor.js');
document.documentElement.insertBefore(s, document.documentElement.firstChild);

// ── Context guard ─────────────────────────────────────────────────────────────
// When the extension is reloaded, existing content scripts become orphaned.
// chrome.runtime.id is undefined in that state — check it before every call
// so Chrome doesn't log "Extension context invalidated" errors.
function ctxOk() {
  try { return !!chrome.runtime?.id; } catch { return false; }
}

function send(msg) {
  if (!ctxOk()) {
    observer.disconnect(); // Stop observing — no point continuing
    return;
  }
  try { chrome.runtime.sendMessage(msg); } catch {}
}

// Relay intercepted API data to background
window.addEventListener('__claude_monitor__', (e) => {
  send({ type: 'API_RESPONSE', url: e.detail.url, data: e.detail.data });
});

// ── DOM scraper ───────────────────────────────────────────────────────────────
// Reads "X% used" and nearby "Resets in …" text from the settings page.

let lastKey = '';

function parseUsageFromDOM() {
  if (!document.body || !document.body.innerText.includes('% used')) return null;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let node;
  while ((node = walker.nextNode())) nodes.push(node);

  const result = {};

  for (let i = 0; i < nodes.length; i++) {
    const text = nodes[i].textContent.trim();
    const pctMatch = text.match(/^(\d+)%\s+used$/i);
    if (!pctMatch) continue;

    const pct = parseInt(pctMatch[1]);
    let label = `limit_${Object.keys(result).length}`;
    let reset = null;

    // Scan backwards for the section label
    for (let j = i - 1; j >= Math.max(0, i - 14); j--) {
      const t = nodes[j].textContent.trim().toLowerCase();
      if (t.includes('current session')) { label = 'session'; break; }
      if (t.includes('all model'))       { label = 'allModels'; break; }
      if (t.includes('sonnet'))          { label = 'sonnet'; break; }
      if (t.includes('opus'))            { label = 'opus'; break; }
    }

    // Scan forwards for reset time (e.g. "Resets in 4 hr 40 min" or "Resets Mon 2:00 PM")
    for (let j = i + 1; j <= Math.min(nodes.length - 1, i + 8); j++) {
      const t = nodes[j].textContent.trim();
      if (/resets in/i.test(t) || /resets (mon|tue|wed|thu|fri|sat|sun)/i.test(t)) {
        reset = t;
        break;
      }
    }

    result[label] = { pct, reset };
  }

  return Object.keys(result).length ? result : null;
}

function tryScrape() {
  const usage = parseUsageFromDOM();
  if (!usage) return;
  const key = JSON.stringify(usage);
  if (key === lastKey) return;
  lastKey = key;
  send({ type: 'USAGE_UPDATE', usage, source: 'dom' });
}

// MutationObserver + debounce to handle React SPA rendering
let debounce;
const observer = new MutationObserver(() => {
  clearTimeout(debounce);
  debounce = setTimeout(tryScrape, 600);
});

function start() {
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
    tryScrape();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start);
} else {
  start();
}

// Handle client-side navigation in the SPA
window.addEventListener('popstate', () => setTimeout(tryScrape, 1000));
