//go:build windows

package main

import (
	"os/exec"
	"path/filepath"
	"syscall"
)

func openInExplorer(filePath string) error {
	dir := filepath.Dir(filePath)
	cmd := exec.Command("explorer.exe", filepath.Clean(dir))
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	if err := cmd.Start(); err != nil {
		return err
	}
	return nil
}
