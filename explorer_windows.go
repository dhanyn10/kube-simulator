//go:build windows

package main

import (
	"os/exec"
	"path/filepath"
	"syscall"
)

func openInExplorer(filePath string) {
	dir := filepath.Dir(filePath)
	cmd := exec.Command("explorer.exe", filepath.Clean(dir))
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	_ = cmd.Start()
}
