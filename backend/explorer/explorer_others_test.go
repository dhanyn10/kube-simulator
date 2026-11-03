//go:build !windows

package explorer

import (
	"testing"
)

func TestGetExplorerCommand_Others(t *testing.T) {
	cmdDarwin := getExplorerCommand("darwin", "/test/path")
	if len(cmdDarwin.Args) == 0 || cmdDarwin.Args[0] != "open" {
		t.Errorf("Expected darwin command to be 'open', got: %v", cmdDarwin.Args)
	}

	cmdLinux := getExplorerCommand("linux", "/test/path")
	if len(cmdLinux.Args) == 0 || cmdLinux.Args[0] != "xdg-open" {
		t.Errorf("Expected linux command to be 'xdg-open', got: %v", cmdLinux.Args)
	}
}
