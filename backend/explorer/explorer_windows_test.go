//go:build windows

package explorer

import (
	"strings"
	"testing"
)

func TestGetExplorerCommand_Windows(t *testing.T) {
	cmd := getExplorerCommand(`C:\test\path`)
	if cmd == nil {
		t.Fatal("getExplorerCommand returned nil")
	}
	if !strings.Contains(cmd.Path, "explorer.exe") {
		t.Errorf("Expected command path to contain explorer.exe, got: %s", cmd.Path)
	}
	if len(cmd.Args) < 2 || cmd.Args[1] != `C:\test\path` {
		t.Errorf("Expected args to contain path, got: %v", cmd.Args)
	}
}
