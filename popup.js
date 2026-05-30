const LABEL = {
  session:   'Current Session',
  allModels: 'All Models',
  sonnet:    'Sonnet',
  opus:      'Opus',
};

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
  return '#111';
}

function renderUsageRow(key, entry, t1, t2, isBurning) {
  const pct = getPct(entry);
  const reset = getReset(entry);
  const cls = barClass(pct, t1, t2);
  const col = pctColor(pct, t1, t2);
  const name = LABEL[key] || key;
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
      ${reset ? `<div class="reset-time">${reset}</div>` : ''}
    </div>`;
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

      // Sparkline
      if (history.length >= 2) {
        html += `<hr class="divider">
          <div class="spark-section">
            <div class="spark-title">History</div>
            ${buildSparkline(history.slice(-48))}
          </div>`;
      }

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
  chrome.tabs.create({ url: 'https://claude.ai/settings/usage' });
  window.close();
});

document.getElementById('btn-refresh').addEventListener('click', () => {
  chrome.tabs.query({ url: 'https://claude.ai/settings/usage' }, (tabs) => {
    if (tabs.length) chrome.tabs.reload(tabs[0].id);
    else chrome.tabs.create({ url: 'https://claude.ai/settings/usage' });
  });
  window.close();
});

render();
