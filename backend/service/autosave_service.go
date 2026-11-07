package service

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"build-wails/backend/domain"
)

const (
	KubeSimulatorDir = ".kube-simulator"
	InfraExtension   = ".infra"
)

// AutosaveService manages reading, parsing, and purging auto-saved sessions.
type AutosaveService struct{}

// NewAutosaveService constructs a new AutosaveService.
func NewAutosaveService() *AutosaveService {
	return &AutosaveService{}
}

// GetAutosaveProfiles scans the autosaves directory and returns sorted profiles descending by timestamp.
func (s *AutosaveService) GetAutosaveProfiles() []domain.AutosaveProfileItem {
	userHome, err := os.UserHomeDir()
	if err != nil {
		return []domain.AutosaveProfileItem{}
	}

	dir := filepath.Join(userHome, KubeSimulatorDir, "autosaves")
	entries, err := os.ReadDir(dir)
	if err != nil {
		return []domain.AutosaveProfileItem{}
	}

	items := make([]domain.AutosaveProfileItem, 0)
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), InfraExtension) {
			continue
		}
		key := strings.TrimSuffix(entry.Name(), InfraExtension)
		fullPath := filepath.Join(dir, entry.Name())
		info, errInfo := entry.Info()
		ts := time.Now().UnixMilli()
		if errInfo == nil {
			ts = info.ModTime().UnixMilli()
		}

		// Also check inside JSON if timestamp is recorded
		if contentBytes, errRead := os.ReadFile(fullPath); errRead == nil {
			var parsed struct {
				Timestamp int64 `json:"timestamp"`
			}
			if errJson := json.Unmarshal(contentBytes, &parsed); errJson == nil && parsed.Timestamp > 0 {
				ts = parsed.Timestamp
			}
		}

		locationPath := fmt.Sprintf("~/%s/autosaves/%s", KubeSimulatorDir, entry.Name())
		items = append(items, domain.AutosaveProfileItem{
			Key:       key,
			Timestamp: ts,
			Location:  locationPath,
		})
	}

	sort.Slice(items, func(i, j int) bool {
		return items[i].Timestamp > items[j].Timestamp
	})

	return items
}

// ClearAllAutosaves deletes all .infra files in the autosaves directory and clears autosave settings.
func (s *AutosaveService) ClearAllAutosaves(clearSetting func(key, value string) error) bool {
	userHome, err := os.UserHomeDir()
	if err != nil {
		return false
	}
	dir := filepath.Join(userHome, KubeSimulatorDir, "autosaves")
	entries, err := os.ReadDir(dir)
	if err == nil {
		for _, entry := range entries {
			if !entry.IsDir() && strings.HasSuffix(entry.Name(), InfraExtension) {
				_ = os.Remove(filepath.Join(dir, entry.Name()))
			}
		}
	}
	if clearSetting != nil {
		_ = clearSetting("auto_saved_profile_latest", "")
		_ = clearSetting("auto_saved_profile_content", "")
	}
	return true
}
