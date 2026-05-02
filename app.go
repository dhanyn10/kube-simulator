package main

import (
	"context"
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

	// Reset indices on startup or we could load last state if we wanted persistence across sessions
	// For now, let's start fresh each session but using DB for robustness
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

	// 1. Increment index
	a.currentIndex++
	a.maxIndex = a.currentIndex

	// 2. Write to BadgerDB
	err := a.db.Update(func(txn *badger.Txn) error {
		key := []byte(fmt.Sprintf("hist:%d", a.currentIndex))
		return txn.Set(key, []byte(state))
	})

	if err != nil {
		log.Printf("Error saving history to BadgerDB: %v", err)
	}

	log.Printf("[DB Log] Recorded activity at index %d", a.currentIndex)
}

// Undo returns the previous state from BadgerDB
func (a *App) Undo() string {
	if a.db == nil || a.currentIndex <= 0 {
		return ""
	}

	a.currentIndex--
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
		log.Printf("Error fetching Undo state from BadgerDB: %v", err)
		return ""
	}

	log.Printf("[DB Log] Undo to index %d", a.currentIndex)
	return state
}

// Redo returns the next state from BadgerDB
func (a *App) Redo() string {
	if a.db == nil || a.currentIndex >= a.maxIndex {
		return ""
	}

	a.currentIndex++
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
		log.Printf("Error fetching Redo state from BadgerDB: %v", err)
		return ""
	}

	log.Printf("[DB Log] Redo to index %d", a.currentIndex)
	return state
}

// Greet returns a greeting for the given name
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}
