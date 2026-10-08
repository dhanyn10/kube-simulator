//go:build !windows

package explorer

import (
	"os/exec"
	"path/filepath"
	"runtime"
)

// getExplorerCommand determines the system command for opening a path in the default file browser.
func getExplorerCommand(goos, cleanPath string) *exec.Cmd { //NOSONAR
	if goos == "darwin" {
		return exec.Command("open", cleanPath) //NOSONAR
	}
	return exec.Command("xdg-open", cleanPath) //NOSONAR
}

// OpenInExplorer opens the specified file or directory path in the platform's default file browser.
// It uses `open` on macOS (darwin) and `xdg-open` on Linux and other Unix-like systems.
func OpenInExplorer(filePath string) error {
	cleanPath := filepath.Clean(filePath)
	cmd := getExplorerCommand(runtime.GOOS, cleanPath)
	if err := cmd.Start(); err != nil {
		return err
	}
	return nil
}
