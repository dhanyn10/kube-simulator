package domain

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
