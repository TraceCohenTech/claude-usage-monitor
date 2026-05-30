# Claude Usage Monitor

Track your Claude.ai plan usage in your macOS menu bar — shows session %, all-models %, reset times, discount, and more. Updates every minute.

![Menu bar showing Claude usage](https://img.shields.io/badge/platform-macOS-lightgrey) ![Chrome extension](https://img.shields.io/badge/Chrome-extension-blue)

## How it works

1. A **Chrome extension** intercepts usage data from `claude.ai/settings/usage`
2. A **local Python server** (port 39571) receives and caches that data
3. A **SwiftBar plugin** reads the cache every minute and displays it in your menu bar

## Requirements

- macOS
- Google Chrome
- [SwiftBar](https://swiftbar.app) (free menu bar plugin runner)
- Python 3 (pre-installed on macOS)

## Installation

### 1. Load the Chrome extension

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** → select this repo folder
4. Visit `claude.ai/settings/usage` to trigger the first sync

### 2. Install the server + SwiftBar plugin

```bash
bash server/install.sh
```

This will:
- Install the server as a macOS LaunchAgent (auto-starts on login)
- Copy the SwiftBar plugin to your plugins folder automatically (if SwiftBar is installed)

### 3. If SwiftBar isn't installed yet

1. Download and install [SwiftBar](https://swiftbar.app)
2. Choose a plugins folder when prompted
3. Copy the plugin manually:

```bash
cp swiftbar/claude-usage.1m.sh ~/path/to/your/swiftbar/plugins/
```

### 4. Sync data

Open Chrome and visit `claude.ai/settings/usage` — the extension will POST your usage data to the local server. The menu bar updates within 1 minute.

## What it shows

**Menu bar:** `☁ S:37%  A:21%` (session / all-models)

**Dropdown:**
- 🔵 Session usage + reset time
- ⚪ All Models usage + reset time  
- 🟣 Sonnet usage
- 🟢 Discount %
- 🟠 Threshold %
- 🟡 Used Credits
- Last updated timestamp

Color coding: green/normal → 🟡 75%+ → 🔴 90%+

## Uninstall

```bash
launchctl unload ~/Library/LaunchAgents/com.claude.usage-monitor.plist
rm ~/Library/LaunchAgents/com.claude.usage-monitor.plist
rm -rf ~/.claude-usage-monitor
```

Then remove the extension from `chrome://extensions` and delete the SwiftBar plugin from your plugins folder.
