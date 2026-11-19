package service

import (
	"build-wails/backend/domain"
	"os"
	"testing"
)

type mockHistoryRepo struct {
	initCalled   bool
	closeCalled  bool
	pushedStates []string
	currentIndex int
	logs         []domain.HistoryLog
}

func (m *mockHistoryRepo) Init() error {
	m.initCalled = true
	return nil
}

func (m *mockHistoryRepo) Close() {
	m.closeCalled = true
}

func (m *mockHistoryRepo) Push(state string) {
	m.pushedStates = append(m.pushedStates, state)
	m.currentIndex++
}

func (m *mockHistoryRepo) Undo() string {
	if m.currentIndex > 0 {
		m.currentIndex--
		return m.pushedStates[m.currentIndex]
	}
	return ""
}

func (m *mockHistoryRepo) Redo() string {
	if m.currentIndex < len(m.pushedStates)-1 {
		m.currentIndex++
		return m.pushedStates[m.currentIndex]
	}
	return ""
}

func (m *mockHistoryRepo) JumpTo(index int) string {
	if index >= 0 && index < len(m.pushedStates) {
		m.currentIndex = index
		return m.pushedStates[index]
	}
	return ""
}

func (m *mockHistoryRepo) GetCurrentIndex() int {
	return m.currentIndex
}

func (m *mockHistoryRepo) GetHistoryLogs() []domain.HistoryLog {
	return m.logs
}

func TestHistoryService_WithMockRepository(t *testing.T) {
	mock := &mockHistoryRepo{
		currentIndex: -1,
		logs: []domain.HistoryLog{
			{Index: 0, ActionName: "Mock Action", Timestamp: 12345},
		},
	}

	svc := NewHistoryService(mock)
	if err := svc.Init(); err != nil || !mock.initCalled {
		t.Fatalf("Init failed or not forwarded to mock: %v", err)
	}

	if svc.GetRepository() != mock {
		t.Error("Expected GetRepository to return the injected mock repository")
	}

	// Since mock is not *db.HistoryManager, GetManager should return nil
	if svc.GetManager() != nil {
		t.Error("Expected GetManager to return nil for non-badger repository")
	}

	svc.Push("state-1")
	svc.Push("state-2")
	if svc.GetCurrentIndex() != 1 {
		t.Errorf("Expected current index 1, got %d", svc.GetCurrentIndex())
	}

	if undo := svc.Undo(); undo != "state-1" {
		t.Errorf("Expected state-1 on undo, got %q", undo)
	}
	if redo := svc.Redo(); redo != "state-2" {
		t.Errorf("Expected state-2 on redo, got %q", redo)
	}
	if jump := svc.JumpTo(0); jump != "state-1" {
		t.Errorf("Expected state-1 on jump, got %q", jump)
	}

	logs := svc.GetHistoryLogs()
	if len(logs) != 1 || logs[0].ActionName != "Mock Action" {
		t.Errorf("Unexpected logs: %+v", logs)
	}

	svc.Close()
	if !mock.closeCalled {
		t.Error("Expected Close to be forwarded to mock repository")
	}
}

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

	if svc.GetManager().GetDB() == nil {
		t.Error("Expected GetManager().GetDB() to return non-nil badger instance")
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

func TestHistoryService_CorruptedLogs(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "kube-history-corrupt-*")
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
	_ = svc.Init()
	defer svc.Close()

	// Push corrupted state (not JSON)
	svc.Push("corrupted non json history state")
	logs := svc.GetHistoryLogs()
	if len(logs) != 1 {
		t.Fatalf("Expected 1 log, got %d", len(logs))
	}
	if logs[0].ActionName != "Activity #0" {
		t.Errorf("Expected fallback name 'Activity #0', got %q", logs[0].ActionName)
	}
}
