#!/bin/bash

# Exit on error
set -e

echo "🚀 Building Kube Simulator for Windows..."

# 1. Build Portable Version (Single EXE)
echo "📦 Building Portable Version..."
wails3 task windows:build

# The binary is placed in bin/
mkdir -p dist
cp bin/kube-simulator.exe dist/kube-simulator-portable.exe

# 2. Build NSIS Installer
echo "📦 Building NSIS Installer..."
wails3 task windows:package

# The installer is in build/bin/
cp "build/bin/Kube Simulator-amd64-installer.exe" dist/kube-simulator-installer.exe

echo "✅ Build complete! Files are in the 'dist' directory:"
ls -lh dist/
