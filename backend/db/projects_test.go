package db

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func setupTestDB(t *testing.T) (*ProjectManager, string) {
	tmpDir, err := os.MkdirTemp("", "kube-builder-test-*")
	if err != nil {
		t.Fatal(err)
	}

	dbPath := filepath.Join(tmpDir, "test.db")
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatal(err)
	}

	pm := &ProjectManager{db: db}
	err = db.AutoMigrate(&Project{}, &Setting{})
	if err != nil {
		t.Fatal(err)
	}

	return pm, tmpDir
}

func TestProjectManager(t *testing.T) {
	pm, tmpDir := setupTestDB(t)
	defer os.RemoveAll(tmpDir)
	defer pm.Close()

	// Test SaveProject
	id, err := pm.SaveProject("Test Project", "Content")
	if err != nil {
		t.Fatalf("SaveProject failed: %v", err)
	}
	if id == 0 {
		t.Fatal("Expected non-zero ID")
	}

	// Test GetProjects
	projects, err := pm.GetProjects()
	if err != nil {
		t.Fatalf("GetProjects failed: %v", err)
	}
	if len(projects) != 1 {
		t.Fatalf("Expected 1 project, got %d", len(projects))
	}

	// Test LoadProject
	p, err := pm.LoadProject(id)
	if err != nil {
		t.Fatalf("LoadProject failed: %v", err)
	}
	if p.Name != "Test Project" {
		t.Errorf("Expected name 'Test Project', got '%s'", p.Name)
	}

	// Test UpdateProject
	err = pm.UpdateProject(id, "New Content")
	if err != nil {
		t.Fatalf("UpdateProject failed: %v", err)
	}
	p, _ = pm.LoadProject(id)
	if p.Content != "New Content" {
		t.Errorf("Expected content 'New Content', got '%s'", p.Content)
	}

	// Test Save/Get Setting
	err = pm.SaveSetting("key", "value")
	if err != nil {
		t.Fatalf("SaveSetting failed: %v", err)
	}
	val, err := pm.GetSetting("key")
	if err != nil {
		t.Fatalf("GetSetting failed: %v", err)
	}
	if val != "value" {
		t.Errorf("Expected value 'value', got '%s'", val)
	}

	// Test DeleteProject
	err = pm.DeleteProject(id)
	if err != nil {
		t.Fatalf("DeleteProject failed: %v", err)
	}
	projects, _ = pm.GetProjects()
	if len(projects) != 0 {
		t.Errorf("Expected 0 projects after delete, got %d", len(projects))
	}
}
