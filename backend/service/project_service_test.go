package service

import (
	"os"
	"path/filepath"
	"testing"
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

	// 4. OpenFileFolder (with shouldOpenInExplorer = false)
	if !svc.OpenFileFolder("", false) {
		t.Error("Expected OpenFileFolder with empty location to succeed")
	}
	if !svc.OpenFileFolder(exportFile, false) {
		t.Error("Expected OpenFileFolder with file path to succeed")
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
