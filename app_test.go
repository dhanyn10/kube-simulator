package main

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

func setupAppWithDB(t *testing.T) (*App, func()) {
	oldHome := os.Getenv("HOME")
	oldUserProfile := os.Getenv("USERPROFILE")
	tmpDir, err := os.MkdirTemp("", "kube-builder-app-test-*")
	if err != nil {
		t.Fatal(err)
	}

	os.Setenv("HOME", tmpDir)
	os.Setenv("USERPROFILE", tmpDir)

	app := NewApp()
	err = app.history.Init()
	if err != nil {
		t.Fatalf("Failed to initialize history db: %v", err)
	}
	err = app.projects.Init()
	if err != nil {
		t.Fatalf("Failed to initialize projects db: %v", err)
	}

	cleanup := func() {
		app.history.Close()
		app.projects.Close()
		os.Setenv("HOME", oldHome)
		os.Setenv("USERPROFILE", oldUserProfile)
		os.RemoveAll(tmpDir)
	}

	return app, cleanup
}

func TestGetSystemInfo(t *testing.T) {
	app := NewApp()
	info := app.GetSystemInfo()

	if info["os"] != runtime.GOOS {
		t.Errorf("Expected os %s, got %s", runtime.GOOS, info["os"])
	}

	if info["arch"] != runtime.GOARCH {
		t.Errorf("Expected arch %s, got %s", runtime.GOARCH, info["arch"])
	}

	if info["goVersion"] != runtime.Version() {
		t.Errorf("Expected goVersion %s, got %s", runtime.Version(), info["goVersion"])
	}
}

func TestCalculateAppHeight(t *testing.T) {
	app := NewApp()

	tests := []struct {
		screenHeight int
		expected     int
	}{
		{1080, 972},
		{800, 720},
		{900, 810},
		{0, 0},
	}

	for _, tc := range tests {
		result := app.CalculateAppHeight(tc.screenHeight)
		if result != tc.expected {
			t.Errorf("For screenHeight %d, expected %d, got %d", tc.screenHeight, tc.expected, result)
		}
	}
}

func TestGetTargetScreenHeight(t *testing.T) {
	app := NewApp()

	t.Run("empty screen list", func(t *testing.T) {
		height, ok := app.GetTargetScreenHeight([]wailsRuntime.Screen{})
		if ok {
			t.Error("Expected ok to be false for empty screen list")
		}
		if height != 0 {
			t.Errorf("Expected height to be 0, got %d", height)
		}
	})

	t.Run("multiple screens with primary", func(t *testing.T) {
		screens := []wailsRuntime.Screen{
			{IsPrimary: false, Height: 800},
			{IsPrimary: true, Height: 1080},
			{IsPrimary: false, Height: 900},
		}
		height, ok := app.GetTargetScreenHeight(screens)
		if !ok {
			t.Error("Expected ok to be true")
		}
		if height != 1080 {
			t.Errorf("Expected height to be 1080, got %d", height)
		}
	})

	t.Run("multiple screens without primary fallback", func(t *testing.T) {
		screens := []wailsRuntime.Screen{
			{IsPrimary: false, Height: 800},
			{IsPrimary: false, Height: 1080},
		}
		height, ok := app.GetTargetScreenHeight(screens)
		if !ok {
			t.Error("Expected ok to be true")
		}
		if height != 800 {
			t.Errorf("Expected height to fallback to first screen height (800), got %d", height)
		}
	})
}

func TestGreet(t *testing.T) {
	app := NewApp()
	greeting := app.Greet("Jules")
	expected := "Hello Jules, It's show time!"
	if greeting != expected {
		t.Errorf("Expected %s, got %s", expected, greeting)
	}
}

func TestAppProjectActions_NoDB(t *testing.T) {
	// Test methods when DB is not initialized
	app := NewApp()

	if app.SaveProject("Alpha", "{}") != -1 {
		t.Error("Expected SaveProject to fail and return -1 without DB init")
	}

	if app.UpdateProject(1, "{}") != false {
		t.Error("Expected UpdateProject to fail without DB init")
	}

	if app.DeleteProject(1) != false {
		t.Error("Expected DeleteProject to fail without DB init")
	}

	if len(app.GetProjects()) != 0 {
		t.Error("Expected 0 projects without DB init")
	}

	if app.LoadProject(1) != nil {
		t.Error("Expected LoadProject to return nil without DB init")
	}

	if app.SaveSetting("k", "v") != false {
		t.Error("Expected SaveSetting to fail without DB init")
	}

	if app.GetSetting("k") != "" {
		t.Error("Expected GetSetting to return empty without DB init")
	}
}

func TestHistoryActions_NoDB(t *testing.T) {
	app := NewApp()

	// PushHistory shouldn't crash
	app.PushHistory("{}")

	if app.Undo() != "" {
		t.Error("Expected Undo to return empty")
	}

	if app.Redo() != "" {
		t.Error("Expected Redo to return empty")
	}

	if app.JumpToHistory(0) != "" {
		t.Error("Expected JumpToHistory to return empty")
	}

	if len(app.GetHistoryLogs()) != 0 {
		t.Error("Expected 0 history logs")
	}
}

func TestApp_WithDB(t *testing.T) {
	app, cleanup := setupAppWithDB(t)
	defer cleanup()

	// 1. SaveProject
	id := app.SaveProject("Project Alpha", `{"nodes": []}`)
	if id <= 0 {
		t.Fatalf("Expected valid project ID, got %d", id)
	}

	// 2. GetProjects
	projs := app.GetProjects()
	if len(projs) != 1 {
		t.Fatalf("Expected 1 project, got %d", len(projs))
	}
	if projs[0].Name != "Project Alpha" {
		t.Errorf("Expected project name 'Project Alpha', got '%s'", projs[0].Name)
	}

	// 3. LoadProject
	proj := app.LoadProject(id)
	if proj == nil {
		t.Fatal("Expected project to be loaded, got nil")
	}
	if proj.Content != `{"nodes": []}` {
		t.Errorf("Expected content '{\"nodes\": []}', got '%s'", proj.Content)
	}

	// 4. UpdateProject
	ok := app.UpdateProject(id, `{"nodes": [{"id": "1"}]}`)
	if !ok {
		t.Error("Expected UpdateProject to succeed")
	}

	proj = app.LoadProject(id)
	if proj.Content != `{"nodes": [{"id": "1"}]}` {
		t.Errorf("Expected updated content, got '%s'", proj.Content)
	}

	// 5. Save & Get Setting
	ok = app.SaveSetting("theme", "dark")
	if !ok {
		t.Error("Expected SaveSetting to succeed")
	}
	val := app.GetSetting("theme")
	if val != "dark" {
		t.Errorf("Expected setting 'dark', got '%s'", val)
	}

	// Get non-existent setting should return empty string
	nonExistent := app.GetSetting("non_existent")
	if nonExistent != "" {
		t.Errorf("Expected empty string for non-existent setting, got '%s'", nonExistent)
	}

	// 6. DeleteProject
	ok = app.DeleteProject(id)
	if !ok {
		t.Error("Expected DeleteProject to succeed")
	}

	proj = app.LoadProject(id)
	if proj != nil {
		t.Error("Expected loaded project to be nil after deletion")
	}
}

func TestApp_HistoryWithDB(t *testing.T) {
	app, cleanup := setupAppWithDB(t)
	defer cleanup()

	// 1. Push history states
	state1 := `{"actionName": "State 1", "timestamp": 1000}`
	state2 := `{"actionName": "State 2", "timestamp": 2000}`
	state3 := `plain text state`

	app.PushHistory(state1)
	app.PushHistory(state2)
	app.PushHistory(state3)

	// 2. GetHistoryLogs
	logs := app.GetHistoryLogs()
	if len(logs) != 3 {
		t.Fatalf("Expected 3 history logs, got %d", len(logs))
	}

	if logs[0].ActionName != "State 1" || logs[0].Timestamp != 1000 {
		t.Errorf("Unexpected log at index 0: %+v", logs[0])
	}
	if logs[1].ActionName != "State 2" || logs[1].Timestamp != 2000 {
		t.Errorf("Unexpected log at index 1: %+v", logs[1])
	}
	if logs[2].ActionName != "Activity #2" || logs[2].Timestamp != 0 {
		t.Errorf("Unexpected log at index 2 (invalid JSON fallback): %+v", logs[2])
	}

	// 3. Undo and Redo
	undone := app.Undo()
	if undone != state2 {
		t.Errorf("Expected undone to return state2, got '%s'", undone)
	}

	undone2 := app.Undo()
	if undone2 != state1 {
		t.Errorf("Expected undone2 to return state1, got '%s'", undone2)
	}

	undone3 := app.Undo()
	if undone3 != "" {
		t.Errorf("Expected undone3 to return empty string (boundary), got '%s'", undone3)
	}

	redone := app.Redo()
	if redone != state2 {
		t.Errorf("Expected redone to return state2, got '%s'", redone)
	}

	// 4. JumpToHistory
	jumped := app.JumpToHistory(0)
	if jumped != state1 {
		t.Errorf("Expected JumpToHistory(0) to return state1, got '%s'", jumped)
	}

	jumpedInvalid := app.JumpToHistory(99)
	if jumpedInvalid != "" {
		t.Errorf("Expected JumpToHistory(99) to return empty string, got '%s'", jumpedInvalid)
	}
}

func TestApp_StartupShutdown(t *testing.T) {
	oldHome := os.Getenv("HOME")
	oldUserProfile := os.Getenv("USERPROFILE")
	tmpDir, err := os.MkdirTemp("", "kube-builder-app-startup-test-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tmpDir)

	os.Setenv("HOME", tmpDir)
	os.Setenv("USERPROFILE", tmpDir)
	defer func() {
		os.Setenv("HOME", oldHome)
		os.Setenv("USERPROFILE", oldUserProfile)
	}()

	app := NewApp()

	// Create a temporary file to test initial file load
	initialFilePath := filepath.Join(tmpDir, "initial.infra")
	initialContent := "test file content"
	err = os.WriteFile(initialFilePath, []byte(initialContent), 0644)
	if err != nil {
		t.Fatal(err)
	}

	app.SetInitialFile(initialFilePath)

	// Call startup with a background context containing isTestKey.
	// This skips Wails runtime window configuration which would otherwise crash under testing.
	ctx := context.WithValue(context.Background(), isTestKey, true)
	app.startup(ctx)

	// Wait briefly to allow the file loader goroutine to run
	time.Sleep(150 * time.Millisecond)

	// Verify DB is active (can save project)
	id := app.SaveProject("Test Startup Proj", "{}")
	if id <= 0 {
		t.Error("Expected DB to be initialized and writable after startup")
	}

	// Call shutdown
	app.shutdown(context.Background())
}

func TestApp_UtilityMethods(t *testing.T) {
	app := NewApp()

	// 1. GenerateYaml
	yamlOut := app.GenerateYaml(`[]`, `[]`)
	if yamlOut == "" {
		t.Error("GenerateYaml returned empty string")
	}

	// 2. GetSystemResources
	res := app.GetSystemResources()
	if res == nil {
		t.Error("GetSystemResources returned nil")
	}

	// 3. CheckForUpdates
	// CheckForUpdates handles internet errors gracefully and returns nil
	upd := app.CheckForUpdates("1.0.0")
	// If offline, upd is nil. If online, upd can be non-nil. Both are expected/handled.
	_ = upd

	// 4. Window actions should not crash when appCtx is nil
	app.MinimizeWindow()
	app.MaximizeWindow()
	app.CloseWindow()

	// 5. Setup test DB for save/load testing
	app, cleanup := setupAppWithDB(t)
	defer cleanup()

	// 6. Export / Import Project file paths (where appCtx is nil or has a dummy context)
	expOk := app.ExportProjectFile("name", "canvas", "yaml")
	if expOk {
		t.Error("Expected ExportProjectFile to return false with nil context")
	}

	impStr := app.ImportProjectFile()
	if impStr != "" {
		t.Error("Expected ImportProjectFile to return empty string with nil context")
	}
}

type mockRoundTripper func(req *http.Request) (*http.Response, error)

func (f mockRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func TestApp_CoverUndercoveredPaths(t *testing.T) {
	app := NewApp()

	// Setup mock context
	tmpDir, err := os.MkdirTemp("", "kube-builder-app-mock-test-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tmpDir)

	testFilePath := filepath.Join(tmpDir, "test.infra")

	// Set global appCtx with testing values
	ctx := context.WithValue(context.Background(), isTestKey, true)
	ctx = context.WithValue(ctx, testFilePathKey, testFilePath)
	ctx = context.WithValue(ctx, testMaximisedKey, true)
	appCtx = ctx

	defer func() {
		appCtx = nil
	}()

	// 1. Test Window control actions with appCtx set
	app.MinimizeWindow()
	app.MaximizeWindow()
	app.CloseWindow()

	// Also test MaximizeWindow with maximised = false
	ctxFalse := context.WithValue(context.Background(), isTestKey, true)
	ctxFalse = context.WithValue(ctxFalse, testMaximisedKey, false)
	appCtx = ctxFalse
	app.MaximizeWindow()
	appCtx = ctx

	// 2. Test ExportProjectFile (with valid file path)
	ok := app.ExportProjectFile("Alpha", `{"nodes":[]}`, "manifests")
	if !ok {
		t.Error("Expected ExportProjectFile to return true with test path")
	}

	// Read written file to verify
	data, err := os.ReadFile(testFilePath)
	if err != nil {
		t.Fatalf("Failed to read exported file: %v", err)
	}
	if !strings.Contains(string(data), `"name": "Alpha"`) {
		t.Errorf("Expected file to contain project name, got %s", string(data))
	}

	// Test ExportProjectFile failure (with invalid file path)
	ctxInvalid := context.WithValue(context.Background(), isTestKey, true)
	ctxInvalid = context.WithValue(ctxInvalid, testFilePathKey, "/invalid/dir/path/file.infra")
	appCtx = ctxInvalid
	ok = app.ExportProjectFile("Alpha", `{"nodes":[]}`, "manifests")
	if ok {
		t.Error("Expected ExportProjectFile to fail with invalid path")
	}

	// 3. Test ImportProjectFile (with valid file path)
	appCtx = ctx
	imported := app.ImportProjectFile()
	if !strings.Contains(imported, `"name": "Alpha"`) {
		t.Errorf("Expected imported data to contain project name, got %s", imported)
	}

	// Test ImportProjectFile failure (with invalid/empty file path)
	ctxEmpty := context.WithValue(context.Background(), isTestKey, true)
	ctxEmpty = context.WithValue(ctxEmpty, testFilePathKey, "")
	appCtx = ctxEmpty
	imported = app.ImportProjectFile()
	if imported != "" {
		t.Errorf("Expected empty string for empty file import, got %s", imported)
	}

	// Test ImportProjectFile read error (with non-existent file path)
	ctxNonExistent := context.WithValue(context.Background(), isTestKey, true)
	ctxNonExistent = context.WithValue(ctxNonExistent, testFilePathKey, filepath.Join(tmpDir, "does-not-exist.infra"))
	appCtx = ctxNonExistent
	imported = app.ImportProjectFile()
	if imported != "" {
		t.Errorf("Expected empty string for non-existent file import, got %s", imported)
	}
}

func TestApp_DockerHubMethods(t *testing.T) {
	app := NewApp()

	// Mock HTTP Transport
	oldTransport := http.DefaultTransport
	defer func() {
		http.DefaultTransport = oldTransport
	}()

	t.Run("HTTP Success Routes", func(t *testing.T) {
		http.DefaultTransport = mockRoundTripper(func(req *http.Request) (*http.Response, error) {
			urlStr := req.URL.String()
			var body string

			if strings.Contains(urlStr, "/repositories/library/?page_size=20") {
				body = `{"results": [{"name": "nginx"}]}`
			} else if strings.Contains(urlStr, "/tags/?page_size=20") {
				body = `{"results": [{"name": "latest"}]}`
			} else if strings.Contains(urlStr, "/search/repositories/") {
				body = `{"results": [{"name": "nginx-search"}]}`
			} else if strings.Contains(urlStr, "/releases") {
				body = `[{"tag_name": "v2.0.0", "html_url": "https://example.com", "prerelease": false, "draft": false}]`
			} else {
				body = `{}`
			}

			return &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(strings.NewReader(body)),
			}, nil
		})

		pop := app.FetchDockerHubPopular()
		if !strings.Contains(pop, "nginx") {
			t.Errorf("Expected pop response to contain nginx, got %s", pop)
		}

		tags := app.FetchDockerHubTags("nginx")
		if !strings.Contains(tags, "latest") {
			t.Errorf("Expected tags response to contain latest, got %s", tags)
		}

		// Also check user image tags (slash format)
		tagsUser := app.FetchDockerHubTags("library/nginx")
		if !strings.Contains(tagsUser, "latest") {
			t.Errorf("Expected tagsUser response to contain latest, got %s", tagsUser)
		}

		search := app.SearchDockerHub("nginx")
		if !strings.Contains(search, "nginx-search") {
			t.Errorf("Expected search response to contain nginx-search, got %s", search)
		}

		upd := app.CheckForUpdates("1.0.0")
		if upd == nil || upd.LatestVersion != "2.0.0" {
			t.Errorf("Expected latest version to be 2.0.0, got %+v", upd)
		}
	})

	t.Run("HTTP Failure Routes", func(t *testing.T) {
		http.DefaultTransport = mockRoundTripper(func(req *http.Request) (*http.Response, error) {
			return &http.Response{
				StatusCode: http.StatusInternalServerError,
				Body:       io.NopCloser(strings.NewReader("Internal Error")),
			}, nil
		})

		pop := app.FetchDockerHubPopular()
		// Since status is 500, we still read the body in our implementation, but let's see.
		// Wait, FetchDockerHubPopular doesn't check status code, it just reads body!
		if pop != "Internal Error" {
			t.Errorf("Expected pop response to be 'Internal Error', got '%s'", pop)
		}

		tags := app.FetchDockerHubTags("nginx")
		if tags != "Internal Error" {
			t.Errorf("Expected tags response to be 'Internal Error', got '%s'", tags)
		}

		search := app.SearchDockerHub("nginx")
		if search != "Internal Error" {
			t.Errorf("Expected search response to be 'Internal Error', got '%s'", search)
		}
	})

	t.Run("HTTP Hard Error Routes", func(t *testing.T) {
		http.DefaultTransport = mockRoundTripper(func(req *http.Request) (*http.Response, error) {
			return nil, fmt.Errorf("connection refused")
		})

		pop := app.FetchDockerHubPopular()
		if pop != "" {
			t.Errorf("Expected empty response for network failure, got '%s'", pop)
		}

		tags := app.FetchDockerHubTags("nginx")
		if tags != "" {
			t.Errorf("Expected empty response for network failure, got '%s'", tags)
		}

		search := app.SearchDockerHub("nginx")
		if search != "" {
			t.Errorf("Expected empty response for network failure, got '%s'", search)
		}

		upd := app.CheckForUpdates("1.0.0")
		if upd != nil {
			t.Errorf("Expected nil for network failure, got %+v", upd)
		}
	})
}
