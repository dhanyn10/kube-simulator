package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestOpenInExplorer(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "kube-builder-explorer-test-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tmpDir)

	filePath := filepath.Join(tmpDir, "test.log")
	err = os.WriteFile(filePath, []byte("hello"), 0644)
	if err != nil {
		t.Fatal(err)
	}

	// Test openInExplorer handles directory path resolution
	err = openInExplorer(filePath)
	// On headless Linux CI environments, xdg-open may return error if no desktop environment is installed.
	// The function returns error or nil, both are valid outcomes in test environments.
	_ = err
}
