package service

import (
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"testing"

	"build-wails/backend/domain"
	"build-wails/backend/explorer"
)

type mockProjectRepo struct {
	initCalled  bool
	closeCalled bool
	projects    map[int64]domain.Project
	settings    map[string]string
	nextID      int64
}

func newMockProjectRepo() *mockProjectRepo {
	return &mockProjectRepo{
		projects: make(map[int64]domain.Project),
		settings: make(map[string]string),
		nextID:   1,
	}
}

func (m *mockProjectRepo) Init() error {
	m.initCalled = true
	return nil
}

func (m *mockProjectRepo) Close() {
	m.closeCalled = true
}

func (m *mockProjectRepo) SaveProject(name, content string) (int64, error) {
	id := m.nextID
	m.nextID++
	m.projects[id] = domain.Project{
		ID:      id,
		Name:    name,
		Content: content,
	}
	return id, nil
}

func (m *mockProjectRepo) UpdateProject(id int64, content string) error {
	p, ok := m.projects[id]
	if !ok {
		return errors.New("project not found")
	}
	p.Content = content
	m.projects[id] = p
	return nil
}

func (m *mockProjectRepo) GetProjects() ([]domain.Project, error) {
	result := make([]domain.Project, 0, len(m.projects))
	for _, p := range m.projects {
		result = append(result, p)
	}
	return result, nil
}

func (m *mockProjectRepo) LoadProject(id int64) (*domain.Project, error) {
	p, ok := m.projects[id]
	if !ok {
		return nil, errors.New("not found")
	}
	return &p, nil
}

func (m *mockProjectRepo) DeleteProject(id int64) error {
	delete(m.projects, id)
	return nil
}

func (m *mockProjectRepo) SaveSetting(key, value string) error {
	m.settings[key] = value
	return nil
}

func (m *mockProjectRepo) GetSetting(key string) (string, error) {
	val, ok := m.settings[key]
	if !ok {
		return "", errors.New("setting not found")
	}
	return val, nil
}

func TestProjectService_WithMockRepository(t *testing.T) {
	mock := newMockProjectRepo()
	svc := NewProjectService(mock)

	if err := svc.Init(); err != nil || !mock.initCalled {
		t.Fatalf("Init failed or not forwarded to mock: %v", err)
	}

	if svc.GetRepository() != mock {
		t.Error("Expected GetRepository to return the injected mock repository")
	}

	// Non-GORM repo should yield nil for GetManager
	if svc.GetManager() != nil {
		t.Error("Expected GetManager to return nil for mock repository")
	}

	// 1. SaveProject
	id, err := svc.SaveProject("Mock Architecture", `{"nodes":["n1"]}`)
	if err != nil || id != 1 {
		t.Fatalf("SaveProject failed: id=%d, err=%v", id, err)
	}

	// 2. LoadProject
	proj, err := svc.LoadProject(id)
	if err != nil || proj.Name != "Mock Architecture" {
		t.Fatalf("LoadProject failed: %+v, err=%v", proj, err)
	}

	// 3. UpdateProject
	err = svc.UpdateProject(id, `{"nodes":["n1","n2"]}`)
	if err != nil {
		t.Fatalf("UpdateProject failed: %v", err)
	}

	// 4. GetProjects
	list, err := svc.GetProjects()
	if err != nil || len(list) != 1 {
		t.Fatalf("GetProjects failed: len=%d, err=%v", len(list), err)
	}

	// 5. Settings
	if err := svc.SaveSetting("autosave_interval", "30"); err != nil {
		t.Fatalf("SaveSetting failed: %v", err)
	}
	val, err := svc.GetSetting("autosave_interval")
	if err != nil || val != "30" {
		t.Fatalf("GetSetting failed: val=%s, err=%v", val, err)
	}

	// 6. DeleteProject
	if err := svc.DeleteProject(id); err != nil {
		t.Fatalf("DeleteProject failed: %v", err)
	}
	afterDelete, _ := svc.GetProjects()
	if len(afterDelete) != 0 {
		t.Errorf("Expected 0 projects after delete, got %d", len(afterDelete))
	}

	svc.Close()
	if !mock.closeCalled {
		t.Error("Expected Close to be forwarded to mock repository")
	}
}

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

func TestProjectService_GetManager_WithRealRepository(t *testing.T) {
	svc := NewProjectService(nil)
	if svc.GetManager() == nil {
		t.Error("Expected GetManager to return the default project manager")
	}
}

func TestProjectService_ExportProjectFile_MarshalError(t *testing.T) {
	origMarshal := marshalProjectExport
	defer func() { marshalProjectExport = origMarshal }()
	marshalProjectExport = func(interface{}, string, string) ([]byte, error) {
		return nil, errors.New("marshal failed")
	}

	svc := NewProjectService(nil)
	err := svc.ExportProjectFile(filepath.Join(t.TempDir(), "project.infra"), "name", "{}", "kind: Pod")
	if err == nil {
		t.Error("Expected export to return the marshal error")
	}
}
