package db

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/dgraph-io/badger/v4"
)

func TestNewHistoryManager(t *testing.T) {
	hm := NewHistoryManager()
	if hm.currentIndex != -1 || hm.maxIndex != -1 {
		t.Errorf("Expected initial index -1, got current=%d max=%d", hm.currentIndex, hm.maxIndex)
	}
}

func TestHistoryManager_Init(t *testing.T) {
	originalHome := os.Getenv("HOME")
	tmpDir, _ := os.MkdirTemp("", "kube-builder-history-init-test-*")
	defer os.RemoveAll(tmpDir)

	os.Setenv("HOME", tmpDir)
	defer os.Setenv("HOME", originalHome)

	hm := NewHistoryManager()
	err := hm.Init()
	if err != nil {
		t.Fatalf("Init failed: %v", err)
	}
	defer hm.Close()

	dbPath := filepath.Join(tmpDir, ".kube-simulator", "history_db")
	if _, err := os.Stat(dbPath); os.IsNotExist(err) {
		t.Errorf("History database directory not created at %s", dbPath)
	}
}

func setupHistoryTest(t *testing.T) (*HistoryManager, func()) {
	tmpDir, err := os.MkdirTemp("", "badger-test-*")
	if err != nil {
		t.Fatal(err)
	}
	db, err := badger.Open(badger.DefaultOptions(tmpDir).WithLogger(nil))
	if err != nil {
		os.RemoveAll(tmpDir)
		t.Fatal(err)
	}
	hm := &HistoryManager{db: db, currentIndex: -1, maxIndex: -1}
	return hm, func() {
		hm.Close()
		os.RemoveAll(tmpDir)
	}
}

func TestHistoryManager_Push(t *testing.T) {
	hm, cleanup := setupHistoryTest(t)
	defer cleanup()

	hm.Push("state1")
	if hm.currentIndex != 0 || hm.maxIndex != 0 {
		t.Errorf("Expected index 0, got current=%d max=%d", hm.currentIndex, hm.maxIndex)
	}
	hm.Push("state2")
	if hm.currentIndex != 1 || hm.maxIndex != 1 {
		t.Errorf("Expected index 1, got current=%d max=%d", hm.currentIndex, hm.maxIndex)
	}
}

func TestHistoryManager_Undo(t *testing.T) {
	hm, cleanup := setupHistoryTest(t)
	defer cleanup()

	hm.Push("state1")
	hm.Push("state2")

	state := hm.Undo()
	if state != "state1" {
		t.Errorf("Expected state1, got %s", state)
	}
	if hm.currentIndex != 0 {
		t.Errorf("Expected index 0 after undo, got %d", hm.currentIndex)
	}
	if hm.Undo() != "" {
		t.Error("Expected empty state for undo at boundary")
	}
}

func TestHistoryManager_Redo(t *testing.T) {
	hm, cleanup := setupHistoryTest(t)
	defer cleanup()

	hm.Push("state1")
	hm.Push("state2")
	hm.Undo()

	state := hm.Redo()
	if state != "state2" {
		t.Errorf("Expected state2, got %s", state)
	}
	if hm.currentIndex != 1 {
		t.Errorf("Expected index 1 after redo, got %d", hm.currentIndex)
	}
	if hm.Redo() != "" {
		t.Error("Expected empty state for redo at boundary")
	}
}

func TestHistoryManager_JumpTo(t *testing.T) {
	hm, cleanup := setupHistoryTest(t)
	defer cleanup()

	hm.Push("state1")
	hm.Push("state2")

	if hm.JumpTo(0) != "state1" {
		t.Error("Expected state1 for JumpTo(0)")
	}
	if hm.JumpTo(1) != "state2" {
		t.Error("Expected state2 for JumpTo(1)")
	}
	if hm.JumpTo(999) != "" {
		t.Error("Expected empty state for invalid JumpTo index")
	}
}

func TestHistoryManager_Metadata(t *testing.T) {
	hm, cleanup := setupHistoryTest(t)
	defer cleanup()

	hm.Push("state1")
	if hm.GetMaxIndex() != 0 {
		t.Errorf("Expected max index 0, got %d", hm.GetMaxIndex())
	}
	if hm.GetDB() == nil {
		t.Error("GetDB returned nil")
	}
}

func TestHistoryManager_Uninitialized(t *testing.T) {
	hm := NewHistoryManager()
	if hm.Undo() != "" || hm.Redo() != "" || hm.JumpTo(0) != "" {
		t.Error("Uninitialized manager should return empty strings")
	}
	hm.Push("state")
	if hm.currentIndex != -1 {
		t.Error("Push should do nothing if db is nil")
	}
}
