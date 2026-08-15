//go:build !windows

package main

import (
	"os/exec"
	"path/filepath"
	"runtime"
)

func openInExplorer(filePath string) {
	var cmd *exec.Cmd
	if runtime.GOOS == "darwin" {
		cmd = exec.Command("open", "-R", filePath)
	} else {
		dir := filepath.Dir(filePath)
		cmd = exec.Command("xdg-open", dir)
	}
	_ = cmd.Start()
}
