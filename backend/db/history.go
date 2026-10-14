package db

import (
	"build-wails/backend/logger"
	"fmt"
	"os"
	"path/filepath"

	"github.com/dgraph-io/badger/v4"
)

// HistoryLog represents a single recorded history action entry for display in history panels.
type HistoryLog struct {
	Index      int    `json:"index"`
	ActionName string `json:"actionName"`
	Timestamp  int64  `json:"timestamp"`
}

// HistoryManager manages the persistent undo/redo history stack using an embedded Badger DB instance.
type HistoryManager struct {
	db           *badger.DB
	currentIndex int
	maxIndex     int
}

// NewHistoryManager creates and initializes a new HistoryManager instance with default indices.
func NewHistoryManager() *HistoryManager {
	return &HistoryManager{
		currentIndex: -1,
		maxIndex:     -1,
	}
}

// isCorruptFile inspects a database file to check if it consists entirely of trailing zero bytes resulting from an unclean shutdown.
func isCorruptFile(path string) bool {
	info, err := os.Stat(path)
	if err != nil || info.IsDir() || info.Size() == 0 {
		return false
	}

	file, err := os.Open(path)
	if err != nil {
		return true
	}
	defer file.Close()

	fileSize := info.Size()
	readLen := int64(64)
	if fileSize < readLen {
		readLen = fileSize
	}

	buf := make([]byte, readLen)
	_, err = file.ReadAt(buf, fileSize-readLen)
	if err != nil {
		return true
	}

	for _, byteVal := range buf {
		if byteVal != 0 {
			return false
		}
	}
	return true
}

// isCorruptBadgerDir checks if any critical SST, MANIFEST, or KEYREGISTRY file within the Badger DB directory is corrupt.
func isCorruptBadgerDir(dbPath string) bool {
	entries, err := os.ReadDir(dbPath)
	if err != nil {
		return false
	}

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		ext := filepath.Ext(entry.Name())
		if ext == ".sst" || entry.Name() == "MANIFEST" || entry.Name() == "KEYREGISTRY" {
			filePath := filepath.Join(dbPath, entry.Name())
			if isCorruptFile(filePath) {
				return true
			}
		}
	}
	return false
}

// openBadger attempts to open a Badger DB instance while safely recovering from potential initialization panics.
func openBadger(opts badger.Options) (db *badger.DB, err error) {
	defer func() {
		if recoveredErr := recover(); recoveredErr != nil {
			err = fmt.Errorf("badger open panicked: %v", recoveredErr)
		}
	}()
	return badger.Open(opts)
}

// Init initializes the history database directory in ~/.kube-simulator/history_db and opens the Badger database instance.
func (historyMgr *HistoryManager) Init() error {
	userHome, err := os.UserHomeDir()
	if err != nil {
		return err
	}
	dbPath := filepath.Join(userHome, ".kube-simulator", "history_db")
	fileInfo, statErr := os.Stat(dbPath)
	if statErr == nil && !fileInfo.IsDir() {
		return fmt.Errorf("%s is a file, not a directory", dbPath)
	}
	os.MkdirAll(dbPath, os.ModePerm)

	if isCorruptBadgerDir(dbPath) {
		logger.Warn("Corrupted history_db detected (zero-filled SST file), resetting history database...")
		os.RemoveAll(dbPath)
		os.MkdirAll(dbPath, os.ModePerm)
	}

	opts := badger.DefaultOptions(dbPath).WithLogger(nil)
	db, err := openBadger(opts)
	if err != nil {
		logger.Warn("Failed to open history_db (%v), resetting history database...", err)
		os.RemoveAll(dbPath)
		os.MkdirAll(dbPath, os.ModePerm)
		db, err = openBadger(opts)
		if err != nil {
			logger.Error("Could not initialize history_db after reset: %v", err)
			return err
		}
	}
	historyMgr.db = db
	return nil
}

// Close gracefully closes the underlying Badger database instance if open.
func (historyMgr *HistoryManager) Close() {
	if historyMgr.db != nil {
		historyMgr.db.Close()
	}
}

// Push records a new state snapshot into the history database and updates the current and maximum history indices.
func (historyMgr *HistoryManager) Push(state string) {
	if historyMgr.db == nil {
		return
	}

	historyMgr.currentIndex++
	historyMgr.maxIndex = historyMgr.currentIndex

	err := historyMgr.db.Update(func(txn *badger.Txn) error {
		key := []byte(fmt.Sprintf("hist:%d", historyMgr.currentIndex))
		return txn.Set(key, []byte(state))
	})

	if err != nil {
		logger.Error("Error saving history: %v", err)
	}
}

// Undo moves one step back in the history stack and returns the previous state string.
func (historyMgr *HistoryManager) Undo() string {
	if historyMgr.db == nil || historyMgr.currentIndex <= 0 {
		return ""
	}

	historyMgr.currentIndex--
	return historyMgr.JumpTo(historyMgr.currentIndex)
}

// Redo moves one step forward in the history stack and returns the next state string.
func (historyMgr *HistoryManager) Redo() string {
	if historyMgr.db == nil || historyMgr.currentIndex >= historyMgr.maxIndex {
		return ""
	}

	historyMgr.currentIndex++
	return historyMgr.JumpTo(historyMgr.currentIndex)
}

// JumpTo retrieves and returns the canvas state string recorded at the specified history index.
func (historyMgr *HistoryManager) JumpTo(index int) string {
	if historyMgr.db == nil || index < 0 || index > historyMgr.maxIndex {
		return ""
	}

	historyMgr.currentIndex = index
	var state string

	err := historyMgr.db.View(func(txn *badger.Txn) error {
		key := []byte(fmt.Sprintf("hist:%d", historyMgr.currentIndex))
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

// GetCurrentIndex returns the current active position index in the history stack.
func (historyMgr *HistoryManager) GetCurrentIndex() int {
	return historyMgr.currentIndex
}

// GetMaxIndex returns the maximum recorded index in the history stack.
func (historyMgr *HistoryManager) GetMaxIndex() int {
	return historyMgr.maxIndex
}

// GetDB returns a reference to the internal Badger database instance.
func (historyMgr *HistoryManager) GetDB() *badger.DB {
	return historyMgr.db
}
