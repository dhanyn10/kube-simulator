package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"

	"github.com/dgraph-io/badger/v4"
)

// App struct
type App struct {
	ctx          context.Context
	db           *badger.DB
	currentIndex int
	maxIndex     int
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{
		currentIndex: -1,
		maxIndex:     -1,
	}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// Initialize BadgerDB
	userHome, err := os.UserHomeDir()
	if err != nil {
		log.Fatal(err)
	}
	dbPath := filepath.Join(userHome, ".kube-builder", "history_db")
	
	// Create directory if not exists
	os.MkdirAll(dbPath, os.ModePerm)

	opts := badger.DefaultOptions(dbPath).WithLogger(nil)
	db, err := badger.Open(opts)
	if err != nil {
		log.Fatal(err)
	}
	a.db = db
}

func (a *App) shutdown(ctx context.Context) {
	if a.db != nil {
		a.db.Close()
	}
}

// PushHistory saves a new state snapshot to BadgerDB
func (a *App) PushHistory(state string) {
	if a.db == nil {
		return
	}

	a.currentIndex++
	a.maxIndex = a.currentIndex

	err := a.db.Update(func(txn *badger.Txn) error {
		key := []byte(fmt.Sprintf("hist:%d", a.currentIndex))
		return txn.Set(key, []byte(state))
	})

	if err != nil {
		log.Printf("Error saving history: %v", err)
	}
}

// Undo returns the previous state from BadgerDB
func (a *App) Undo() string {
	if a.db == nil || a.currentIndex <= 0 {
		return ""
	}

	a.currentIndex--
	return a.JumpToHistory(a.currentIndex)
}

// Redo returns the next state from BadgerDB
func (a *App) Redo() string {
	if a.db == nil || a.currentIndex >= a.maxIndex {
		return ""
	}

	a.currentIndex++
	return a.JumpToHistory(a.currentIndex)
}

// HistoryLog represents a metadata entry for the dropdown
type HistoryLog struct {
	Index      int    `json:"index"`
	ActionName string `json:"actionName"`
	Timestamp  int64  `json:"timestamp"`
}

// GetHistoryLogs returns the list of all recorded activities
func (a *App) GetHistoryLogs() []HistoryLog {
	if a.db == nil {
		return []HistoryLog{}
	}

	logs := make([]HistoryLog, 0)
	for i := 0; i <= a.maxIndex; i++ {
		_ = a.db.View(func(txn *badger.Txn) error {
			key := []byte(fmt.Sprintf("hist:%d", i))
			item, err := txn.Get(key)
			if err != nil {
				return err
			}
			return item.Value(func(val []byte) error {
				var data struct {
					ActionName string `json:"actionName"`
					Timestamp  int64  `json:"timestamp"`
				}
				if err := json.Unmarshal(val, &data); err == nil {
					logs = append(logs, HistoryLog{
						Index:      i,
						ActionName: data.ActionName,
						Timestamp:  data.Timestamp,
					})
				} else {
					logs = append(logs, HistoryLog{
						Index:      i,
						ActionName: fmt.Sprintf("Activity #%d", i),
						Timestamp:  0,
					})
				}
				return nil
			})
		})
	}
	return logs
}

// JumpToHistory applies a specific index from history
func (a *App) JumpToHistory(index int) string {
	if a.db == nil || index < 0 || index > a.maxIndex {
		return ""
	}

	a.currentIndex = index
	var state string

	err := a.db.View(func(txn *badger.Txn) error {
		key := []byte(fmt.Sprintf("hist:%d", a.currentIndex))
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

// Greet returns a greeting for the given name
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}
