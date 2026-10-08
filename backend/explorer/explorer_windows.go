//go:build windows

package explorer

import (
	"os/exec"
	"path/filepath"
)

// getExplorerCommand constructs the exec.Cmd for launching Windows File Explorer.
func getExplorerCommand(cleanPath string) *exec.Cmd { //NOSONAR
	return exec.Command("explorer.exe", cleanPath) //NOSONAR
}

// OpenInExplorer opens the specified file or folder in Windows File Explorer.
// It executes the native Windows `explorer.exe` process without hiding its GUI window.
func OpenInExplorer(filePath string) error {
	// explorer.exe is a GUI application; do NOT set HideWindow: true as it causes Windows to launch File Explorer in hidden mode.
	cmd := getExplorerCommand(filepath.Clean(filePath))
	if err := cmd.Start(); err != nil {
		return err
	}
	return nil
}
