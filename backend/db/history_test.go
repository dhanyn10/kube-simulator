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

	dbPath := filepath.Join(tmpDir, ".kube-builder", "history_db")
	if _, err := os.Stat(dbPath); os.IsNotExist(err) {
		t.Errorf("History database directory not created at %s", dbPath)
	}
}

func TestHistoryManager(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "badger-test-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tmpDir)

	db, err := badger.Open(badger.DefaultOptions(tmpDir).WithLogger(nil))
	if err != nil {
		t.Fatal(err)
	}

	hm := &HistoryManager{
		db:           db,
		currentIndex: -1,
		maxIndex:     -1,
	}
	defer hm.Close()

	// Test Push
	hm.Push("state1")
	if hm.currentIndex != 0 || hm.maxIndex != 0 {
		t.Errorf("Expected index 0, got current=%d max=%d", hm.currentIndex, hm.maxIndex)
	}

	hm.Push("state2")
	if hm.currentIndex != 1 || hm.maxIndex != 1 {
		t.Errorf("Expected index 1, got current=%d max=%d", hm.currentIndex, hm.maxIndex)
	}

	// Test Undo
	state := hm.Undo()
	if state != "state1" {
		t.Errorf("Expected state1, got %s", state)
	}
	if hm.currentIndex != 0 {
		t.Errorf("Expected current index 0 after undo, got %d", hm.currentIndex)
	}

	// Undo at boundary
	state = hm.Undo()
	if state != "" {
		t.Errorf("Expected empty state for undo at boundary, got %s", state)
	}

	// Test Redo
	state = hm.Redo()
	if state != "state2" {
		t.Errorf("Expected state2, got %s", state)
	}
	if hm.currentIndex != 1 {
		t.Errorf("Expected current index 1 after redo, got %d", hm.currentIndex)
	}

	// Redo at boundary
	state = hm.Redo()
	if state != "" {
		t.Errorf("Expected empty state for redo at boundary, got %s", state)
	}

	// Test JumpTo
	state = hm.JumpTo(0)
	if state != "state1" {
		t.Errorf("Expected state1, got %s", state)
	}

	// JumpTo invalid index
	state = hm.JumpTo(999)
	if state != "" {
		t.Errorf("Expected empty state for jump to invalid index, got %s", state)
	}

	// Test GetMaxIndex and GetDB
	if hm.GetMaxIndex() != 1 {
		t.Errorf("Expected max index 1, got %d", hm.GetMaxIndex())
	}
	if hm.GetDB() != db {
		t.Error("GetDB returned wrong database instance")
	}
}

func TestHistoryManager_Uninitialized(t *testing.T) {
	hm := NewHistoryManager()
	// db is nil

	hm.Push("state")
	if hm.currentIndex != -1 {
		t.Error("Push should do nothing if db is nil")
	}

	if hm.Undo() != "" {
		t.Error("Undo should return empty if db is nil")
	}

	if hm.Redo() != "" {
		t.Error("Redo should return empty if db is nil")
	}

	if hm.JumpTo(0) != "" {
		t.Error("JumpTo should return empty if db is nil")
	}
}
