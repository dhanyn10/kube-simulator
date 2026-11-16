package main

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"

	"build-wails/backend/explorer"
	"build-wails/backend/system"

	"github.com/wailsapp/wails/v3/pkg/application"
)

func TestHandleFileAssociation_NoArgs(t *testing.T) {
	oldArgs := os.Args
	defer func() { os.Args = oldArgs }()

	os.Args = []string{"kube-simulator"}
	app := NewApp()
	handleFileAssociation(app)

	if app.initialFilePath != "" {
		t.Errorf("Expected empty initialFilePath when no args provided, got %s", app.initialFilePath)
	}
}

func TestHandleFileAssociation_NonInfraFile(t *testing.T) {
	oldArgs := os.Args
	defer func() { os.Args = oldArgs }()

	tmpFile := filepath.Join(t.TempDir(), "config.json")
	_ = os.WriteFile(tmpFile, []byte("{}"), 0644)

	os.Args = []string{"kube-simulator", tmpFile}
	app := NewApp()
	handleFileAssociation(app)

	if app.initialFilePath != "" {
		t.Errorf("Expected empty initialFilePath for non-.infra file, got %s", app.initialFilePath)
	}
}

func TestHandleFileAssociation_NonExistentInfraFile(t *testing.T) {
	oldArgs := os.Args
	defer func() { os.Args = oldArgs }()

	os.Args = []string{"kube-simulator", filepath.Join(t.TempDir(), "does-not-exist.infra")}
	app := NewApp()
	handleFileAssociation(app)

	if app.initialFilePath != "" {
		t.Errorf("Expected empty initialFilePath for nonexistent .infra file, got %s", app.initialFilePath)
	}
}

func TestHandleFileAssociation_ValidInfraFile(t *testing.T) {
	oldArgs := os.Args
	defer func() { os.Args = oldArgs }()

	tmpFile := filepath.Join(t.TempDir(), "project.infra")
	_ = os.WriteFile(tmpFile, []byte(`{"version": "1.0"}`), 0644)

	os.Args = []string{"kube-simulator", tmpFile}
	app := NewApp()
	handleFileAssociation(app)

	absExpected, _ := filepath.Abs(tmpFile)
	if app.initialFilePath != absExpected {
		t.Errorf("Expected initialFilePath %s, got %s", absExpected, app.initialFilePath)
	}
}

func TestSetupApplicationMenu(t *testing.T) {
	testApp := application.New(application.Options{})
	menu := setupApplicationMenu(testApp)
	if menu == nil {
		t.Fatal("Expected non-nil menu from setupApplicationMenu")
	}

	aboutItem := menu.FindByLabel("About")
	if aboutItem == nil {
		t.Fatal("Expected 'About' menu item to exist")
	}
}

func TestSetAppWindowTitle(t *testing.T) {
	oldCtx := appCtx
	defer func() { appCtx = oldCtx }()

	// 1. In test mode, isLiveRuntime() is false so setAppWindowTitle safely no-ops
	appCtx = context.WithValue(context.Background(), isTestKey, true)
	setAppWindowTitle("My Project Test")

	// 2. In live mode, isLiveRuntime() is true, GetActiveWindow() is checked
	appCtx = context.Background()
	setAppWindowTitle("My Project Live")
}

func TestSelectProjectFileDialog_TestContext(t *testing.T) {
	app := NewApp()

	// When isTestKey is true but testFilePathKey is absent, selectProjectFileDialog returns ("", nil)
	ctx := context.WithValue(context.Background(), isTestKey, true)
	oldCtx := appCtx
	appCtx = ctx
	defer func() { appCtx = oldCtx }()

	path, err := app.selectProjectFileDialog(false, "", "Open Project")
	if err != nil {
		t.Errorf("Unexpected error: %v", err)
	}
	if path != "" {
		t.Errorf("Expected empty path, got %s", path)
	}
}

func TestConfigureStartupWindow_BoundsFallbackAndEmpty(t *testing.T) {
	app := NewApp()

	// Test with empty screen list (ok == false, early return)
	ctxWithTest := context.WithValue(context.Background(), isTestKey, true)
	app.configureStartupWindow(ctxWithTest)

	// Test GetTargetScreen with Bounds fallback (Width/Height in Bounds, Size is 0)
	screens := []application.Screen{
		{
			IsPrimary: true,
			Size:      application.Size{Width: 0, Height: 0},
			Bounds:    application.Rect{Width: 1600, Height: 900},
		},
	}
	s, ok := app.GetTargetScreen(screens)
	if !ok {
		t.Fatal("Expected target screen with bounds fallback")
	}
	if s.Bounds.Width != 1600 || s.Bounds.Height != 900 {
		t.Errorf("Unexpected screen: %+v", s)
	}
}

func TestConfigureStartupWindow_LiveContext(t *testing.T) {
	app := NewApp()
	// Call configureStartupWindow with live context (isTestKey absent)
	app.configureStartupWindow(context.Background())
}

func TestApp_Startup_LiveContext(t *testing.T) {
	oldHome := os.Getenv("HOME")
	oldUserProfile := os.Getenv("USERPROFILE")
	tmpDir := t.TempDir()
	os.Setenv("HOME", tmpDir)
	os.Setenv("USERPROFILE", tmpDir)
	defer func() {
		os.Setenv("HOME", oldHome)
		os.Setenv("USERPROFILE", oldUserProfile)
	}()

	app := NewApp()
	defer app.shutdown(context.Background())

	// Call startup with live context
	app.startup(context.Background())
}

func TestApp_CheckForUpdates_AvailableAndError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		releases := []system.GitHubRelease{
			{TagName: "v2.0.0", HTMLURL: "https://example.com/2.0.0", Prerelease: false, Draft: false},
		}
		_ = json.NewEncoder(w).Encode(releases)
	}))
	defer server.Close()

	restore := system.SetAPIBaseURL(server.URL)
	defer restore()

	app := NewApp()
	info := app.CheckForUpdates("1.0.0")
	if info == nil || !info.UpdateAvailable || info.LatestVersion != "2.0.0" {
		t.Errorf("Expected update available 2.0.0, got %+v", info)
	}

	// Error branch
	restoreErr := system.SetAPIBaseURL("http://127.0.0.1:0")
	defer restoreErr()

	errInfo := app.CheckForUpdates("1.0.0")
	if errInfo != nil {
		t.Errorf("Expected nil info on connection error, got %+v", errInfo)
	}
}

func TestApp_OpenLogFile_ExplorerBranches(t *testing.T) {
	app := NewApp()

	oldStartCmd := explorer.StartCmd
	defer func() { explorer.StartCmd = oldStartCmd }()

	oldCtx := appCtx
	defer func() { appCtx = oldCtx }()

	// Live context where shouldOpenInExplorer() is true
	appCtx = context.Background()

	// 1. Success branch
	explorer.StartCmd = func(_ *exec.Cmd) error { return nil }
	if !app.OpenLogFile() {
		t.Error("Expected OpenLogFile to succeed when StartCmd succeeds")
	}

	// 2. Error branch
	explorer.StartCmd = func(_ *exec.Cmd) error { return errors.New("cannot open explorer") }
	if app.OpenLogFile() {
		t.Error("Expected OpenLogFile to fail when StartCmd fails")
	}
}

func TestApp_HandleInitialFileOpen_LiveContext(t *testing.T) {
	tmpFile := filepath.Join(t.TempDir(), "startup.infra")
	_ = os.WriteFile(tmpFile, []byte(`{"version":"1.0"}`), 0644)

	app := NewApp()
	app.SetInitialFile(tmpFile)

	// Call with live context
	app.handleInitialFileOpen(context.Background())
	time.Sleep(50 * time.Millisecond)
}
