package db

import (
	"os"
	"path/filepath"
	"testing"
)

func TestNewProjectManager(t *testing.T) {
	pm := NewProjectManager()
	if pm == nil {
		t.Fatal("NewProjectManager returned nil")
	}
}

func TestProjectManager_Init(t *testing.T) {
	// Mock HOME for Init test to avoid messing with real user home
	originalHome := os.Getenv("HOME")
	tmpDir, _ := os.MkdirTemp("", "kube-builder-init-test-*")
	defer os.RemoveAll(tmpDir)

	os.Setenv("HOME", tmpDir)
	defer os.Setenv("HOME", originalHome)

	pm := NewProjectManager()
	err := pm.Init()
	if err != nil {
		t.Fatalf("Init failed: %v", err)
	}
	defer pm.Close()

	dbPath := filepath.Join(tmpDir, ".kube-builder", "app_data.db")
	if _, err := os.Stat(dbPath); os.IsNotExist(err) {
		t.Errorf("Database file not created at %s", dbPath)
	}
}
