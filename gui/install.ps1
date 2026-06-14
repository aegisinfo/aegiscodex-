# AEGIS Code — Windows installer
# Run from the gui\ directory: .\install.ps1

$ErrorActionPreference = "Stop"
$DIR = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "Installing AEGIS Code (desktop)..."

# Verify Node.js
try { node --version | Out-Null } catch {
  Write-Error "Node.js not found. Install from https://nodejs.org (v22+)"
  exit 1
}

# Install npm deps if needed
$electronBin = Join-Path $DIR "node_modules\electron\dist\electron.exe"
if (-not (Test-Path $electronBin)) {
  Write-Host "  Installing dependencies..."
  Push-Location $DIR
  npm install --silent
  Pop-Location
}

if (-not (Test-Path $electronBin)) {
  Write-Error "Electron not found after install. Try: cd gui && npm install"
  exit 1
}

# Create config dir
$cfgDir = Join-Path $env:USERPROFILE ".aegiscode"
New-Item -ItemType Directory -Force -Path $cfgDir | Out-Null

# Create ags.bat launcher in %LOCALAPPDATA%\Programs\aegiscode\
$launchDir = Join-Path $env:LOCALAPPDATA "Programs\aegiscode"
New-Item -ItemType Directory -Force -Path $launchDir | Out-Null

$batPath = Join-Path $launchDir "ags.bat"
@"
@echo off
"$electronBin" --no-sandbox "$DIR" %*
"@ | Set-Content -Path $batPath -Encoding ASCII

# Add to user PATH if not present
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$launchDir*") {
  [Environment]::SetEnvironmentVariable("Path", "$userPath;$launchDir", "User")
  Write-Host "  Added $launchDir to user PATH"
}

Write-Host ""
Write-Host "  AEGIS Code installed."
Write-Host ""
Write-Host "  Open a new terminal and run:  ags"
Write-Host ""
Write-Host "  On first launch, go to Settings to add your API key."
Write-Host "  Memory and cloud sync: paste your API key in the Memory tab."
Write-Host ""
Write-Host "  More info: https://aegiscloud.org"
