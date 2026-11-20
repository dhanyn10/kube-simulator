# Build Kube Simulator for Windows

$ErrorActionPreference = "Stop"

Write-Host "🚀 Building Kube Simulator for Windows..." -ForegroundColor Cyan

# 1. Build Portable Version (Single EXE)
Write-Host "📦 Building Portable Version..." -ForegroundColor Green
wails3 task windows:build

# The binary is placed in bin/
if (-not (Test-Path dist)) {
    New-Item -ItemType Directory -Path dist | Out-Null
}
Copy-Item bin/kube-simulator.exe dist/kube-simulator-portable.exe -Force

# 2. Build NSIS Installer
Write-Host "📦 Building NSIS Installer..." -ForegroundColor Green
wails3 task windows:package

# The installer is in build/bin/
Copy-Item "build/bin/Kube Simulator-amd64-installer.exe" dist/kube-simulator-installer.exe -Force

Write-Host "✅ Build complete! Files are in the 'dist' directory:" -ForegroundColor Green
Get-ChildItem dist
