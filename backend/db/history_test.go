package db

import (
	"os"
	"testing"

	"github.com/dgraph-io/badger/v4"
)

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

	// Test Redo
	state = hm.Redo()
	if state != "state2" {
		t.Errorf("Expected state2, got %s", state)
	}
	if hm.currentIndex != 1 {
		t.Errorf("Expected current index 1 after redo, got %d", hm.currentIndex)
	}

	// Test JumpTo
	state = hm.JumpTo(0)
	if state != "state1" {
		t.Errorf("Expected state1, got %s", state)
	}

	// Test GetMaxIndex and GetDB
	if hm.GetMaxIndex() != 1 {
		t.Errorf("Expected max index 1, got %d", hm.GetMaxIndex())
	}
	if hm.GetDB() != db {
		t.Error("GetDB returned wrong database instance")
	}
}
