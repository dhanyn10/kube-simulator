package domain

// Project represents a saved infrastructure project entry.
type Project struct {
	ID        int64  `gorm:"primaryKey" json:"id"`
	Name      string `gorm:"not null" json:"name"`
	Content   string `gorm:"type:text;not null" json:"content"`
	CreatedAt int64  `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt int64  `gorm:"autoUpdateTime" json:"updatedAt"`
}

// HistoryLog represents a single recorded history action entry for display in history panels.
type HistoryLog struct {
	Index      int    `json:"index"`
	ActionName string `json:"actionName"`
	Timestamp  int64  `json:"timestamp"`
}

// AutosaveProfileItem represents an autosaved session profile.
type AutosaveProfileItem struct {
	Key       string `json:"key"`
	Timestamp int64  `json:"timestamp"`
	Location  string `json:"location"`
}

// InternetProfile represents an internet traffic simulation profile.
type InternetProfile struct {
	Name      string         `json:"name"`
	Hourly    map[string]int `json:"hourly,omitempty"`
	Daily     map[string]int `json:"daily,omitempty"`
	Timestamp int64          `json:"timestamp,omitempty"`
}

// SystemInfo represents basic system information.
type SystemInfo struct {
	OS        string `json:"os"`
	Arch      string `json:"arch"`
	GoVersion string `json:"goVersion"`
	Version   string `json:"version"`
}
