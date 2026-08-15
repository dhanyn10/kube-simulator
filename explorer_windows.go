//go:build windows

package main

import (
	"os/exec"
	"syscall"
)

func openInExplorer(filePath string) {
	cmd := exec.Command("explorer.exe", "/select,", filePath)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	_ = cmd.Start()
}
