//go:build !windows

package main

import (
	"os/exec"
	"path/filepath"
	"runtime"
)

func openInExplorer(filePath string) error {
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
