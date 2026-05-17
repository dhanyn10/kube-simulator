package main

import (
	"runtime"
	"testing"
)

func TestGetSystemInfo(t *testing.T) {
	app := NewApp()
	info := app.GetSystemInfo()

	if info["os"] != runtime.GOOS {
		t.Errorf("Expected os %s, got %s", runtime.GOOS, info["os"])
	}

	if info["arch"] != runtime.GOARCH {
		t.Errorf("Expected arch %s, got %s", runtime.GOARCH, info["arch"])
	}

	if info["goVersion"] != runtime.Version() {
		t.Errorf("Expected goVersion %s, got %s", runtime.Version(), info["goVersion"])
	}
}
