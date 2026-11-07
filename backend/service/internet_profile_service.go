package service

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"build-wails/backend/domain"
	"build-wails/backend/logger"
)

// InternetProfileService handles saving, retrieving, and deleting simulated internet traffic profiles.
type InternetProfileService struct{}

// NewInternetProfileService constructs a new InternetProfileService.
func NewInternetProfileService() *InternetProfileService {
	return &InternetProfileService{}
}

// GetProfilesDir returns the filesystem path to the internet profiles directory.
func (s *InternetProfileService) GetProfilesDir() (string, error) {
	userHome, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(userHome, KubeSimulatorDir, "internet_profiles"), nil
}

// GetProfilePath returns the resolved file path for a profile by name.
func (s *InternetProfileService) GetProfilePath(dir, name string) string {
	return filepath.Join(dir, fmt.Sprintf("%s.json", SanitizeProfileFilename(name)))
}

// GetProfiles loads all saved internet profile JSON documents from disk.
func (s *InternetProfileService) GetProfiles() []domain.InternetProfile {
	dir, err := s.GetProfilesDir()
	if err != nil {
		return []domain.InternetProfile{}
	}
	_ = os.MkdirAll(dir, 0755)

	entries, err := os.ReadDir(dir)
	if err != nil {
		return []domain.InternetProfile{}
	}

	profiles := make([]domain.InternetProfile, 0)
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}
		filePath := filepath.Join(dir, entry.Name())
		contentBytes, errRead := os.ReadFile(filePath)
		if errRead != nil {
			continue
		}
		var p domain.InternetProfile
		if errJson := json.Unmarshal(contentBytes, &p); errJson == nil && p.Name != "" {
			profiles = append(profiles, p)
		}
	}
	return profiles
}

// SaveProfile writes an internet profile JSON document to disk.
func (s *InternetProfileService) SaveProfile(name, profileJson string) bool {
	if name == "" || profileJson == "" {
		return false
	}
	dir, err := s.GetProfilesDir()
	if err != nil {
		logger.Error("Failed to resolve user home dir: %v", err)
		return false
	}

	if err := os.MkdirAll(dir, 0755); err != nil {
		logger.Error("Failed to create internet profiles dir: %v", err)
		return false
	}

	filePath := s.GetProfilePath(dir, name)
	if err := os.WriteFile(filePath, []byte(profileJson), 0644); err != nil {
		logger.Error("Error writing internet profile file: %v", err)
		return false
	}
	return true
}

// DeleteProfile removes an internet profile document from disk.
func (s *InternetProfileService) DeleteProfile(name string) bool {
	if name == "" {
		return false
	}
	dir, err := s.GetProfilesDir()
	if err != nil {
		return false
	}

	filePath := s.GetProfilePath(dir, name)
	if err := os.Remove(filePath); err != nil && !os.IsNotExist(err) {
		logger.Error("Error deleting internet profile file: %v", err)
		return false
	}
	return true
}
