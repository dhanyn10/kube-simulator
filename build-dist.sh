#!/bin/bash

# Exit on error
set -e

echo "🚀 Building Kube Simulator for Windows..."

# 1. Build Portable Version (Single EXE)
echo "📦 Building Portable Version..."
wails build -platform windows/amd64 -clean

# The portable exe is usually in build/bin/
# We copy it to a more descriptive name
mkdir -p dist
cp build/bin/kube-simulator.exe dist/kube-simulator-portable.exe

# 2. Build NSIS Installer
echo "📦 Building NSIS Installer..."
wails build -platform windows/amd64 -nsis

# The installer is usually in build/bin/
cp build/bin/kube-simulator-amd64-installer.exe dist/kube-simulator-installer.exe

echo "✅ Build complete! Files are in the 'dist' directory:"
ls -lh dist/
