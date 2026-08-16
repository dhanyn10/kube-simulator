//go:build !windows

package main

import (
	"os/exec"
	"path/filepath"
	"runtime"
)

func openInExplorer(filePath string) {
	dir := filepath.Dir(filePath)
	var cmd *exec.Cmd
	if runtime.GOOS == "darwin" {
		cmd = exec.Command("open", dir)
	} else {
		cmd = exec.Command("xdg-open", dir)
	}
	_ = cmd.Start()
}
