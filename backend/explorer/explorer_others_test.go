//go:build !windows

package explorer

import (
	"testing"
)

func TestGetExplorerCommand_Others(t *testing.T) {
	cmdDarwin := getExplorerCommand("darwin", "/test/path")
	if cmdDarwin.Path != "open" {
		t.Errorf("Expected darwin command to be 'open', got: %s", cmdDarwin.Path)
	}

	cmdLinux := getExplorerCommand("linux", "/test/path")
	if cmdLinux.Path != "xdg-open" {
		t.Errorf("Expected linux command to be 'xdg-open', got: %s", cmdLinux.Path)
	}
}
