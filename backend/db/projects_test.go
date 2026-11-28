package db

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

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

func TestProjectManager_UninitializedProjects(t *testing.T) {
	pm := NewProjectManager()

	if _, err := pm.SaveProject("n", "c"); err == nil {
		t.Error("Expected error for SaveProject")
	}
	if err := pm.UpdateProject(1, "c"); err == nil {
		t.Error("Expected error for UpdateProject")
	}
	if _, err := pm.GetProjects(); err == nil {
		t.Error("Expected error for GetProjects")
	}
	if _, err := pm.LoadProject(1); err == nil {
		t.Error("Expected error for LoadProject")
	}
	if err := pm.DeleteProject(1); err == nil {
		t.Error("Expected error for DeleteProject")
	}
}

func TestProjectManager_UninitializedSettings(t *testing.T) {
	pm := NewProjectManager()

	if err := pm.SaveSetting("k", "v"); err == nil {
		t.Error("Expected error for SaveSetting")
	}
	if _, err := pm.GetSetting("k"); err == nil {
		t.Error("Expected error for GetSetting")
	}
}

func TestProjectManager_Errors(t *testing.T) {
	pm, tmpDir := setupTestDB(t)
	defer os.RemoveAll(tmpDir)
	defer pm.Close()

	// Test Load non-existent project
	_, err := pm.LoadProject(999)
	if err == nil {
		t.Error("Expected error loading non-existent project")
	}

	// Test Get non-existent setting
	_, err = pm.GetSetting("non-existent")
	if err == nil {
		t.Error("Expected error getting non-existent setting")
	}
}

func TestProjectManager_AutosaveFiles(t *testing.T) {
	pm, tmpDir := setupTestDB(t)
	defer os.RemoveAll(tmpDir)
	defer pm.Close()

	oldHome := os.Getenv("HOME")
	oldUserProfile := os.Getenv("USERPROFILE")
	os.Setenv("HOME", tmpDir)
	os.Setenv("USERPROFILE", tmpDir)
	defer func() {
		os.Setenv("HOME", oldHome)
		os.Setenv("USERPROFILE", oldUserProfile)
	}()

	// 1. Save autosave setting (writes physical file)
	err := pm.SaveSetting("autosave-test-proj", `{"state":"active"}`)
	if err != nil {
		t.Fatalf("Failed to save autosave setting: %v", err)
	}

	val, err := pm.GetSetting("autosave-test-proj")
	if err != nil {
		t.Fatalf("Failed to get autosave setting: %v", err)
	}
	if val != `{"state":"active"}` {
		t.Errorf("Expected autosave content, got %s", val)
	}

	// 2. Clear autosave setting (deletes physical file)
	err = pm.SaveSetting("autosave-test-proj", "")
	if err != nil {
		t.Fatalf("Failed to clear autosave setting: %v", err)
	}

	val, err = pm.GetSetting("autosave-test-proj")
	if err != nil {
		t.Fatalf("Failed to get cleared autosave setting: %v", err)
	}
	if val != "" {
		t.Errorf("Expected empty autosave setting, got %s", val)
	}

	// 3. Non-autosave setting does not trigger autosave physical file write
	err = pm.SaveSetting("theme", "dark")
	if err != nil {
		t.Fatalf("Failed to save regular setting: %v", err)
	}

	// 4. Test pruning when exceeding maxAutosaveFiles (5)
	for i := 1; i <= 7; i++ {
		_ = pm.SaveSetting(fmt.Sprintf("autosave-prune-%d", i), fmt.Sprintf(`{"val":%d}`, i))
		time.Sleep(10 * time.Millisecond)
	}
	autosavesDir := filepath.Join(tmpDir, appDirName, "autosaves")
	entries, _ := os.ReadDir(autosavesDir)
	var count int
	for _, e := range entries {
		if strings.HasSuffix(e.Name(), ".infra") {
			count++
		}
	}
	if count > 5 {
		t.Errorf("Expected at most 5 autosave files after pruning, got %d", count)
	}
}

func TestPruneAutosaveFiles_Direct(t *testing.T) {
	// 1. Non-existent directory
	pruneAutosaveFiles(filepath.Join(t.TempDir(), "nonexistent"), 5)

	// 2. Directory with subdirs and non-.infra files
	tmpDir := t.TempDir()
	_ = os.MkdirAll(filepath.Join(tmpDir, "subfolder"), 0755)
	_ = os.WriteFile(filepath.Join(tmpDir, "readme.txt"), []byte("hello"), 0644)
	_ = os.WriteFile(filepath.Join(tmpDir, "save1.infra"), []byte("{}"), 0644)
	time.Sleep(10 * time.Millisecond)
	_ = os.WriteFile(filepath.Join(tmpDir, "save2.infra"), []byte("{}"), 0644)

	// Prune with maxToKeep = 5 (no files removed)
	pruneAutosaveFiles(tmpDir, 5)

	// Prune with maxToKeep = 1 (removes older save1.infra)
	pruneAutosaveFiles(tmpDir, 1)

	if _, err := os.Stat(filepath.Join(tmpDir, "save1.infra")); !os.IsNotExist(err) {
		t.Errorf("Expected save1.infra to be pruned")
	}
	if _, err := os.Stat(filepath.Join(tmpDir, "save2.infra")); err != nil {
		t.Errorf("Expected save2.infra to be preserved: %v", err)
	}
}

func TestWritePhysicalAutosaveFile_Branches(t *testing.T) {
	// 1. Non-autosave key is a safe no-op
	writePhysicalAutosaveFile("theme-setting", "dark")

	// 2. Valid autosave key with content writes file, empty content deletes file
	tmpDir := t.TempDir()
	oldHome := os.Getenv("HOME")
	oldUserProfile := os.Getenv("USERPROFILE")
	os.Setenv("HOME", tmpDir)
	os.Setenv("USERPROFILE", tmpDir)
	defer func() {
		os.Setenv("HOME", oldHome)
		os.Setenv("USERPROFILE", oldUserProfile)
	}()

	writePhysicalAutosaveFile("autosave-temp", `{"data":"ok"}`)
	targetFile := filepath.Join(tmpDir, appDirName, "autosaves", "autosave-temp.infra")
	if _, err := os.Stat(targetFile); err != nil {
		t.Errorf("Expected autosave file to be written: %v", err)
	}

	// Empty content triggers delete
	writePhysicalAutosaveFile("autosave-temp", "")
	if _, err := os.Stat(targetFile); !os.IsNotExist(err) {
		t.Errorf("Expected autosave file to be deleted")
	}
}

func clearProjectHomeEnv(t *testing.T) {
	t.Helper()
	t.Setenv("HOME", "")
	t.Setenv("USERPROFILE", "")
	t.Setenv("HOMEDRIVE", "")
	t.Setenv("HOMEPATH", "")
}

type failingInfoDirEntry struct{}

func (failingInfoDirEntry) Name() string               { return "broken.infra" }
func (failingInfoDirEntry) IsDir() bool                { return false }
func (failingInfoDirEntry) Type() fs.FileMode          { return 0 }
func (failingInfoDirEntry) Info() (fs.FileInfo, error) { return nil, errors.New("info failed") }

func TestWritePhysicalProjectFile_HomeDirError(t *testing.T) {
	clearProjectHomeEnv(t)
	writePhysicalProjectFile(1, "content")
}

func TestWritePhysicalAutosaveFile_HomeDirError(t *testing.T) {
	clearProjectHomeEnv(t)
	writePhysicalAutosaveFile("autosave-home-error", "content")
}

func TestPruneAutosaveFiles_EntryInfoError(t *testing.T) {
	origReadDir := readAutosaveDir
	defer func() { readAutosaveDir = origReadDir }()
	readAutosaveDir = func(string) ([]os.DirEntry, error) {
		return []os.DirEntry{failingInfoDirEntry{}}, nil
	}

	pruneAutosaveFiles(t.TempDir(), 5)
}
