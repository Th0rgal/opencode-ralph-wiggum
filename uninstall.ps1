# Uninstall script for OpenCode Ralph Wiggum (Windows)

$ErrorActionPreference = "Stop"

Write-Host "Uninstalling OpenCode Ralph Wiggum..."

# Determine OpenCode config directory (XDG-compatible)
$configRoot = if ($env:XDG_CONFIG_HOME) { $env:XDG_CONFIG_HOME } else { Join-Path $HOME ".config" }
$opencodeConfig = Join-Path $configRoot "opencode"

# Remove OpenCode commands
Write-Host "Removing OpenCode commands..."
Remove-Item -ErrorAction SilentlyContinue -Force (Join-Path $opencodeConfig "command/ralph-loop.md")
Remove-Item -ErrorAction SilentlyContinue -Force (Join-Path $opencodeConfig "command/cancel-ralph.md")
Remove-Item -ErrorAction SilentlyContinue -Force (Join-Path $opencodeConfig "command/help.md")

# Remove OpenCode plugin
Write-Host "Removing OpenCode plugin..."
Remove-Item -ErrorAction SilentlyContinue -Force (Join-Path $opencodeConfig "plugin/ralph-wiggum.ts")

# Unlink the package
Write-Host "Unlinking ralph command..."
bun unlink opencode-ralph-wiggum 2>$null

Write-Host ""
Write-Host "Uninstall complete!"
Write-Host "You may also want to remove the cloned repository."
