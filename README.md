# Claude Usage Monitor

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/lbbhdmlaboihngmdkkhjbgneondmhcjo?label=Chrome%20Web%20Store)](https://chromewebstore.google.com/detail/claude-usage-monitor/lbbhdmlaboihngmdkkhjbgneondmhcjo)
[![Chrome Web Store Users](https://img.shields.io/chrome-web-store/users/lbbhdmlaboihngmdkkhjbgneondmhcjo)](https://chromewebstore.google.com/detail/claude-usage-monitor/lbbhdmlaboihngmdkkhjbgneondmhcjo)
[![License: MIT](https://img.shields.io/badge/License-MIT-black.svg)](LICENSE)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey)

Never lose work mid-prompt. Live Claude.ai session & weekly usage bars, burn-rate warnings, reset timers, and history — right in your browser toolbar.

**[Install from Chrome Web Store →](https://chromewebstore.google.com/detail/claude-usage-monitor/lbbhdmlaboihngmdkkhjbgneondmhcjo)**

---

## What it shows

- **Live usage bars** — Current Session %, Weekly All Models %, Sonnet %, Opus %
- **Burn-rate engine** — "~2h 30m left at this rate" before you hit your limit
- **Smart alerts** — Desktop notification at configurable warning + critical thresholds
- **Usage history** — 48-point sparkline and 24-hour heatmap
- **macOS menu bar** — Optional SwiftBar plugin showing usage updated every minute

## Installation

### Chrome extension (all platforms)

Install directly from the [Chrome Web Store](https://chromewebstore.google.com/detail/claude-usage-monitor/lbbhdmlaboihngmdkkhjbgneondmhcjo).

Or load unpacked for development:
1. `chrome://extensions` → enable **Developer mode**
2. **Load unpacked** → select this repo folder
3. Visit `claude.ai/settings/usage` to trigger the first sync

**Keyboard shortcut:** `Cmd+Shift+U` (Mac) / `Ctrl+Shift+U` (Windows/Linux)

### macOS menu bar (optional)

Requires [SwiftBar](https://swiftbar.app) (free).

```bash
bash server/install.sh
```

This installs a local Python server as a LaunchAgent and copies the SwiftBar plugin automatically.

## How it works

1. A **Chrome extension** reads usage data from `claude.ai/settings/usage`
2. Usage is stored locally in `chrome.storage` — never sent externally
3. (Optional) A **local Python server** on port 39571 receives data for the menu bar
4. A **SwiftBar plugin** reads the cache every minute and displays it in your menu bar

## Privacy

Your Claude usage data never leaves your browser. See the full [privacy policy](https://tracecohentech.github.io/claude-usage-monitor/privacy_policy.html).

## Uninstall

Remove the extension from `chrome://extensions`.

To remove the menu bar server:
```bash
launchctl unload ~/Library/LaunchAgents/com.claude.usage-monitor.plist
rm ~/Library/LaunchAgents/com.claude.usage-monitor.plist
rm -rf ~/.claude-usage-monitor
```

## Built by

[Trace Cohen](https://x.com/Trace_Cohen) · [t@nyvp.com](mailto:t@nyvp.com)
