package db

import (
	"build-wails/backend/logger"
	"fmt"
	"os"
	"path/filepath"

	"github.com/dgraph-io/badger/v4"
)

type HistoryLog struct {
	Index      int    `json:"index"`
	ActionName string `json:"actionName"`
	Timestamp  int64  `json:"timestamp"`
}

type HistoryManager struct {
	db           *badger.DB
	currentIndex int
	maxIndex     int
}

func NewHistoryManager() *HistoryManager {
	return &HistoryManager{
		currentIndex: -1,
		maxIndex:     -1,
	}
}

func (h *HistoryManager) Init() error {
	userHome, err := os.UserHomeDir()
	if err != nil {
		return err
	}
	dbPath := filepath.Join(userHome, ".kube-simulator", "history_db")
	os.MkdirAll(dbPath, os.ModePerm)

	opts := badger.DefaultOptions(dbPath).WithLogger(nil)
	db, err := badger.Open(opts)
	if err != nil {
		return err
	}
	h.db = db
	return nil
}

func (h *HistoryManager) Close() {
	if h.db != nil {
		h.db.Close()
	}
}

func (h *HistoryManager) Push(state string) {
	if h.db == nil {
		return
	}

	h.currentIndex++
	h.maxIndex = h.currentIndex

	err := h.db.Update(func(txn *badger.Txn) error {
		key := []byte(fmt.Sprintf("hist:%d", h.currentIndex))
		return txn.Set(key, []byte(state))
	})

	if err != nil {
		logger.Error("Error saving history: %v", err)
	}
}

func (h *HistoryManager) Undo() string {
	if h.db == nil || h.currentIndex <= 0 {
		return ""
	}

	h.currentIndex--
	return h.JumpTo(h.currentIndex)
}

func (h *HistoryManager) Redo() string {
	if h.db == nil || h.currentIndex >= h.maxIndex {
		return ""
	}

	h.currentIndex++
	return h.JumpTo(h.currentIndex)
}

func (h *HistoryManager) JumpTo(index int) string {
	if h.db == nil || index < 0 || index > h.maxIndex {
		return ""
	}

	h.currentIndex = index
	var state string

	err := h.db.View(func(txn *badger.Txn) error {
		key := []byte(fmt.Sprintf("hist:%d", h.currentIndex))
		item, err := txn.Get(key)
		if err != nil {
			return err
		}
		return item.Value(func(val []byte) error {
			state = string(val)
			return nil
		})
	})

	if err != nil {
		return ""
	}

	return state
}

func (h *HistoryManager) GetMaxIndex() int {
	return h.maxIndex
}

func (h *HistoryManager) GetDB() *badger.DB {
	return h.db
}
