//go:build windows

package explorer

import (
	"errors"
	"os/exec"
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

func TestOpenInExplorer_SuccessAndError(t *testing.T) {
	oldStartCmd := StartCmd
	defer func() { StartCmd = oldStartCmd }()

	// Test success with mocked StartCmd
	var calledWith *exec.Cmd
	StartCmd = func(cmd *exec.Cmd) error {
		calledWith = cmd
		return nil
	}

	err := OpenInExplorer(`C:\test\path`)
	if err != nil {
		t.Errorf("Expected nil error on mock success, got %v", err)
	}
	if calledWith == nil || !strings.Contains(calledWith.Path, "explorer.exe") {
		t.Error("Expected StartCmd to be called with explorer.exe")
	}

	// Test error branch
	mockErr := errors.New("failed to start process")
	StartCmd = func(cmd *exec.Cmd) error {
		return mockErr
	}

	err = OpenInExplorer(`C:\test\path`)
	if !errors.Is(err, mockErr) {
		t.Errorf("Expected mockErr, got %v", err)
	}
}
