package db

import (
	"os"
	"path/filepath"
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
	dbPath := filepath.Join(userHome, ".kube-simulator", "app_data.db")
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

func (p *ProjectManager) SaveProject(name, content string) (int64, error) {
	if p.db == nil {
		return 0, gorm.ErrInvalidDB
	}
	project := Project{
		Name:    name,
		Content: content,
	}
	result := p.db.Create(&project)
	return project.ID, result.Error
}

func (p *ProjectManager) UpdateProject(id int64, content string) error {
	if p.db == nil {
		return gorm.ErrInvalidDB
	}
	return p.db.Model(&Project{}).Where("id = ?", id).Updates(map[string]interface{}{
		"content":    content,
		"updated_at": time.Now().Unix(),
	}).Error
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
	return p.db.Delete(&Project{}, id).Error
}

func (p *ProjectManager) SaveSetting(key, value string) error {
	if p.db == nil {
		return gorm.ErrInvalidDB
	}
	setting := Setting{Key: key, Value: value}
	return p.db.Save(&setting).Error
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
