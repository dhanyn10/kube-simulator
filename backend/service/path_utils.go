package service

import (
	"path/filepath"
	"strings"
)

// ExpandHomePath expands leading ~ or ~/ to the user's home directory.
func ExpandHomePath(targetPath, homeDir string) string {
	if targetPath == "~" {
		return homeDir
	}
	if strings.HasPrefix(targetPath, "~/") {
		return filepath.Join(homeDir, targetPath[2:])
	}
	return targetPath
}

// SanitizeProfileFilename produces a safe file name from a profile name string.
func SanitizeProfileFilename(name string) string {
	sanitized := strings.ToLower(name)
	sanitized = strings.ReplaceAll(sanitized, " ", "_")
	var builder strings.Builder
	for _, r := range sanitized {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '_' || r == '-' {
			builder.WriteRune(r)
		}
	}
	filename := builder.String()
	if filename == "" {
		return "profile"
	}
	return filename
}
