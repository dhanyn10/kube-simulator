//go:build windows

package explorer

import (
	"os/exec"
	"path/filepath"
)

// OpenInExplorer opens the specified file or folder in Windows File Explorer.
// It executes the native Windows `explorer.exe` process without hiding its GUI window.
func OpenInExplorer(filePath string) error {
	// explorer.exe is a GUI application; do NOT set HideWindow: true as it causes Windows to launch File Explorer in hidden mode.
	cmd := exec.Command("explorer.exe", filepath.Clean(filePath))
	if err := cmd.Start(); err != nil {
		return err
	}
	return nil
}
