package service

import (
	"encoding/json"
	"os"
	"path/filepath"

	"build-wails/backend/db"
	"build-wails/backend/domain"
	"build-wails/backend/explorer"
	"build-wails/backend/logger"
)

var marshalProjectExport = json.MarshalIndent

// ProjectService manages persistence, storage querying, file exports, and directory exploration.
type ProjectService struct {
	repo domain.ProjectRepository
}

// NewProjectService constructs a new ProjectService with an injected ProjectRepository.
func NewProjectService(repo domain.ProjectRepository) *ProjectService {
	if repo == nil {
		repo = db.NewProjectManager()
	}
	return &ProjectService{repo: repo}
}

// Init initializes the project manager database.
func (s *ProjectService) Init() error {
	return s.repo.Init()
}

// Close releases the project manager database connection.
func (s *ProjectService) Close() {
	s.repo.Close()
}

// GetRepository returns the underlying ProjectRepository.
func (s *ProjectService) GetRepository() domain.ProjectRepository {
	return s.repo
}

// GetManager returns the underlying repository as *db.ProjectManager when applicable.
func (s *ProjectService) GetManager() *db.ProjectManager {
	if mgr, ok := s.repo.(*db.ProjectManager); ok {
		return mgr
	}
	return nil
}

// SaveProject persists a new project record.
func (s *ProjectService) SaveProject(name, content string) (int64, error) {
	return s.repo.SaveProject(name, content)
}

// UpdateProject updates an existing project snapshot by ID.
func (s *ProjectService) UpdateProject(id int64, content string) error {
	return s.repo.UpdateProject(id, content)
}

// GetProjects returns all saved projects.
func (s *ProjectService) GetProjects() ([]domain.Project, error) {
	return s.repo.GetProjects()
}

// LoadProject retrieves a specific project by ID.
func (s *ProjectService) LoadProject(id int64) (*domain.Project, error) {
	return s.repo.LoadProject(id)
}

// DeleteProject deletes a project record by ID.
func (s *ProjectService) DeleteProject(id int64) error {
	return s.repo.DeleteProject(id)
}

// SaveSetting stores an application configuration key-value pair.
func (s *ProjectService) SaveSetting(key, value string) error {
	return s.repo.SaveSetting(key, value)
}

// GetSetting reads an application configuration value by key.
func (s *ProjectService) GetSetting(key string) (string, error) {
	return s.repo.GetSetting(key)
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

	fileData, err := marshalProjectExport(data, "", "  ")
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
