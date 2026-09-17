//go:build windows

package main

import (
	"os/exec"
	"path/filepath"
)

func openInExplorer(filePath string) error {
	// explorer.exe is a GUI application; do NOT set HideWindow: true as it causes Windows to launch File Explorer in hidden mode.
	cmd := exec.Command("explorer.exe", filepath.Clean(filePath))
	if err := cmd.Start(); err != nil {
		return err
	}
	return nil
}
