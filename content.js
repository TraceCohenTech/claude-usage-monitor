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

    // Scan backwards for the section label (wide window — SVG icons add many nodes)
    for (let j = i - 1; j >= Math.max(0, i - 40); j--) {
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

// ── In-page warning banner ────────────────────────────────────────────────────

let bannerEl = null;
let dismissedUntil = 0;

function getOrCreateBanner() {
  if (bannerEl) return bannerEl;
  bannerEl = document.createElement('div');
  bannerEl.id = '__claude_usage_banner__';
  bannerEl.style.cssText = [
    'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:2147483647',
    'height:40px', 'display:none', 'align-items:center',
    'justify-content:space-between', 'padding:0 16px',
    'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    'font-size:13px', 'font-weight:500',
    'box-shadow:0 2px 8px rgba(0,0,0,0.15)',
  ].join(';');

  const msg = document.createElement('span');
  msg.id = '__claude_usage_msg__';

  const btn = document.createElement('button');
  btn.textContent = '×';
  btn.style.cssText = 'background:none;border:none;font-size:22px;line-height:1;cursor:pointer;opacity:0.55;padding:0 2px;color:inherit';
  btn.onclick = () => { dismissedUntil = Date.now() + 30 * 60_000; bannerEl.style.display = 'none'; };

  bannerEl.appendChild(msg);
  bannerEl.appendChild(btn);
  document.body.appendChild(bannerEl);
  return bannerEl;
}

function updateBanner(usage, prefs) {
  if (!usage || !prefs || Date.now() < dismissedUntil) return;
  const { threshold1, threshold2 } = prefs;
  const labels = { session: 'Session', allModels: 'All Models', sonnet: 'Sonnet', opus: 'Opus' };

  let maxPct = 0, maxLabel = '', maxReset = '';
  for (const [k, v] of Object.entries(usage)) {
    if (!labels[k]) continue;
    const pct = typeof v === 'number' ? v : (v?.pct ?? 0);
    if (pct > maxPct) {
      maxPct = pct;
      maxLabel = labels[k];
      maxReset = typeof v === 'object' ? (v?.reset || '') : '';
    }
  }

  if (maxPct < threshold1) { if (bannerEl) bannerEl.style.display = 'none'; return; }

  const el = getOrCreateBanner();
  const crit = maxPct >= threshold2;
  el.style.background    = crit ? '#fef2f2' : '#fffbeb';
  el.style.borderBottom  = `2px solid ${crit ? '#ef4444' : '#f59e0b'}`;
  el.style.color         = crit ? '#991b1b' : '#92400e';
  el.style.display       = 'flex';
  document.getElementById('__claude_usage_msg__').textContent =
    `${crit ? '🔴' : '🟡'} ${maxLabel} at ${Math.round(maxPct)}%${maxReset ? ' · ' + maxReset : ''}`;
}

// Pull current usage on load, then listen for live updates
if (ctxOk()) {
  try {
    chrome.runtime.sendMessage({ type: 'GET_USAGE' }, (res) => {
      if (!chrome.runtime.lastError && res) updateBanner(res.usage, res.prefs);
    });
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === 'USAGE_CHANGED') updateBanner(msg.usage, msg.prefs);
    });
  } catch {}
}
