package service

import (
	"build-wails/backend/db"
)

// HistoryService manages state snapshots, undo/redo navigation, and audit log generation.
type HistoryService struct {
	manager *db.HistoryManager
}

// NewHistoryService constructs a new HistoryService.
func NewHistoryService(manager *db.HistoryManager) *HistoryService {
	if manager == nil {
		manager = db.NewHistoryManager()
	}
	return &HistoryService{manager: manager}
}

// Init initializes the underlying history database.
func (s *HistoryService) Init() error {
	return s.manager.Init()
}

// Close closes the underlying history database.
func (s *HistoryService) Close() {
	s.manager.Close()
}

// GetManager returns the underlying HistoryManager for database-level inspection or tests.
func (s *HistoryService) GetManager() *db.HistoryManager {
	return s.manager
}

// Push records a new history state.
func (s *HistoryService) Push(state string) {
	s.manager.Push(state)
}

// Undo steps backward in history.
func (s *HistoryService) Undo() string {
	return s.manager.Undo()
}

// Redo steps forward in history.
func (s *HistoryService) Redo() string {
	return s.manager.Redo()
}

// JumpTo jumps to a specific history index.
func (s *HistoryService) JumpTo(index int) string {
	return s.manager.JumpTo(index)
}

// GetCurrentIndex returns the current active history index.
func (s *HistoryService) GetCurrentIndex() int {
	return s.manager.GetCurrentIndex()
}

// GetHistoryLogs extracts structured activity logs from the recorded history snapshots.
func (s *HistoryService) GetHistoryLogs() []db.HistoryLog {
	return s.manager.GetHistoryLogs()
}
