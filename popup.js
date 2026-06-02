const LABEL = {
  session:   'Current Session',
  allModels: 'All Models',
  sonnet:    'Sonnet',
  opus:      'Opus',
};

function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function getPct(entry) {
  return typeof entry === 'number' ? entry : (entry?.pct ?? 0);
}
function getReset(entry) {
  return typeof entry === 'object' ? entry?.reset ?? null : null;
}
function getMax(usage) {
  if (!usage) return null;
  const vals = Object.values(usage).map(getPct).filter(v => v >= 0 && v <= 100);
  return vals.length ? Math.max(...vals) : null;
}

function barClass(pct, t1, t2) {
  if (pct >= t2) return 'red';
  if (pct >= t1) return 'yellow';
  return 'blue';
}
function pctColor(pct, t1, t2) {
  if (pct >= t2) return '#ef4444';
  if (pct >= t1) return '#f59e0b';
  return '#3b82f6';
}

function renderUsageRow(key, entry, t1, t2, isBurning) {
  const pct = getPct(entry);
  const reset = getReset(entry);
  const cls = barClass(pct, t1, t2);
  const col = pctColor(pct, t1, t2);
  const name = esc(LABEL[key] || key);
  const burnIcon = isBurning ? `<span class="burn-icon">⚡</span>` : '';

  return `
    <div class="usage-row">
      <div class="usage-top">
        <span class="limit-name">${name}</span>
        <span class="limit-right">
          ${burnIcon}
          <span class="limit-pct" style="color:${col}">${Math.round(pct)}%</span>
        </span>
      </div>
      <div class="bar-track">
        <div class="bar-fill ${cls}" style="width:${Math.min(pct,100)}%"></div>
      </div>
      ${reset ? `<div class="reset-time">${esc(reset)}</div>` : ''}
    </div>`;
}

// ── Runway calculator ─────────────────────────────────────────────────────────

function parseResetMins(text) {
  if (!text) return null;
  const hrMin = text.match(/(\d+)\s*hr(?:\s*(\d+)\s*min)?/i);
  if (hrMin) return parseInt(hrMin[1]) * 60 + (hrMin[2] ? parseInt(hrMin[2]) : 0);
  const min = text.match(/(\d+)\s*min/i);
  if (min) return parseInt(min[1]);
  if (/mon|tue|wed|thu|fri|sat|sun/i.test(text)) return 7 * 24 * 60;
  return null;
}

function buildRunway(usage, history, t2) {
  if (!history || history.length < 4) return `<div class="runway-empty">Not enough data yet</div>`;

  const now = Date.now();
  const recent = history.filter(h => now - h.timestamp < 2 * 3_600_000);
  if (recent.length < 2) return `<div class="runway-empty">Not enough recent activity</div>`;

  const elapsedHrs = (recent[recent.length - 1].timestamp - recent[0].timestamp) / 3_600_000;
  if (elapsedHrs < 0.05) return `<div class="runway-empty">Not enough data yet</div>`;

  const ratePerHour = (recent[recent.length - 1].maxPct - recent[0].maxPct) / elapsedHrs;
  if (ratePerHour <= 0) return `<div class="runway-row"><span class="runway-rate">+0%/hr</span><span class="runway-ok">✓ Not burning</span></div>`;

  const rateStr = `+${ratePerHour.toFixed(1)}%/hr`;
  let minMins = Infinity, minLabel = '', safeReset = false;

  for (const k of ['session', 'allModels', 'sonnet', 'opus']) {
    if (!usage[k]) continue;
    const pct = getPct(usage[k]);
    const resetMins = parseResetMins(getReset(usage[k]));
    const toThreshold = (t2 - pct) / ratePerHour * 60;
    const runway = resetMins != null ? Math.min(toThreshold, resetMins) : toThreshold;
    if (runway < minMins) {
      minMins = runway; minLabel = LABEL[k] || k;
      safeReset = resetMins != null && resetMins <= toThreshold;
    }
  }

  if (!minLabel) return `<div class="runway-empty">No data</div>`;
  if (safeReset) return `<div class="runway-row"><span class="runway-rate">${rateStr}</span><span class="runway-ok">✓ Resets before limit</span></div>`;

  const h = Math.floor(minMins / 60), m = Math.round(minMins % 60);
  const timeStr = h > 0 ? `${h}h ${m}m` : `${m}m`;
  const low = minMins < 60;
  return `<div class="runway-row"><span class="runway-rate">${rateStr} · ${minLabel}</span><span class="runway-time${low ? ' runway-low' : ''}">~${timeStr} left</span></div>`;
}

// ── Heatmap ───────────────────────────────────────────────────────────────────

function buildHeatmap(history) {
  if (!history || history.length < 10) return `<div class="spark-empty">Not enough data yet</div>`;

  const buckets = new Array(24).fill(0), counts = new Array(24).fill(0);
  for (let i = 1; i < history.length; i++) {
    const gap = history[i].timestamp - history[i - 1].timestamp;
    if (gap > 3_600_000) continue;
    const delta = Math.max(0, history[i].maxPct - history[i - 1].maxPct);
    const hr = new Date(history[i].timestamp).getHours();
    buckets[hr] += delta; counts[hr]++;
  }

  const avgs = buckets.map((t, h) => ({ h, avg: counts[h] > 0 ? t / counts[h] : 0, n: counts[h] }));
  const peak = Math.max(...avgs.map(a => a.avg), 0.01);
  const CW = 10, GAP = 1, H = 20;

  const cells = avgs.map(({ h, avg, n }) => {
    const intensity = avg / peak;
    const op = n > 0 ? (0.1 + intensity * 0.85).toFixed(2) : '0.06';
    const col = intensity > 0.65 ? '#ef4444' : intensity > 0.35 ? '#f59e0b' : '#3b82f6';
    const x = h * (CW + GAP);
    const lbl = h === 0 ? '12a' : h === 6 ? '6a' : h === 12 ? '12p' : h === 18 ? '6p' : '';
    return `<rect x="${x}" y="0" width="${CW}" height="${H}" fill="${col}" opacity="${op}" rx="2"/>`
      + (lbl ? `<text x="${x + 5}" y="${H + 9}" text-anchor="middle" font-size="7.5" fill="#bbb">${lbl}</text>` : '');
  }).join('');

  const W = 24 * (CW + GAP) - GAP;
  return `<svg width="${W}" height="${H + 12}" style="display:block">${cells}</svg>`;
}

function buildSparkline(history) {
  if (!history || history.length < 2) {
    return `<div class="spark-empty">Collecting history…</div>`;
  }

  const W = 268, H = 44, PAD = 4;
  const pts = history.map(h => h.maxPct ?? 0);
  const maxVal = 100;

  const coords = pts.map((v, i) => {
    const x = (i / (pts.length - 1)) * W;
    const y = H - PAD - (v / maxVal) * (H - PAD * 2);
    return [+x.toFixed(1), +y.toFixed(1)];
  });

  const polyPts = coords.map(([x, y]) => `${x},${y}`).join(' ');
  const [fx, fy] = coords[0];
  const [lx] = coords[coords.length - 1];
  const areaD = `M ${fx},${fy} L ${coords.slice(1).map(([x,y])=>`${x},${y}`).join(' L ')} L ${lx},${H} L ${fx},${H} Z`;

  const latest = pts[pts.length - 1];
  const color = latest >= 90 ? '#ef4444' : latest >= 75 ? '#f59e0b' : '#3b82f6';
  const uid = `g${Math.random().toString(36).slice(2)}`;

  // Time label for oldest point
  const oldestTs = history[0]?.timestamp;
  const hoursAgo = oldestTs ? Math.round((Date.now() - oldestTs) / 3600000) : null;
  const timeLabel = hoursAgo != null ? `${hoursAgo}h ago` : '';

  return `
    <div class="spark-wrap">
      <svg width="${W}" height="${H}" style="display:block;overflow:visible">
        <defs>
          <linearGradient id="${uid}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${color}" stop-opacity="0.2"/>
            <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <path d="${areaD}" fill="url(#${uid})"/>
        <polyline points="${polyPts}" fill="none" stroke="${color}" stroke-width="1.5"
          stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <div class="spark-labels">
        <span>100%</span>
        <span>${timeLabel}</span>
      </div>
    </div>`;
}

function render() {
  chrome.storage.local.get(['usage', 'history', 'lastUpdated', 'burnWarning'], (local) => {
    chrome.storage.sync.get({ threshold1: 75, threshold2: 90 }, (prefs) => {
      const { usage, history = [], lastUpdated, burnWarning } = local;
      const { threshold1: t1, threshold2: t2 } = prefs;
      const root = document.getElementById('root');
      const ts = document.getElementById('ts');
      const banner = document.getElementById('burn-banner');

      // Burn warning banner
      if (burnWarning?.active && Date.now() - burnWarning.ts < 60 * 60_000) {
        banner.textContent = `⚡ Burning fast — on pace to hit ${t2}% in ~${burnWarning.minsLeft} min`;
        banner.classList.add('active');
      }

      if (!usage || !Object.keys(usage).length) {
        root.innerHTML = `
          <div class="no-data">
            No data yet.<br>Visit <strong>claude.ai/settings</strong><br>to sync your usage.
          </div>`;
        return;
      }

      const sessionKeys = ['session'];
      const weeklyKeys  = ['allModels', 'sonnet', 'opus'];
      const otherKeys   = Object.keys(usage).filter(k => !sessionKeys.includes(k) && !weeklyKeys.includes(k));

      let html = '';

      // Session — only render known keys
      const sessionEntries = ['session'].filter(k => usage[k]);
      if (sessionEntries.length) {
        html += `<div class="section"><div class="section-title">Current Session</div>`;
        for (const k of sessionEntries) {
          html += renderUsageRow(k, usage[k], t1, t2, false);
        }
        html += `</div>`;
      }

      // Weekly — only render known keys
      const weeklyEntries = ['allModels', 'sonnet', 'opus'].filter(k => usage[k]);
      if (weeklyEntries.length) {
        html += `<hr class="divider"><div class="section"><div class="section-title">Weekly Limits</div>`;
        for (const k of weeklyEntries) {
          const isBurning = burnWarning?.active && getPct(usage[k]) >= t1;
          html += renderUsageRow(k, usage[k], t1, t2, isBurning);
        }
        html += `</div>`;
      }

      // Runway
      html += `<hr class="divider">
        <div class="runway-section">
          <div class="section-title">Runway</div>
          ${buildRunway(usage, history, t2)}
        </div>`;

      // Sparkline
      if (history.length >= 2) {
        html += `<hr class="divider">
          <div class="spark-section">
            <div class="spark-title">History</div>
            ${buildSparkline(history.slice(-48))}
          </div>`;
      }

      // Heatmap
      html += `<hr class="divider">
        <div class="heatmap-section">
          <div class="section-title">Busiest Hours</div>
          ${buildHeatmap(history)}
        </div>`;

      root.innerHTML = html;

      if (lastUpdated) {
        const ago = Math.round((Date.now() - lastUpdated) / 60_000);
        ts.textContent = ago === 0 ? 'Updated just now' : `Updated ${ago}m ago`;
      }
    });
  });
}

// ── Event listeners ───────────────────────────────────────────────────────────

document.getElementById('gear').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
  window.close();
});

document.getElementById('btn-settings').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
  window.close();
});

document.getElementById('btn-copy').addEventListener('click', () => {
  chrome.storage.local.get(['usage', 'lastUpdated'], ({ usage, lastUpdated }) => {
    if (!usage) return;
    const lines = ['Claude Usage Summary'];
    const ago = lastUpdated ? Math.round((Date.now() - lastUpdated) / 60_000) : null;
    if (ago !== null) lines.push(`Updated: ${ago === 0 ? 'just now' : ago + 'm ago'}`);
    lines.push('');
    const order = ['session', 'allModels', 'sonnet', 'opus'];
    const labels = { session: 'Session', allModels: 'All Models', sonnet: 'Sonnet', opus: 'Opus' };
    for (const k of order) {
      if (!usage[k]) continue;
      const p = Math.round(getPct(usage[k]));
      const r = getReset(usage[k]);
      lines.push(`${labels[k]}: ${p}%${r ? '  (' + r + ')' : ''}`);
    }
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      const btn = document.getElementById('btn-copy');
      btn.textContent = 'Copied ✓';
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 2000);
    });
  });
});

document.getElementById('btn-refresh').addEventListener('click', () => {
  chrome.tabs.query({ url: 'https://claude.ai/settings/usage' }, (tabs) => {
    if (tabs.length) chrome.tabs.reload(tabs[0].id);
    else chrome.tabs.create({ url: 'https://claude.ai/settings/usage' });
  });
  window.close();
});

document.getElementById('btn-feedback').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://github.com/TraceCohenTech/claude-usage-monitor/issues/new' });
  window.close();
});

// Trigger a fresh scrape every time the popup opens
chrome.runtime.sendMessage({ type: 'REFRESH' });
render();
