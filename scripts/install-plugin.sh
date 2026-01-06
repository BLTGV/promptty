#!/bin/bash
# Install the Promptty Claude Code plugin

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_SRC="$SCRIPT_DIR/../claude-code-plugin"
PLUGIN_DEST="$HOME/.claude/plugins/promptty"

echo "Installing Promptty Claude Code plugin..."

# Check if source exists
if [ ! -d "$PLUGIN_SRC" ]; then
    echo "Error: Plugin source directory not found: $PLUGIN_SRC"
    exit 1
fi

# Verify plugin structure
if [ ! -f "$PLUGIN_SRC/.claude-plugin/plugin.json" ]; then
    echo "Error: Invalid plugin structure - missing .claude-plugin/plugin.json"
    exit 1
fi

# Create plugins directory if needed
mkdir -p "$HOME/.claude/plugins"

# Check if already installed
if [ -d "$PLUGIN_DEST" ]; then
    echo "Plugin already installed at $PLUGIN_DEST"
    read -p "Replace existing installation? [y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 0
    fi
    rm -rf "$PLUGIN_DEST"
fi

# Copy plugin files
cp -r "$PLUGIN_SRC" "$PLUGIN_DEST"

echo "Plugin installed successfully to: $PLUGIN_DEST"
echo ""
echo "Plugin structure:"
echo "  .claude-plugin/plugin.json  - Plugin manifest"
echo "  .mcp.json                   - MCP server configuration"
echo "  skills/                     - Agent skills"
echo ""
echo "The plugin provides these MCP tools when running via Promptty:"
echo "  - post_update: Send progress updates to the chat"
echo "  - send_message: Send messages to other channels"
echo "  - list_channels: List available channels"
echo ""
echo "Restart Claude Code to load the plugin."
