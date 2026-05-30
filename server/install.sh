#!/bin/bash
# Installs the Claude Usage Server as a macOS LaunchAgent (auto-starts on login)
# and copies the SwiftBar plugin to the configured plugins folder.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_DEST="$HOME/.claude-usage-monitor/server.py"
PLIST_SRC="$SCRIPT_DIR/com.claude.usage-monitor.plist"
PLIST_DEST="$HOME/Library/LaunchAgents/com.claude.usage-monitor.plist"

# ── 1. Copy server script ───────────────────────────────────────────────────
mkdir -p -m 700 "$HOME/.claude-usage-monitor"
cp "$SCRIPT_DIR/claude-usage-server.py" "$SERVER_DEST"
chmod 700 "$SERVER_DEST"
echo "✓ Server script installed to $SERVER_DEST"

# ── 2. Create LaunchAgent plist ─────────────────────────────────────────────
cat > "$PLIST_DEST" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.claude.usage-monitor</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/python3</string>
    <string>${SERVER_DEST}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardErrorPath</key>
  <string>${HOME}/.claude-usage-monitor/server.log</string>
  <key>StandardOutPath</key>
  <string>${HOME}/.claude-usage-monitor/server.log</string>
</dict>
</plist>
PLIST
echo "✓ LaunchAgent plist written to $PLIST_DEST"

# ── 3. Load the LaunchAgent ──────────────────────────────────────────────────
launchctl unload "$PLIST_DEST" 2>/dev/null || true
launchctl load "$PLIST_DEST"
echo "✓ LaunchAgent loaded (server will start on login automatically)"

# ── 4. SwiftBar plugin ───────────────────────────────────────────────────────
SWIFTBAR_PLUGIN="$SCRIPT_DIR/../swiftbar/claude-usage.1m.sh"
XBAR_DIR="$HOME/Library/Application Support/xbar/plugins"
SWIFTBAR_DIR="$HOME/Library/Application Support/SwiftBar/Plugins"

if [ -d "$SWIFTBAR_DIR" ]; then
  cp "$SWIFTBAR_PLUGIN" "$SWIFTBAR_DIR/"
  chmod +x "$SWIFTBAR_DIR/claude-usage.1m.sh"
  echo "✓ SwiftBar plugin installed to $SWIFTBAR_DIR"
elif [ -d "$XBAR_DIR" ]; then
  cp "$SWIFTBAR_PLUGIN" "$XBAR_DIR/"
  chmod +x "$XBAR_DIR/claude-usage.1m.sh"
  echo "✓ xbar plugin installed to $XBAR_DIR"
else
  echo "⚠ SwiftBar/xbar not found. Manually copy swiftbar/claude-usage.1m.sh to your plugins folder."
  echo "  Download SwiftBar: https://swiftbar.app"
fi

echo ""
echo "Done! The Claude Usage Monitor server is running on port 39571."
echo "Open Chrome and visit claude.ai/settings to sync usage data."
