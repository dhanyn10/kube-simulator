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

func TestProjectManager_Init_Error(t *testing.T) {
	// Mock HOME to a non-existent or restricted directory to trigger error
	originalHome := os.Getenv("HOME")
	os.Unsetenv("HOME")
	os.Unsetenv("USERPROFILE")
	defer os.Setenv("HOME", originalHome)

	pm := NewProjectManager()
	err := pm.Init()
	if err == nil {
		t.Error("Expected Init to fail with invalid HOME")
	}

	// Test case where UserHomeDir succeeds but MkdirAll fails (e.g. read-only path)
	tmpDir, _ := os.MkdirTemp("", "kube-builder-readonly-*")
	defer os.RemoveAll(tmpDir)

	// Create a file where the directory should be
	os.MkdirAll(filepath.Join(tmpDir, "restricted"), 0755)
	os.WriteFile(filepath.Join(tmpDir, "restricted", ".kube-builder"), []byte("not a dir"), 0644)

	os.Setenv("HOME", filepath.Join(tmpDir, "restricted"))
	pm2 := NewProjectManager()
	err2 := pm2.Init()
	if err2 == nil {
		t.Error("Expected Init to fail when MkdirAll fails")
	}

	// Test case where gorm.Open fails
	tmpDir3, _ := os.MkdirTemp("", "kube-builder-gormfail-*")
	defer os.RemoveAll(tmpDir3)
	os.Setenv("HOME", tmpDir3)

	// Create a directory where the db file should be
	os.MkdirAll(filepath.Join(tmpDir3, ".kube-builder", "app_data.db"), 0755)

	pm3 := NewProjectManager()
	err3 := pm3.Init()
	if err3 == nil {
		t.Error("Expected Init to fail when gorm.Open fails (db path is a directory)")
	}
}
