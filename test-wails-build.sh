#!/bin/bash
set -e

# Setup PATH for Go bin
GOPATH=$(go env GOPATH)
export PATH=$PATH:$GOPATH/bin

# Check if wails is installed
if ! command -v wails &> /dev/null; then
    echo "Wails not found, installing..."
    go install github.com/wailsapp/wails/v2/cmd/wails@latest
else
    echo "Wails already installed: $(wails version)"
fi

echo "Running Wails build test (Linux amd64)..."

# Ensure frontend dist exists for embed
mkdir -p frontend/dist
touch frontend/dist/index.html

# Target linux/amd64 as it's the native platform of the CI runner.
# We skip frontend build (-s) but NOT bindings generation.
# We expect this to pass in CI because libgtk-3-dev and libwebkit2gtk-4.1-dev are installed in the workflow.
wails build -s -platform linux/amd64 -nopackage

echo "✅ Wails build test passed!"
