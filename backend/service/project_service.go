package service

import (
	"encoding/json"
	"os"
	"path/filepath"

	"build-wails/backend/db"
	"build-wails/backend/explorer"
	"build-wails/backend/logger"
)

// ProjectService manages persistence, storage querying, file exports, and directory exploration.
type ProjectService struct {
	manager *db.ProjectManager
}

// NewProjectService constructs a new ProjectService.
func NewProjectService(manager *db.ProjectManager) *ProjectService {
	if manager == nil {
		manager = db.NewProjectManager()
	}
	return &ProjectService{manager: manager}
}

// Init initializes the project manager database.
func (s *ProjectService) Init() error {
	return s.manager.Init()
}

// Close releases the project manager database connection.
func (s *ProjectService) Close() {
	s.manager.Close()
}

// SaveProject persists a new project record.
func (s *ProjectService) SaveProject(name, content string) (int64, error) {
	return s.manager.SaveProject(name, content)
}

// UpdateProject updates an existing project snapshot by ID.
func (s *ProjectService) UpdateProject(id int64, content string) error {
	return s.manager.UpdateProject(id, content)
}

// GetProjects returns all saved projects.
func (s *ProjectService) GetProjects() ([]db.Project, error) {
	return s.manager.GetProjects()
}

// LoadProject retrieves a specific project by ID.
func (s *ProjectService) LoadProject(id int64) (*db.Project, error) {
	return s.manager.LoadProject(id)
}

// DeleteProject deletes a project record by ID.
func (s *ProjectService) DeleteProject(id int64) error {
	return s.manager.DeleteProject(id)
}

// SaveSetting stores an application configuration key-value pair.
func (s *ProjectService) SaveSetting(key, value string) error {
	return s.manager.SaveSetting(key, value)
}

// GetSetting reads an application configuration value by key.
func (s *ProjectService) GetSetting(key string) (string, error) {
	return s.manager.GetSetting(key)
}

// FileExists checks whether a physical file exists at the given relative or home-expanded path.
func (s *ProjectService) FileExists(location string) bool {
	if location == "" {
		return false
	}
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return false
	}
	targetPath := ExpandHomePath(location, homeDir)
	stat, err := os.Stat(targetPath)
	if err != nil || stat.IsDir() {
		return false
	}
	return true
}

// OpenFileFolder resolves a folder location and reveals it in the operating system's file explorer.
func (s *ProjectService) OpenFileFolder(location string, shouldOpenInExplorer bool) bool {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		logger.Error("Failed to resolve user home dir: %v", err)
		return false
	}

	var targetPath string
	if location == "" {
		targetPath = filepath.Join(homeDir, KubeSimulatorDir)
	} else {
		targetPath = ExpandHomePath(location, homeDir)
		if !filepath.IsAbs(targetPath) {
			targetPath = filepath.Join(homeDir, targetPath)
		}
	}

	folderPath := targetPath
	if stat, err := os.Stat(targetPath); err == nil && !stat.IsDir() {
		folderPath = filepath.Dir(targetPath)
	} else if err != nil && os.IsNotExist(err) {
		folderPath = filepath.Dir(targetPath)
		_ = os.MkdirAll(folderPath, 0755)
	}

	if shouldOpenInExplorer {
		if err := explorer.OpenInExplorer(folderPath); err != nil {
			logger.Error("Failed to open folder %s: %v", folderPath, err)
			return false
		}
	}
	return true
}

// ExportProjectFile writes a bundled infrastructure project JSON document to the given file path.
func (s *ProjectService) ExportProjectFile(filePath, name, canvasContent, yamlContent string) error {
	data := map[string]string{
		"name":   name,
		"canvas": canvasContent,
		"yaml":   yamlContent,
	}

	fileData, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filePath, fileData, 0644)
}

// ImportProjectFile reads and returns the string contents of an imported infrastructure file.
func (s *ProjectService) ImportProjectFile(filePath string) (string, error) {
	fileData, err := os.ReadFile(filePath)
	if err != nil {
		return "", err
	}
	return string(fileData), nil
}
