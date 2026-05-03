package db

import (
	"database/sql"
	"os"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite"
)

type Project struct {
	ID        int64  `json:"id"`
	Name      string `json:"name"`
	Content   string `json:"content"`
	CreatedAt int64  `json:"createdAt"`
	UpdatedAt int64  `json:"updatedAt"`
}

type ProjectManager struct {
	db *sql.DB
}

func NewProjectManager() *ProjectManager {
	return &ProjectManager{}
}

func (p *ProjectManager) Init() error {
	userHome, err := os.UserHomeDir()
	if err != nil {
		return err
	}
	dbPath := filepath.Join(userHome, ".kube-builder", "app_data.db")
	os.MkdirAll(filepath.Dir(dbPath), os.ModePerm)

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return err
	}

	p.db = db

	// Create tables
	query := `
	CREATE TABLE IF NOT EXISTS projects (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		content TEXT NOT NULL,
		created_at INTEGER NOT NULL,
		updated_at INTEGER NOT NULL
	);
	CREATE TABLE IF NOT EXISTS settings (
		key TEXT PRIMARY KEY,
		value TEXT NOT NULL
	);
	`
	_, err = p.db.Exec(query)
	return err
}

func (p *ProjectManager) Close() {
	if p.db != nil {
		p.db.Close()
	}
}

func (p *ProjectManager) SaveProject(name string, content string) (int64, error) {
	now := time.Now().Unix()
	res, err := p.db.Exec(
		"INSERT INTO projects (name, content, created_at, updated_at) VALUES (?, ?, ?, ?)",
		name, content, now, now,
	)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (p *ProjectManager) UpdateProject(id int64, content string) error {
	now := time.Now().Unix()
	_, err := p.db.Exec(
		"UPDATE projects SET content = ?, updated_at = ? WHERE id = ?",
		content, now, id,
	)
	return err
}

func (p *ProjectManager) GetProjects() ([]Project, error) {
	rows, err := p.db.Query("SELECT id, name, created_at, updated_at FROM projects ORDER BY updated_at DESC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var projects []Project
	for rows.Next() {
		var proj Project
		if err := rows.Scan(&proj.ID, &proj.Name, &proj.CreatedAt, &proj.UpdatedAt); err != nil {
			return nil, err
		}
		projects = append(projects, proj)
	}
	return projects, nil
}

func (p *ProjectManager) LoadProject(id int64) (*Project, error) {
	var proj Project
	err := p.db.QueryRow("SELECT id, name, content, created_at, updated_at FROM projects WHERE id = ?", id).
		Scan(&proj.ID, &proj.Name, &proj.Content, &proj.CreatedAt, &proj.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &proj, nil
}

func (p *ProjectManager) DeleteProject(id int64) error {
	_, err := p.db.Exec("DELETE FROM projects WHERE id = ?", id)
	return err
}

func (p *ProjectManager) SaveSetting(key string, value string) error {
	_, err := p.db.Exec("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", key, value)
	return err
}

func (p *ProjectManager) GetSetting(key string) (string, error) {
	var value string
	err := p.db.QueryRow("SELECT value FROM settings WHERE key = ?", key).Scan(&value)
	if err != nil {
		return "", err
	}
	return value, nil
}
