const ICON = chrome.runtime.getURL('icons/icon128.png');
const MENU_BAR_URL = 'http://localhost:39571/usage';
const MAX_HISTORY = 288; // 24h at 5-min granularity
const KNOWN_KEYS = new Set(['session', 'allModels', 'sonnet', 'opus']);

// ── Lifecycle ─────────────────────────────────────────────────────────────────

function ensureAlarms() {
  chrome.alarms.get('refresh', (a) => {
    if (!a) chrome.alarms.create('refresh', { periodInMinutes: 5 });
  });
}

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === 'install') {
    await chrome.storage.local.clear();
    await chrome.storage.sync.set({
      threshold1: 75,
      threshold2: 90,
      soundEnabled: true,
      rateWarningEnabled: true,
      rateWarningMinutes: 60,
    });
    chrome.tabs.create({ url: chrome.runtime.getURL('options.html?welcome=1') });
  }
  chrome.alarms.clearAll();
  ensureAlarms();
});

// Re-register alarms after browser restarts (service worker wakes fresh)
chrome.runtime.onStartup.addListener(() => {
  ensureAlarms();
});

// Clean up any stale noise keys left in storage from old versions
chrome.storage.local.get('usage', ({ usage }) => {
  if (!usage) return;
  const dirty = Object.keys(usage).some(k => !KNOWN_KEYS.has(k));
  if (!dirty) return;
  const clean = {};
  for (const k of KNOWN_KEYS) { if (usage[k]) clean[k] = usage[k]; }
  chrome.storage.local.set({ usage: clean });
});

// ── Alarms (adaptive polling + deferred cleanup) ──────────────────────────────

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'refresh') {
    await pollClaudeUsage();
  } else if (alarm.name.startsWith('closeTab_')) {
    const tabId = parseInt(alarm.name.split('_')[1], 10);
    chrome.tabs.remove(tabId).catch(() => {});
  } else if (alarm.name === 'closeOffscreen') {
    chrome.offscreen.closeDocument().catch(() => {});
  }
});

// ── Messages from content script ──────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'USAGE_UPDATE') {
    handleUsageUpdate(msg.usage, 'dom');
  } else if (msg.type === 'API_RESPONSE') {
    const usage = extractUsageFromApiData(msg.data);
    if (usage) {
      if (msg.url) chrome.storage.local.set({ knownEndpoint: msg.url });
      handleUsageUpdate(usage, 'api');
    }
  } else if (msg.type === 'GET_USAGE') {
    Promise.all([chrome.storage.local.get('usage'), getPrefs()])
      .then(([local, prefs]) => sendResponse({ usage: local.usage || {}, prefs }));
    return true; // async
  } else if (msg.type === 'REFRESH') {
    pollClaudeUsage();
  }
});

// Clicking any notification opens the settings page
chrome.notifications.onClicked.addListener((id) => {
  chrome.tabs.create({ url: 'https://claude.ai/settings' });
  chrome.notifications.clear(id);
});

// ── Core update logic ─────────────────────────────────────────────────────────

async function handleUsageUpdate(incoming, source) {
  const prefs = await getPrefs();
  const normalized = normalizeUsage(incoming);
  const { usage: existing = {}, history = [] } = await chrome.storage.local.get(['usage', 'history']);

  const merged = mergeUsage(normalized, existing, source);

  // Strip any noise keys — only keep known usage keys
  for (const k of Object.keys(merged)) {
    if (!KNOWN_KEYS.has(k)) delete merged[k];
  }

  const maxPct = getMax(merged) ?? 0;

  const newHistory = [
    ...history,
    { timestamp: Date.now(), maxPct, usage: merged },
  ].slice(-MAX_HISTORY);

  await chrome.storage.local.set({
    usage: merged,
    history: newHistory,
    lastUpdated: Date.now(),
  });

  // Broadcast live update to all open claude.ai tabs
  const claudeTabs = await chrome.tabs.query({ url: 'https://claude.ai/*' });
  for (const tab of claudeTabs) {
    chrome.tabs.sendMessage(tab.id, { type: 'USAGE_CHANGED', usage: merged, prefs }).catch(() => {});
  }

  updateBadge(merged, prefs);
  await checkThresholds(merged, existing, prefs);
  await checkBurnRate(merged, newHistory, prefs);
  await postToMenuBar({ usage: merged, lastUpdated: Date.now() });
}

// ── Badge ─────────────────────────────────────────────────────────────────────

function updateBadge(usage, prefs = {}) {
  const max = getMax(usage);
  if (max == null) {
    chrome.action.setBadgeText({ text: '' });
    return;
  }
  const t2 = prefs.threshold2 ?? 90;
  const t1 = prefs.threshold1 ?? 75;
  const color = max >= t2 ? '#ef4444' : max >= t1 ? '#f59e0b' : '#3b82f6';
  chrome.action.setBadgeBackgroundColor({ color });
  chrome.action.setBadgeText({ text: `${Math.round(max)}%` });
}

// ── Threshold notifications ───────────────────────────────────────────────────

async function checkThresholds(usage, prev, prefs) {
  const { threshold1, threshold2 } = prefs;
  const { alerted = {} } = await chrome.storage.local.get('alerted');
  let changed = false;

  const limits = [
    { key: 'session',   label: 'Current Session' },
    { key: 'allModels', label: 'Weekly (All Models)' },
    { key: 'sonnet',    label: 'Weekly (Sonnet)' },
    { key: 'opus',      label: 'Weekly (Opus)' },
  ];

  for (const { key, label } of limits) {
    const entry = usage[key];
    if (!entry) continue;
    const pct = getPct(entry);
    const prevPct = getPct(prev[key]) ?? 0;

    for (const [threshold, severity] of [[threshold2, 'critical'], [threshold1, 'warning']]) {
      const alertKey = `${key}_t${threshold}`;
      if (pct >= threshold && prevPct < threshold && !alerted[alertKey]) {
        await notify(label, pct, threshold, severity, entry.reset);
        alerted[alertKey] = true;
        changed = true;
      } else if (pct < threshold - 5 && alerted[alertKey]) {
        delete alerted[alertKey];
        changed = true;
      }
    }
  }

  if (changed) await chrome.storage.local.set({ alerted });
}

async function notify(limitLabel, pct, threshold, severity, resetText) {
  const remaining = 100 - Math.round(pct);
  const title = severity === 'critical'
    ? `🔴 Claude Critical — ${limitLabel}`
    : `🟡 Claude Warning — ${limitLabel}`;
  const reset = resetText ? `  ${resetText}.` : '';
  const message = `${Math.round(pct)}% used — ${remaining}% remaining.${reset}`;

  chrome.notifications.create(`claude_${severity}_${Date.now()}`, {
    type: 'basic',
    iconUrl: ICON,
    title,
    message,
    priority: severity === 'critical' ? 2 : 1,
    requireInteraction: severity === 'critical',
  });

  await playAlertSound(severity);
}

// ── Burn-rate detection ───────────────────────────────────────────────────────

async function checkBurnRate(usage, history, prefs) {
  const { rateWarningEnabled, rateWarningMinutes, threshold2 } = prefs;
  if (!rateWarningEnabled || history.length < 4) return;

  const currentMax = getMax(usage) ?? 0;
  if (currentMax >= threshold2) return; // Already past threshold, don't double-alert

  const now = Date.now();
  // Find a reference point 15–45 minutes ago
  const ref = history
    .slice()
    .reverse()
    .find((h) => {
      const age = now - h.timestamp;
      return age >= 15 * 60_000 && age <= 45 * 60_000;
    });

  if (!ref || currentMax <= ref.maxPct) return;

  const elapsedMin = (now - ref.timestamp) / 60_000;
  const ratePerMin = (currentMax - ref.maxPct) / elapsedMin;
  if (ratePerMin <= 0.3) return; // Ignore trivially slow growth

  const minsToThreshold = (threshold2 - currentMax) / ratePerMin;
  if (minsToThreshold > rateWarningMinutes || minsToThreshold <= 0) return;

  // Rate-limit: only fire once per 30 minutes
  const { alerted = {} } = await chrome.storage.local.get('alerted');
  if (alerted.rate && now - alerted.rate < 30 * 60_000) return;

  alerted.rate = now;
  await chrome.storage.local.set({ alerted });

  chrome.notifications.create(`claude_rate_${now}`, {
    type: 'basic',
    iconUrl: ICON,
    title: '⚡ Claude Burning Fast',
    message: `On pace to hit ${threshold2}% in ~${Math.round(minsToThreshold)} min. Consider wrapping up.`,
    priority: 2,
  });

  // Store burn flag for popup display
  await chrome.storage.local.set({ burnWarning: { active: true, minsLeft: Math.round(minsToThreshold), ts: now } });
  await playAlertSound('warning');
}

// ── Sound (offscreen document) ────────────────────────────────────────────────

async function playAlertSound(severity) {
  const { soundEnabled } = await getPrefs();
  if (!soundEnabled) return;

  try {
    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL('offscreen.html'),
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Alert sound for Claude usage warning',
    });
  } catch (e) {
    if (!e.message?.includes('already')) return; // Already exists — that's fine
  }

  chrome.runtime.sendMessage({
    target: 'offscreen',
    type: 'PLAY_BEEP',
    frequency: severity === 'critical' ? 880 : 520,
    duration: severity === 'critical' ? 0.6 : 0.3,
  }).catch(() => {});

  chrome.alarms.create('closeOffscreen', { when: Date.now() + 4000 });
}

// ── Background polling ────────────────────────────────────────────────────────

async function pollClaudeUsage() {
  // Open a background tab to the usage page so the DOM scraper fires.
  // active:false keeps it in the background without stealing focus.
  // Use an alarm to close it instead of setTimeout — alarms survive service worker dormancy.
  try {
    const tab = await chrome.tabs.create({
      url: 'https://claude.ai/settings/usage',
      active: false,
    });
    chrome.alarms.create(`closeTab_${tab.id}`, { when: Date.now() + 8000 });
  } catch {}
}

// ── Menu bar server POST ──────────────────────────────────────────────────────

async function postToMenuBar(payload) {
  try {
    await fetch(MENU_BAR_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {} // Server not running — silent fail
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getPrefs() {
  const defaults = { threshold1: 75, threshold2: 90, soundEnabled: true, rateWarningEnabled: true, rateWarningMinutes: 60 };
  const stored = await chrome.storage.sync.get(Object.keys(defaults));
  return { ...defaults, ...stored };
}

function getPct(entry) {
  if (typeof entry === 'number') return entry;
  if (entry && typeof entry.pct === 'number') return entry.pct;
  return 0;
}

function getMax(usage) {
  if (!usage) return null;
  const vals = Object.values(usage).map(getPct).filter((v) => v >= 0 && v <= 100);
  return vals.length ? Math.max(...vals) : null;
}

function normalizeUsage(incoming) {
  const result = {};
  for (const [k, v] of Object.entries(incoming)) {
    if (typeof v === 'number') {
      result[k] = { pct: v, reset: null };
    } else if (v && typeof v === 'object' && typeof v.pct === 'number') {
      result[k] = { pct: v.pct, reset: v.reset ?? null };
    }
  }
  return result;
}

function mergeUsage(incoming, existing, source) {
  const merged = { ...existing };
  for (const [k, v] of Object.entries(incoming)) {
    merged[k] = {
      pct: v.pct,
      // DOM scrapes have reset times; API scrapes may not — preserve existing
      reset: v.reset ?? (source === 'api' ? existing[k]?.reset ?? null : null),
    };
  }
  return merged;
}

// Fields that look like percentages but are NOT usage limits
const API_NOISE = ['discount', 'threshold', 'credit', 'price', 'cost', 'tier', 'fee', 'refund', 'stripe'];

function extractUsageFromApiData(data) {
  if (!data || typeof data !== 'object') return null;
  const result = {};

  function walk(obj, depth = 0) {
    if (depth > 6 || !obj || typeof obj !== 'object') return;
    for (const [k, v] of Object.entries(obj)) {
      const lk = k.toLowerCase();
      // Skip known billing/config noise fields
      if (API_NOISE.some((n) => lk.includes(n))) continue;
      if (typeof v === 'number' && v >= 1 && v <= 100) {
        // Only accept clean integers that could be a user-visible percentage
        if (Number.isInteger(v) && (lk.includes('pct') || lk.includes('percent') || lk.includes('usage'))) {
          result[k] = v;
        }
      } else if (typeof v === 'object') {
        walk(v, depth + 1);
      }
    }
  }

  walk(data);
  return Object.keys(result).length ? result : null;
}
