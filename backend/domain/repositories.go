package domain

// ProjectRepository defines the persistence contract for projects and application settings.
type ProjectRepository interface {
	Init() error
	Close()
	SaveProject(name, content string) (int64, error)
	UpdateProject(id int64, content string) error
	GetProjects() ([]Project, error)
	LoadProject(id int64) (*Project, error)
	DeleteProject(id int64) error
	SaveSetting(key, value string) error
	GetSetting(key string) (string, error)
}

// HistoryRepository defines the storage contract for undo/redo snapshots and audit logs.
type HistoryRepository interface {
	Init() error
	Close()
	Push(state string)
	Undo() string
	Redo() string
	JumpTo(index int) string
	GetCurrentIndex() int
	GetHistoryLogs() []HistoryLog
}
