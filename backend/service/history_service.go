package service

import (
	"build-wails/backend/db"
	"build-wails/backend/domain"
)

// HistoryService manages state snapshots, undo/redo navigation, and audit log generation.
type HistoryService struct {
	repo domain.HistoryRepository
}

// NewHistoryService constructs a new HistoryService with an injected HistoryRepository.
func NewHistoryService(repo domain.HistoryRepository) *HistoryService {
	if repo == nil {
		repo = db.NewHistoryManager()
	}
	return &HistoryService{repo: repo}
}

// Init initializes the underlying history repository.
func (s *HistoryService) Init() error {
	return s.repo.Init()
}

// Close closes the underlying history repository.
func (s *HistoryService) Close() {
	s.repo.Close()
}

// GetRepository returns the underlying HistoryRepository.
func (s *HistoryService) GetRepository() domain.HistoryRepository {
	return s.repo
}

// GetManager returns the underlying repository as *db.HistoryManager when applicable (e.g. for low-level db fixtures).
func (s *HistoryService) GetManager() *db.HistoryManager {
	if mgr, ok := s.repo.(*db.HistoryManager); ok {
		return mgr
	}
	return nil
}

// Push records a new history state.
func (s *HistoryService) Push(state string) {
	s.repo.Push(state)
}

// Undo steps backward in history.
func (s *HistoryService) Undo() string {
	return s.repo.Undo()
}

// Redo steps forward in history.
func (s *HistoryService) Redo() string {
	return s.repo.Redo()
}

// JumpTo jumps to a specific history index.
func (s *HistoryService) JumpTo(index int) string {
	return s.repo.JumpTo(index)
}

// GetCurrentIndex returns the current active history index.
func (s *HistoryService) GetCurrentIndex() int {
	return s.repo.GetCurrentIndex()
}

// GetHistoryLogs extracts structured activity logs from the recorded history snapshots.
func (s *HistoryService) GetHistoryLogs() []domain.HistoryLog {
	return s.repo.GetHistoryLogs()
}
