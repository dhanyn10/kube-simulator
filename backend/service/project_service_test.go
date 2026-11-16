package service

import (
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"testing"

	"build-wails/backend/explorer"
)

func TestProjectService_FileOperations(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "kube-project-test-*")
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

	svc := NewProjectService(nil)

	// 1. Export project file
	exportFile := filepath.Join(tmpDir, "sample.infra")
	err = svc.ExportProjectFile(exportFile, "Test Project", `{"nodes":[]}`, "kind: Pod\n")
	if err != nil {
		t.Fatalf("Failed to export project: %v", err)
	}

	// 2. FileExists
	if !svc.FileExists(exportFile) {
		t.Errorf("Expected file %s to exist", exportFile)
	}
	if svc.FileExists(filepath.Join(tmpDir, "nonexistent.infra")) {
		t.Error("Expected nonexistent file to return false")
	}
	if svc.FileExists("") {
		t.Error("Expected empty location to return false")
	}

	// 3. Import project file
	imported, err := svc.ImportProjectFile(exportFile)
	if err != nil {
		t.Fatalf("Failed to import project: %v", err)
	}
	if imported == "" {
		t.Error("Expected non-empty imported content")
	}

	// 4. OpenFileFolder without explorer
	if !svc.OpenFileFolder(exportFile, false) {
		t.Errorf("Expected OpenFileFolder to succeed for existing file")
	}
}

func TestProjectService_OpenFileFolder_ExplorerBranches(t *testing.T) {
	tmpDir := t.TempDir()
	oldHome := os.Getenv("HOME")
	oldUserProfile := os.Getenv("USERPROFILE")
	os.Setenv("HOME", tmpDir)
	os.Setenv("USERPROFILE", tmpDir)
	defer func() {
		os.Setenv("HOME", oldHome)
		os.Setenv("USERPROFILE", oldUserProfile)
	}()

	svc := NewProjectService(nil)

	// 1. Empty location
	if !svc.OpenFileFolder("", false) {
		t.Error("Expected OpenFileFolder to succeed for empty location")
	}

	// 2. Relative path
	if !svc.OpenFileFolder("relative/path/file.infra", false) {
		t.Error("Expected OpenFileFolder to succeed for relative path")
	}

	// 3. File path (non-directory)
	filePath := filepath.Join(tmpDir, "some-file.txt")
	_ = os.WriteFile(filePath, []byte("content"), 0644)
	if !svc.OpenFileFolder(filePath, false) {
		t.Error("Expected OpenFileFolder to succeed for file path")
	}

	// 4. Explorer execution success
	oldStartCmd := explorer.StartCmd
	defer func() { explorer.StartCmd = oldStartCmd }()

	explorer.StartCmd = func(_ *exec.Cmd) error {
		return nil
	}
	if !svc.OpenFileFolder(filePath, true) {
		t.Error("Expected OpenFileFolder with explorer true to succeed when StartCmd succeeds")
	}

	// 5. Explorer execution error
	explorer.StartCmd = func(_ *exec.Cmd) error {
		return errors.New("cannot start explorer")
	}
	if svc.OpenFileFolder(filePath, true) {
		t.Error("Expected OpenFileFolder with explorer true to return false when StartCmd fails")
	}
}

func TestProjectService_ExportImportErrors(t *testing.T) {
	svc := NewProjectService(nil)

	// Export to impossible path
	err := svc.ExportProjectFile(filepath.Join(os.DevNull, "impossible", "path.infra"), "test", "{}", "kind: Pod")
	if err == nil {
		t.Error("Expected error when exporting to invalid path")
	}

	// Import nonexistent file
	_, err = svc.ImportProjectFile(filepath.Join(t.TempDir(), "does-not-exist.infra"))
	if err == nil {
		t.Error("Expected error when importing nonexistent file")
	}
}

func TestProjectService_DBOperations(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "kube-project-db-test-*")
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

	svc := NewProjectService(nil)
	if err := svc.Init(); err != nil {
		t.Fatalf("Failed to init project service DB: %v", err)
	}
	defer svc.Close()

	// 1. SaveProject
	id, err := svc.SaveProject("Sample Project", `{"nodes":[]}`)
	if err != nil || id <= 0 {
		t.Fatalf("Failed to save project: %v", err)
	}

	// 2. LoadProject
	proj, err := svc.LoadProject(id)
	if err != nil || proj == nil || proj.Name != "Sample Project" {
		t.Fatalf("Failed to load project: %v", err)
	}

	// 3. UpdateProject
	err = svc.UpdateProject(id, `{"nodes":["updated"]}`)
	if err != nil {
		t.Fatalf("Failed to update project: %v", err)
	}
	updatedProj, _ := svc.LoadProject(id)
	if updatedProj.Content != `{"nodes":["updated"]}` {
		t.Errorf("Project content not updated: %s", updatedProj.Content)
	}

	// 4. GetProjects
	projects, err := svc.GetProjects()
	if err != nil || len(projects) != 1 {
		t.Fatalf("Expected 1 project, got %d (err: %v)", len(projects), err)
	}

	// 5. SaveSetting & GetSetting
	err = svc.SaveSetting("theme", "dark")
	if err != nil {
		t.Fatalf("Failed to save setting: %v", err)
	}
	val, err := svc.GetSetting("theme")
	if err != nil || val != "dark" {
		t.Errorf("Expected setting 'dark', got %q (err: %v)", val, err)
	}

	// 6. DeleteProject
	err = svc.DeleteProject(id)
	if err != nil {
		t.Fatalf("Failed to delete project: %v", err)
	}
	afterDelete, _ := svc.GetProjects()
	if len(afterDelete) != 0 {
		t.Errorf("Expected 0 projects after delete, got %d", len(afterDelete))
	}
}

func TestProjectService_HomeDirFailure(t *testing.T) {
	oldHome := os.Getenv("HOME")
	oldUserProfile := os.Getenv("USERPROFILE")
	os.Unsetenv("HOME")
	os.Unsetenv("USERPROFILE")
	defer func() {
		os.Setenv("HOME", oldHome)
		os.Setenv("USERPROFILE", oldUserProfile)
	}()

	svc := NewProjectService(nil)
	if svc.FileExists("/some/path") {
		t.Error("Expected false on home dir failure in FileExists")
	}
	if svc.OpenFileFolder("/some/path", false) {
		t.Error("Expected false on home dir failure in OpenFileFolder")
	}
}
