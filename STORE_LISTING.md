# Chrome Web Store Listing — Claude Usage Monitor

## Name (45 chars max)
Claude Usage Monitor

## Short description (132 chars max — appears under extension name)
Never lose work mid-prompt. Live session & weekly usage bars, burn-rate alerts, and reset timers for Claude.ai — right in your toolbar.

---

## Full description (up to 16,000 chars)

### Stop losing work when Claude hits your limit.

Claude Usage Monitor gives you live visibility into your Claude.ai session and weekly usage — right in your browser toolbar — so you always know how much runway you have left before a prompt cuts out mid-answer.

Built by Trace Cohen (t@nyvp.com) as an open-source tool for heavy Claude users.

---

**WHAT IT DOES**

🔵 Live usage bars
See your Current Session %, Weekly All Models %, Sonnet %, and Opus % updated automatically — no manual page refreshes.

⚡ Burn-rate engine
Tracks how fast you're consuming your limits and tells you "~2h 30m left at this rate" so you can pace yourself or save work before an interruption.

🟡🔴 Smart threshold alerts
Get a desktop notification and an in-page warning banner at two configurable thresholds (default 75% and 90%). The banner appears directly on claude.ai so you can't miss it.

📈 Usage history & sparkline
48-point rolling history chart so you can see usage trends over the last several hours at a glance.

🕐 Busiest-hours heatmap
A 24-hour grid showing which hours of the day you burn usage fastest — handy for planning intensive work sessions.

🖥 macOS menu bar support (optional)
Works with SwiftBar or xbar to show your highest usage % in the menu bar. Includes an optional lightweight local Python server (runs entirely on 127.0.0.1, never sends data externally).

---

**PRIVACY**

Your Claude usage data never leaves your browser. All usage data is stored locally in chrome.storage — never uploaded, never tracked, never shared.

✅ Usage data stays 100% local — never sent externally
✅ No analytics, no advertising
✅ No account required — works immediately after install
✅ Full source code is open-source and publicly auditable on GitHub

Two small external events:
• An anonymous install ping (timestamp only) is sent when you first install, so the developer knows how many people use the extension.
• If you voluntarily fill out the "Stay in the Loop" contact form in Settings, your name, email, and zip are submitted so the developer can send product updates. This is entirely optional.

---

**PERMISSIONS EXPLAINED**

• storage — saves your local usage history and alert preferences
• notifications — desktop alerts when you approach a limit
• alarms — background checks every 5–20 minutes
• tabs — opens a silent background tab to refresh data; no browsing history is read or stored
• offscreen — optional audio beep (Web Audio API, no microphone access)
• claude.ai host permission — required to read your usage page

---

**HOW TO USE**

1. Install the extension
2. Visit claude.ai/settings/usage — data syncs automatically
3. The toolbar icon shows your highest usage %; click for the full breakdown
4. Adjust alert thresholds in Settings (gear icon)

Data refreshes automatically every 5 minutes when usage is high, 20 minutes otherwise.

---

**OPEN SOURCE**

Full source code: github.com/tracecohen/claude-usage-monitor
Privacy policy: [linked in listing]
Built by Trace Cohen · t@nyvp.com

---

## Category
Productivity

## Language
English

## Screenshots needed (1280x800 or 640x400)
1. Popup with usage bars showing ~70% session + runway calculator
2. In-page banner on claude.ai (yellow warning)
3. Options page showing threshold sliders
4. Popup showing sparkline + heatmap

## Privacy policy URL
https://tracecohentech.github.io/claude-usage-monitor/privacy_policy.html

## Single purpose description (for Web Store review)
"This extension reads usage percentage data from the claude.ai/settings/usage page and stores it locally to display usage history, burn-rate projections, and threshold alerts. An anonymous install ping and optional contact form submission may be sent to the developer."
