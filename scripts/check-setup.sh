#!/bin/bash
# Promptty Setup Checker
# This script verifies that Promptty and Claude Code are properly configured.

set -e

echo "=== Promptty Setup Checker ==="
echo ""

# Check for required tools
echo "1. Checking required tools..."

if command -v bun &> /dev/null; then
    echo "   [OK] Bun is installed: $(bun --version)"
else
    echo "   [ERROR] Bun is not installed. Install from https://bun.sh"
    exit 1
fi

if command -v claude &> /dev/null; then
    echo "   [OK] Claude Code is installed"
else
    echo "   [WARNING] Claude Code CLI not found in PATH"
fi

echo ""

# Check for config file
echo "2. Checking configuration..."

CONFIG_PATH="${CONFIG_PATH:-./config.json}"
if [ -f "$CONFIG_PATH" ]; then
    echo "   [OK] Config file found: $CONFIG_PATH"

    # Validate JSON
    if bun -e "JSON.parse(require('fs').readFileSync('$CONFIG_PATH', 'utf8'))" &> /dev/null; then
        echo "   [OK] Config file is valid JSON"
    else
        echo "   [ERROR] Config file is not valid JSON"
        exit 1
    fi

    # Check for channels
    CHANNEL_COUNT=$(bun -e "console.log(Object.keys(JSON.parse(require('fs').readFileSync('$CONFIG_PATH', 'utf8')).channels || {}).length)")
    echo "   [OK] Found $CHANNEL_COUNT channel configuration(s)"
else
    echo "   [WARNING] No config.json found. Copy config.example.json to config.json"
fi

echo ""

# Check environment variables
echo "3. Checking environment variables..."

check_env() {
    local var_name=$1
    local required=$2
    if [ -n "${!var_name}" ]; then
        echo "   [OK] $var_name is set"
        return 0
    else
        if [ "$required" = "required" ]; then
            echo "   [ERROR] $var_name is not set (required)"
            return 1
        else
            echo "   [INFO] $var_name is not set (optional)"
            return 0
        fi
    fi
}

ERRORS=0

# Slack variables (at least one set means Slack is configured)
if [ -n "$SLACK_APP_TOKEN" ] || [ -n "$SLACK_BOT_TOKEN" ]; then
    echo "   Slack configuration detected:"
    check_env "SLACK_APP_TOKEN" "required" || ERRORS=$((ERRORS+1))
    check_env "SLACK_BOT_TOKEN" "required" || ERRORS=$((ERRORS+1))
    check_env "SLACK_SIGNING_SECRET" "optional"
else
    echo "   [INFO] Slack not configured (SLACK_APP_TOKEN/SLACK_BOT_TOKEN not set)"
fi

# Teams variables
if [ -n "$TEAMS_APP_ID" ] || [ -n "$TEAMS_APP_PASSWORD" ]; then
    echo "   Teams configuration detected:"
    check_env "TEAMS_APP_ID" "required" || ERRORS=$((ERRORS+1))
    check_env "TEAMS_APP_PASSWORD" "required" || ERRORS=$((ERRORS+1))
else
    echo "   [INFO] Teams not configured (TEAMS_APP_ID/TEAMS_APP_PASSWORD not set)"
fi

# Check that at least one platform is configured
if [ -z "$SLACK_APP_TOKEN" ] && [ -z "$SLACK_BOT_TOKEN" ] && [ -z "$TEAMS_APP_ID" ]; then
    echo "   [WARNING] Neither Slack nor Teams credentials are configured"
fi

echo ""

# Check for Claude Code plugin
echo "4. Checking Claude Code plugin installation..."

PLUGIN_DIR="$HOME/.claude/plugins/promptty"
if [ -d "$PLUGIN_DIR" ]; then
    echo "   [OK] Plugin directory exists: $PLUGIN_DIR"
    if [ -f "$PLUGIN_DIR/plugin.json" ]; then
        echo "   [OK] plugin.json found"
    else
        echo "   [WARNING] plugin.json not found in plugin directory"
    fi
else
    echo "   [INFO] Plugin not installed in ~/.claude/plugins/promptty"
    echo "   To install: claude plugins install ./claude-code-plugin"
fi

echo ""

# Check callback server
echo "5. Checking callback server..."

CALLBACK_PORT="${CALLBACK_PORT:-3001}"
if curl -s "http://127.0.0.1:$CALLBACK_PORT/health" &> /dev/null; then
    echo "   [OK] Callback server is running on port $CALLBACK_PORT"
else
    echo "   [INFO] Callback server is not running (start with: bun run start)"
fi

echo ""

# Summary
echo "=== Summary ==="
if [ $ERRORS -eq 0 ]; then
    echo "Setup looks good! Start Promptty with: bun run start"
else
    echo "Found $ERRORS error(s). Please fix them before starting Promptty."
    exit 1
fi
