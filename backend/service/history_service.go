package service

import (
	"encoding/json"
	"fmt"

	"build-wails/backend/db"

	"github.com/dgraph-io/badger/v4"
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

// GetDB returns the underlying Badger database reference.
func (s *HistoryService) GetDB() *badger.DB {
	return s.manager.GetDB()
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
	badgerDB := s.manager.GetDB()
	if badgerDB == nil {
		return []db.HistoryLog{}
	}

	logs := make([]db.HistoryLog, 0)
	maxIndex := s.manager.GetMaxIndex()

	_ = badgerDB.View(func(txn *badger.Txn) error {
		for i := 0; i <= maxIndex; i++ {
			key := []byte(fmt.Sprintf("hist:%d", i))
			item, err := txn.Get(key)
			if err != nil {
				continue
			}
			_ = item.Value(func(val []byte) error {
				var data struct {
					ActionName string `json:"actionName"`
					Timestamp  int64  `json:"timestamp"`
				}
				if err := json.Unmarshal(val, &data); err == nil {
					logs = append(logs, db.HistoryLog{
						Index:      i,
						ActionName: data.ActionName,
						Timestamp:  data.Timestamp,
					})
				} else {
					logs = append(logs, db.HistoryLog{
						Index:      i,
						ActionName: fmt.Sprintf("Activity #%d", i),
						Timestamp:  0,
					})
				}
				return nil
			})
		}
		return nil
	})
	return logs
}
