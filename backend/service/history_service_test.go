package service

import (
	"os"
	"testing"
)

func TestHistoryService_WithDB(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "kube-history-test-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tmpDir)

	oldHome := os.Getenv("HOME")
	oldUserProfile := os.Getenv("USERPROFILE")
	os.Setenv("HOME", tmpDir)
	os.Setenv("USERPROFILE", tmpDir)
	defer func() {
		os.Setenv("HOME", oldHome)
		os.Setenv("USERPROFILE", oldUserProfile)
	}()

	svc := NewHistoryService(nil)
	if err := svc.Init(); err != nil {
		t.Fatalf("Failed to init history db: %v", err)
	}
	defer svc.Close()

	if svc.GetDB() == nil {
		t.Error("Expected GetDB to return non-nil badger instance")
	}

	// 1. Initial history
	if svc.GetCurrentIndex() != -1 {
		t.Errorf("Expected current index -1 initially, got %d", svc.GetCurrentIndex())
	}

	// 2. Push history states
	svc.Push(`{"actionName":"Add Pod","timestamp":1000}`)
	svc.Push(`{"actionName":"Connect Service","timestamp":2000}`)

	if svc.GetCurrentIndex() != 1 {
		t.Errorf("Expected current index 1, got %d", svc.GetCurrentIndex())
	}

	// 3. Navigation
	undoVal := svc.Undo()
	if undoVal == "" {
		t.Error("Expected non-empty undo state")
	}
	if svc.GetCurrentIndex() != 0 {
		t.Errorf("Expected index 0 after undo, got %d", svc.GetCurrentIndex())
	}

	redoVal := svc.Redo()
	if redoVal == "" {
		t.Error("Expected non-empty redo state")
	}
	if svc.GetCurrentIndex() != 1 {
		t.Errorf("Expected index 1 after redo, got %d", svc.GetCurrentIndex())
	}

	jumpVal := svc.JumpTo(0)
	if jumpVal == "" {
		t.Error("Expected non-empty jump state")
	}
	if svc.GetCurrentIndex() != 0 {
		t.Errorf("Expected index 0 after jump, got %d", svc.GetCurrentIndex())
	}

	// 4. GetHistoryLogs
	logs := svc.GetHistoryLogs()
	if len(logs) != 2 {
		t.Fatalf("Expected 2 logs, got %d", len(logs))
	}
	if logs[0].ActionName != "Add Pod" || logs[0].Timestamp != 1000 {
		t.Errorf("Unexpected log 0: %+v", logs[0])
	}
	if logs[1].ActionName != "Connect Service" || logs[1].Timestamp != 2000 {
		t.Errorf("Unexpected log 1: %+v", logs[1])
	}
}

func TestHistoryService_NoDB(t *testing.T) {
	svc := NewHistoryService(nil)
	logs := svc.GetHistoryLogs()
	if len(logs) != 0 {
		t.Errorf("Expected 0 logs when DB is not initialized, got %d", len(logs))
	}
}
