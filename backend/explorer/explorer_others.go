//go:build !windows

package explorer

import (
	"os/exec"
	"path/filepath"
	"runtime"
)

// OpenInExplorer opens the specified file or directory path in the platform's default file browser.
// It uses `open` on macOS (darwin) and `xdg-open` on Linux and other Unix-like systems.
func OpenInExplorer(filePath string) error {
	cleanPath := filepath.Clean(filePath)
	var cmd *exec.Cmd
	if runtime.GOOS == "darwin" {
		cmd = exec.Command("open", cleanPath)
	} else {
		cmd = exec.Command("xdg-open", cleanPath)
	}
	if err := cmd.Start(); err != nil {
		return err
	}
	return nil
}
