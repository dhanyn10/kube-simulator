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

type Project struct {
	ID        int64  `gorm:"primaryKey" json:"id"`
	Name      string `gorm:"not null" json:"name"`
	Content   string `gorm:"type:text;not null" json:"content"`
	CreatedAt int64  `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt int64  `gorm:"autoUpdateTime" json:"updatedAt"`
}

const appDirName = ".kube-simulator"

type Setting struct {
	Key   string `gorm:"primaryKey" json:"key"`
	Value string `gorm:"not null" json:"value"`
}

type ProjectManager struct {
	db *gorm.DB
}

func NewProjectManager() *ProjectManager {
	return &ProjectManager{}
}

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

func (p *ProjectManager) Close() {
	if p.db != nil {
		sqlDB, _ := p.db.DB()
		if sqlDB != nil {
			sqlDB.Close()
		}
	}
}

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

func (p *ProjectManager) GetProjects() ([]Project, error) {
	if p.db == nil {
		return nil, gorm.ErrInvalidDB
	}
	var projects []Project
	result := p.db.Order("updated_at desc").Find(&projects)
	return projects, result.Error
}

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
