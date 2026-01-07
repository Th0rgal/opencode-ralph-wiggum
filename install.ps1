# Install script for OpenCode Ralph Wiggum (Windows)

$ErrorActionPreference = "Stop"

Write-Host "Installing OpenCode Ralph Wiggum..."

# Check for Bun
if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
  Write-Error "Bun is required but not installed. Install Bun: https://bun.sh"
  exit 1
}

# Check for OpenCode
if (-not (Get-Command opencode -ErrorAction SilentlyContinue)) {
  Write-Error "OpenCode is required but not installed. Install OpenCode: npm install -g opencode-ai"
  exit 1
}

# Get script directory
$scriptDir = $PSScriptRoot

# Install dependencies
Write-Host "Installing dependencies..."
Push-Location $scriptDir
bun install

# Link the package (makes 'ralph' command available)
Write-Host "Linking ralph command..."
bun link

# Determine OpenCode config directory (XDG-compatible)
$configRoot = if ($env:XDG_CONFIG_HOME) { $env:XDG_CONFIG_HOME } else { Join-Path $HOME ".config" }
$opencodeConfig = Join-Path $configRoot "opencode"

# Install OpenCode commands globally
Write-Host "Installing OpenCode commands..."
$commandDir = Join-Path $opencodeConfig "command"
New-Item -ItemType Directory -Force -Path $commandDir | Out-Null
Copy-Item -Force (Join-Path $scriptDir ".opencode/command/*.md") $commandDir

# Install OpenCode plugin globally
Write-Host "Installing OpenCode plugin..."
$pluginDir = Join-Path $opencodeConfig "plugin"
New-Item -ItemType Directory -Force -Path $pluginDir | Out-Null
Copy-Item -Force (Join-Path $scriptDir ".opencode/plugin/*.ts") $pluginDir

Pop-Location

Write-Host ""
Write-Host "Installation complete!"
Write-Host ""
Write-Host "Usage:"
Write-Host ""
Write-Host "  CLI Loop (external):"
Write-Host "    ralph \"Your task\" --max-iterations 10"
Write-Host "    ralph --help"
Write-Host ""
Write-Host "  Plugin Loop (in-session):"
Write-Host "    In OpenCode, use the ralph_start tool"
Write-Host "    Or use /ralph-loop command"
Write-Host ""
Write-Host "OpenCode commands installed:"
Write-Host "  /ralph-loop - Start a Ralph loop"
Write-Host "  /cancel-ralph - Cancel active loop"
Write-Host "  /help - Show help"
Write-Host ""
Write-Host "Plugin tools available:"
Write-Host "  ralph_start - Start a loop in-session"
Write-Host "  ralph_status - Check loop status"
Write-Host "  ralph_cancel - Cancel the loop"
Write-Host ""
Write-Host "Learn more: https://ghuntley.com/ralph/"
