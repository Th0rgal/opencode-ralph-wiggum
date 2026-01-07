#!/bin/bash
# Uninstall script for OpenCode Ralph Wiggum

set -e

echo "Uninstalling OpenCode Ralph Wiggum..."

# Determine OpenCode config directory (XDG-compatible)
OPENCODE_CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/opencode"

# Remove OpenCode commands
echo "Removing OpenCode commands..."
rm -f "$OPENCODE_CONFIG_DIR/command/ralph-loop.md"
rm -f "$OPENCODE_CONFIG_DIR/command/cancel-ralph.md"
rm -f "$OPENCODE_CONFIG_DIR/command/help.md"

# Remove OpenCode plugin
echo "Removing OpenCode plugin..."
rm -f "$OPENCODE_CONFIG_DIR/plugin/ralph-wiggum.ts"

# Unlink the package
echo "Unlinking ralph command..."
bun unlink opencode-ralph-wiggum 2>/dev/null || true

echo ""
echo "Uninstall complete!"
echo "You may also want to remove the cloned repository."
