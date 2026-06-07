package db

import (
	"os"
	"path/filepath"
	"testing"
)

func TestHistoryManager_Init(t *testing.T) {
	originalHome := os.Getenv("HOME")
	tmpDir, _ := os.MkdirTemp("", "kube-builder-history-init-test-*")
	defer os.RemoveAll(tmpDir)

	os.Setenv("HOME", tmpDir)
	defer os.Setenv("HOME", originalHome)

	hm := NewHistoryManager()
	if hm == nil {
		t.Fatal("NewHistoryManager returned nil")
	}

	err := hm.Init()
	if err != nil {
		t.Fatalf("Init failed: %v", err)
	}
	defer hm.Close()

	dbPath := filepath.Join(tmpDir, ".kube-builder", "history_db")
	if _, err := os.Stat(dbPath); os.IsNotExist(err) {
		t.Errorf("History database directory not created at %s", dbPath)
	}
}
