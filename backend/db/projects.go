package db

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Project represents a saved infrastructure project entry in the SQLite database.
type Project struct {
	ID        int64  `gorm:"primaryKey" json:"id"`
	Name      string `gorm:"not null" json:"name"`
	Content   string `gorm:"type:text;not null" json:"content"`
	CreatedAt int64  `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt int64  `gorm:"autoUpdateTime" json:"updatedAt"`
}

const appDirName = ".kube-simulator"

// Setting represents a key-value application setting entry stored in the SQLite database.
type Setting struct {
	Key   string `gorm:"primaryKey" json:"key"`
	Value string `gorm:"not null" json:"value"`
}

// ProjectManager manages local SQLite storage for infrastructure projects and settings using GORM.
type ProjectManager struct {
	db *gorm.DB
}

// NewProjectManager creates a new ProjectManager instance.
func NewProjectManager() *ProjectManager {
	return &ProjectManager{}
}

// Init initializes the local SQLite database at ~/.kube-simulator/app_data.db and performs auto-migrations.
func (p *ProjectManager) Init() error {
	userHome, err := os.UserHomeDir()
	if err != nil {
		return err
	}
	dbPath := filepath.Join(userHome, appDirName, "app_data.db")
	if err := os.MkdirAll(filepath.Dir(dbPath), os.ModePerm); err != nil {
		return err
	}

	// Use pure-Go SQLite driver with GORM
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		return err
	}

	p.db = db

	// Auto Migration (Like Laravel migrations)
	return p.db.AutoMigrate(&Project{}, &Setting{})
}

// Close safely closes the underlying GORM SQLite connection if open.
func (p *ProjectManager) Close() {
	if p.db != nil {
		sqlDB, _ := p.db.DB()
		if sqlDB != nil {
			sqlDB.Close()
		}
	}
}

// writePhysicalProjectFile exports a project snapshot file (.infra) to ~/.kube-simulator/projects/.
func writePhysicalProjectFile(id int64, content string) {
	userHome, err := os.UserHomeDir()
	if err != nil {
		return
	}
	dir := filepath.Join(userHome, appDirName, "projects")
	_ = os.MkdirAll(dir, 0755)
	filePath := filepath.Join(dir, fmt.Sprintf("project_%d.infra", id))
	_ = os.WriteFile(filePath, []byte(content), 0644)
}

// writePhysicalAutosaveFile writes or deletes an autosave snapshot file (.infra) in ~/.kube-simulator/autosaves/.
func writePhysicalAutosaveFile(key, content string) {
	if !strings.HasPrefix(key, "autosave-") {
		return
	}
	userHome, err := os.UserHomeDir()
	if err != nil {
		return
	}
	dir := filepath.Join(userHome, appDirName, "autosaves")
	_ = os.MkdirAll(dir, 0755)
	filePath := filepath.Join(dir, fmt.Sprintf("%s.infra", key))
	if content == "" {
		_ = os.Remove(filePath)
	} else {
		_ = os.WriteFile(filePath, []byte(content), 0644)
	}
}

// SaveProject inserts a new Project record into SQLite and writes the corresponding physical project file.
func (p *ProjectManager) SaveProject(name, content string) (int64, error) {
	if p.db == nil {
		return 0, gorm.ErrInvalidDB
	}
	project := Project{
		Name:    name,
		Content: content,
	}
	result := p.db.Create(&project)
	if result.Error == nil {
		writePhysicalProjectFile(project.ID, content)
	}
	return project.ID, result.Error
}

// UpdateProject updates the content and timestamp of an existing project record and writes the updated physical file.
func (p *ProjectManager) UpdateProject(id int64, content string) error {
	if p.db == nil {
		return gorm.ErrInvalidDB
	}
	err := p.db.Model(&Project{}).Where("id = ?", id).Updates(map[string]interface{}{
		"content":    content,
		"updated_at": time.Now().Unix(),
	}).Error
	if err == nil {
		writePhysicalProjectFile(id, content)
	}
	return err
}

// GetProjects retrieves all stored projects ordered by updated_at descending.
func (p *ProjectManager) GetProjects() ([]Project, error) {
	if p.db == nil {
		return nil, gorm.ErrInvalidDB
	}
	var projects []Project
	result := p.db.Order("updated_at desc").Find(&projects)
	return projects, result.Error
}

// LoadProject retrieves a single project by its primary key ID.
func (p *ProjectManager) LoadProject(id int64) (*Project, error) {
	if p.db == nil {
		return nil, gorm.ErrInvalidDB
	}
	var project Project
	result := p.db.First(&project, id)
	if result.Error != nil {
		return nil, result.Error
	}
	return &project, nil
}

// DeleteProject removes a project record from SQLite and deletes its corresponding physical file.
func (p *ProjectManager) DeleteProject(id int64) error {
	if p.db == nil {
		return gorm.ErrInvalidDB
	}
	err := p.db.Delete(&Project{}, id).Error
	if err == nil {
		userHome, errHome := os.UserHomeDir()
		if errHome == nil {
			filePath := filepath.Join(userHome, appDirName, "projects", fmt.Sprintf("project_%d.infra", id))
			_ = os.Remove(filePath)
		}
	}
	return err
}

// SaveSetting stores or updates a key-value setting in SQLite and triggers physical autosave syncing when applicable.
func (p *ProjectManager) SaveSetting(key, value string) error {
	if p.db == nil {
		return gorm.ErrInvalidDB
	}
	setting := Setting{Key: key, Value: value}
	err := p.db.Save(&setting).Error
	if err == nil {
		writePhysicalAutosaveFile(key, value)
	}
	return err
}

// GetSetting retrieves the setting value corresponding to the specified key from SQLite.
func (p *ProjectManager) GetSetting(key string) (string, error) {
	if p.db == nil {
		return "", gorm.ErrInvalidDB
	}
	var setting Setting
	result := p.db.First(&setting, "key = ?", key)
	if result.Error != nil {
		return "", result.Error
	}
	return setting.Value, nil
}
