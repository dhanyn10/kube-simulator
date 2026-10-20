package main

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"

	"github.com/dgraph-io/badger/v4"
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

func TestWriteLog(t *testing.T) {
	app := NewApp()
	ok := app.WriteLog("canvas", "info", "Placed card test")
	if !ok {
		t.Error("Expected WriteLog to return true")
	}
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
	ctxNonExistent := context.WithValue(context.WithValue(context.Background(), isTestKey, true), testFilePathKey, filepath.Join(tmpDir, "does-not-exist.infra"))
	appCtx = ctxNonExistent
	imported = app.ImportProjectFile()
	if imported != "" {
		t.Errorf("Expected empty string for non-existent file import, got %s", imported)
	}

	// 4. Test OpenLogFile
	logFilePath := filepath.Join(tmpDir, "app_logs.jsonl")
	_ = os.WriteFile(logFilePath, []byte(`{"message": "test"}`), 0644)
	ctxLog := context.WithValue(context.WithValue(context.Background(), isTestKey, true), testFilePathKey, logFilePath)
	appCtx = ctxLog

	logOk := app.OpenLogFile()
	if !logOk {
		t.Error("Expected OpenLogFile to return true with test log path")
	}

	logData, err := os.ReadFile(logFilePath)
	if err != nil {
		t.Fatalf("Failed to read log file: %v", err)
	}
	if !strings.Contains(string(logData), "test") {
		t.Errorf("Expected log file content to remain intact, got %s", string(logData))
	}
}

func mockDockerHubBody(urlStr string) string {
	if strings.Contains(urlStr, "/repositories/library/?page_size=20") {
		return `{"results": [{"name": "nginx"}]}`
	}
	if strings.Contains(urlStr, "/tags/?page_size=20") {
		return `{"results": [{"name": "latest"}]}`
	}
	if strings.Contains(urlStr, "/search/repositories/") {
		return `{"results": [{"name": "nginx-search"}]}`
	}
	if strings.Contains(urlStr, "/releases") {
		return `[{"tag_name": "v2.0.0", "html_url": "https://example.com", "prerelease": false, "draft": false}]`
	}
	return `{}`
}

func TestApp_DockerHubMethods_Success(t *testing.T) {
	app := NewApp()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body := mockDockerHubBody(r.URL.String())
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(body))
	}))
	defer server.Close()

	app.dockerHub.SetBaseURL(server.URL)

	if pop := app.FetchDockerHubPopular(); !strings.Contains(pop, "nginx") {
		t.Errorf("Expected pop response to contain nginx, got %s", pop)
	}
	if tags := app.FetchDockerHubTags("nginx"); !strings.Contains(tags, "latest") {
		t.Errorf("Expected tags response to contain latest, got %s", tags)
	}
	if tagsUser := app.FetchDockerHubTags("library/nginx"); !strings.Contains(tagsUser, "latest") {
		t.Errorf("Expected tagsUser response to contain latest, got %s", tagsUser)
	}
	if search := app.SearchDockerHub("nginx"); !strings.Contains(search, "nginx-search") {
		t.Errorf("Expected search response to contain nginx-search, got %s", search)
	}
}

func TestApp_DockerHubMethods_HardError(t *testing.T) {
	app := NewApp()
	app.dockerHub.SetBaseURL("http://127.0.0.1:0")

	if pop := app.FetchDockerHubPopular(); pop != "" {
		t.Errorf("Expected empty response for network failure, got '%s'", pop)
	}
	if tags := app.FetchDockerHubTags("nginx"); tags != "" {
		t.Errorf("Expected empty response for network failure, got '%s'", tags)
	}
	if search := app.SearchDockerHub("nginx"); search != "" {
		t.Errorf("Expected empty response for network failure, got '%s'", search)
	}
}

func TestApp_OpenLogFile_EmptyPath(t *testing.T) {
	app := NewApp()
	ctx := context.WithValue(context.Background(), isTestKey, true)
	ctx = context.WithValue(ctx, testFilePathKey, "")
	appCtx = ctx
	defer func() { appCtx = nil }()

	// If GetLogFilePath returns a valid path default, OpenLogFile will succeed or use GetLogFilePath.
	// Test directly
	_ = app.OpenLogFile()
}

func TestApp_GetTargetScreen_Empty(t *testing.T) {
	app := NewApp()
	_, ok := app.GetTargetScreen([]wailsRuntime.Screen{})
	if ok {
		t.Error("Expected GetTargetScreen to return false for empty screens slice")
	}
}

func TestApp_FileExistsAndOpenFileFolder(t *testing.T) {
	app, cleanup := setupAppWithDB(t)
	defer cleanup()

	tmpDir, err := os.MkdirTemp("", "kube-test-file-exists-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tmpDir)

	filePath := filepath.Join(tmpDir, "sample.infra")
	_ = os.WriteFile(filePath, []byte("{}"), 0644)

	// FileExists
	if !app.FileExists(filePath) {
		t.Errorf("Expected FileExists to return true for %s", filePath)
	}
	if app.FileExists(filepath.Join(tmpDir, "nonexistent.infra")) {
		t.Errorf("Expected FileExists to return false for non-existent file")
	}
	if app.FileExists("") {
		t.Error("Expected FileExists to return false for empty string")
	}

	// OpenFileFolder
	if !app.OpenFileFolder(filePath) {
		t.Error("Expected OpenFileFolder to return true")
	}
	if !app.OpenFileFolder("") {
		t.Error("Expected OpenFileFolder to handle empty string and return true")
	}

	// GetAutosaveProfiles
	app.SaveSetting("autosave-test1", `{"timestamp": 123456789}`)
	profiles := app.GetAutosaveProfiles()
	if len(profiles) == 0 {
		t.Error("Expected GetAutosaveProfiles to return at least 1 profile")
	}
}

func TestApp_InternetProfiles(t *testing.T) {
	app, cleanup := setupAppWithDB(t)
	defer cleanup()

	// 1. Initial GetInternetProfiles should be empty or non-nil
	initial := app.GetInternetProfiles()
	if len(initial) != 0 {
		t.Errorf("Expected 0 profiles initially, got %d", len(initial))
	}

	// 2. Save invalid profile
	if app.SaveInternetProfile("", "") != false {
		t.Error("Expected SaveInternetProfile to fail with empty name")
	}

	// 3. Save valid profile with hourly and daily data
	sampleProfile := `{"name":"Custom Peak","hourly":{"00:00":1200,"12:00":3500},"daily":{"Monday":100,"Tuesday":200,"Wednesday":150,"Thursday":300,"Friday":250,"Saturday":500,"Sunday":400},"timestamp":1700000000}`
	ok := app.SaveInternetProfile("Custom Peak", sampleProfile)
	if !ok {
		t.Error("Expected SaveInternetProfile to succeed")
	}

	// 4. GetInternetProfiles should find the saved profile with hourly data preserved
	savedList := app.GetInternetProfiles()
	if len(savedList) != 1 {
		t.Fatalf("Expected 1 profile, got %d", len(savedList))
	}
	if savedList[0].Name != "Custom Peak" {
		t.Errorf("Expected profile name 'Custom Peak', got '%s'", savedList[0].Name)
	}
	if savedList[0].Hourly["00:00"] != 1200 || savedList[0].Hourly["12:00"] != 3500 {
		t.Errorf("Expected hourly values '00:00': 1200 and '12:00': 3500, got %+v", savedList[0].Hourly)
	}
	if savedList[0].Daily["Saturday"] != 500 {
		t.Errorf("Expected Saturday daily value 500, got %d", savedList[0].Daily["Saturday"])
	}

	// 5. Delete profile
	if app.DeleteInternetProfile("") != false {
		t.Error("Expected DeleteInternetProfile to return false for empty name")
	}

	deletedOk := app.DeleteInternetProfile("Custom Peak")
	if !deletedOk {
		t.Error("Expected DeleteInternetProfile to succeed")
	}

	afterDelete := app.GetInternetProfiles()
	if len(afterDelete) != 0 {
		t.Errorf("Expected 0 profiles after delete, got %d", len(afterDelete))
	}
}

func TestApp_ComprehensiveEdgeCases(t *testing.T) {
	app, cleanup := setupAppWithDB(t)
	defer cleanup()

	tmpHome := os.Getenv("USERPROFILE")
	if tmpHome == "" {
		tmpHome = os.Getenv("HOME")
	}

	t.Run("expandHomePath and FileExists variations", func(t *testing.T) {
		// 1. FileExists with "~" (directory, not file) -> false
		if app.FileExists("~") {
			t.Error("Expected FileExists('~') to return false for directory")
		}

		// 2. FileExists with "~/something"
		subFile := filepath.Join(tmpHome, "test_home.infra")
		_ = os.WriteFile(subFile, []byte("{}"), 0644)
		if !app.FileExists("~/test_home.infra") {
			t.Error("Expected FileExists('~/test_home.infra') to return true")
		}

		// 3. FileExists with non-existent "~/" path
		if app.FileExists("~/non_existent_file.infra") {
			t.Error("Expected FileExists with non-existent ~/ file to return false")
		}
	})

	t.Run("OpenFileFolder variations", func(t *testing.T) {
		// 1. OpenFileFolder with "~"
		if !app.OpenFileFolder("~") {
			t.Error("Expected OpenFileFolder('~') to return true")
		}

		// 2. OpenFileFolder with "~/" path
		if !app.OpenFileFolder("~/subfolder") {
			t.Error("Expected OpenFileFolder('~/subfolder') to return true")
		}

		// 3. OpenFileFolder with relative path
		if !app.OpenFileFolder("relative/path/folder") {
			t.Error("Expected OpenFileFolder with relative path to return true")
		}

		// 4. OpenFileFolder with non-existent path that creates parent folder
		nonExistentFile := filepath.Join(tmpHome, "new_nested_dir", "file.infra")
		if !app.OpenFileFolder(nonExistentFile) {
			t.Error("Expected OpenFileFolder to create directory and return true")
		}
		if _, err := os.Stat(filepath.Dir(nonExistentFile)); os.IsNotExist(err) {
			t.Error("Expected parent directory to be created")
		}
	})

	t.Run("OpenLogFile creates non-existent log file", func(t *testing.T) {
		newLogPath := filepath.Join(tmpHome, "logs_sub", "new_app_logs.jsonl")
		ctx := context.WithValue(context.Background(), isTestKey, true)
		ctx = context.WithValue(ctx, testFilePathKey, newLogPath)
		appCtx = ctx
		defer func() { appCtx = nil }()

		if !app.OpenLogFile() {
			t.Error("Expected OpenLogFile to return true")
		}
		if _, err := os.Stat(newLogPath); os.IsNotExist(err) {
			t.Error("Expected OpenLogFile to create missing log file")
		}
	})

	t.Run("selectProjectFileDialog and getTestFilePath with empty test path", func(t *testing.T) {
		ctx := context.WithValue(context.Background(), isTestKey, true)
		// isTestKey is set, but testFilePathKey is not set
		appCtx = ctx
		defer func() { appCtx = nil }()

		if app.ExportProjectFile("EmptyPath", "{}", "") {
			t.Error("Expected ExportProjectFile to return false when testFilePath is empty")
		}
		if res := app.ImportProjectFile(); res != "" {
			t.Errorf("Expected ImportProjectFile to return empty string, got %s", res)
		}
	})

	t.Run("GetHistoryLogs with corrupted entry and index gap", func(t *testing.T) {
		badgerDB := app.history.GetDB()
		if badgerDB == nil {
			t.Fatal("Expected badgerDB to be non-nil")
		}

		// Push one normal history item so maxIndex >= 0
		app.PushHistory("{}")

		// Corrupt entry hist:0 with invalid JSON
		_ = badgerDB.Update(func(txn *badger.Txn) error {
			return txn.Set([]byte("hist:0"), []byte("invalid-non-json-content"))
		})

		logs := app.GetHistoryLogs()
		if len(logs) == 0 {
			t.Fatal("Expected logs to not be empty")
		}
		if logs[0].ActionName != "Activity #0" {
			t.Errorf("Expected fallback action name 'Activity #0', got '%s'", logs[0].ActionName)
		}

		// Delete hist:0 to test index gap (err != nil in txn.Get)
		_ = badgerDB.Update(func(txn *badger.Txn) error {
			return txn.Delete([]byte("hist:0"))
		})
		logsAfterDelete := app.GetHistoryLogs()
		if len(logsAfterDelete) != 0 {
			t.Errorf("Expected 0 logs after deleting index 0, got %d", len(logsAfterDelete))
		}
	})

	t.Run("GetAutosaveProfiles with edge cases", func(t *testing.T) {
		autosavesDir := filepath.Join(tmpHome, kubeSimulatorDir, "autosaves")
		_ = os.RemoveAll(autosavesDir)

		// 1. Dir does not exist yet
		emptyProfiles := app.GetAutosaveProfiles()
		if len(emptyProfiles) != 0 {
			t.Errorf("Expected 0 autosave profiles when dir missing, got %d", len(emptyProfiles))
		}

		// 2. Dir contains a subdirectory and a non-.infra file
		_ = os.MkdirAll(filepath.Join(autosavesDir, "subfolder"), 0755)
		_ = os.WriteFile(filepath.Join(autosavesDir, "ignore.txt"), []byte("text"), 0644)
		_ = os.WriteFile(filepath.Join(autosavesDir, "profile1.infra"), []byte(`{"timestamp": 1712345678000}`), 0644)
		_ = os.WriteFile(filepath.Join(autosavesDir, "profile2.infra"), []byte(`invalid json`), 0644)
		_ = os.WriteFile(filepath.Join(autosavesDir, "profile3.infra"), []byte(`{"timestamp": 0}`), 0644)

		profiles := app.GetAutosaveProfiles()
		if len(profiles) != 3 {
			t.Fatalf("Expected exactly 3 .infra profiles, got %d", len(profiles))
		}

		var foundProfile1 bool
		for _, p := range profiles {
			if p.Key == "profile1" {
				foundProfile1 = true
				if p.Timestamp != 1712345678000 {
					t.Errorf("Expected profile1 timestamp 1712345678000, got %d", p.Timestamp)
				}
			}
		}
		if !foundProfile1 {
			t.Error("Expected to find profile1")
		}
	})

	t.Run("sanitizeProfileFilename fallback", func(t *testing.T) {
		// All symbols stripped -> returns "profile"
		saved := app.SaveInternetProfile("!@#$%^&*()+=", `{"name":"Symbols Only"}`)
		if !saved {
			t.Error("Expected SaveInternetProfile with symbols to succeed with fallback name")
		}
		profiles := app.GetInternetProfiles()
		var found bool
		for _, p := range profiles {
			if p.Name == "Symbols Only" {
				found = true
			}
		}
		if !found {
			t.Error("Expected profile 'Symbols Only' to be saved and found")
		}
		app.DeleteInternetProfile("!@#$%^&*()+=")
	})

	t.Run("GetInternetProfiles with invalid entries", func(t *testing.T) {
		ipDir, _ := app.getInternetProfilesDir()
		_ = os.MkdirAll(filepath.Join(ipDir, "subfolder"), 0755)
		_ = os.WriteFile(filepath.Join(ipDir, "readme.txt"), []byte("hello"), 0644)
		_ = os.WriteFile(filepath.Join(ipDir, "invalid.json"), []byte("invalid-json"), 0644)
		_ = os.WriteFile(filepath.Join(ipDir, "noname.json"), []byte(`{"hourly":{}}`), 0644)

		// Also save a valid profile
		app.SaveInternetProfile("Valid Profile", `{"name":"Valid Profile"}`)
		defer app.DeleteInternetProfile("Valid Profile")

		profiles := app.GetInternetProfiles()
		var validFound bool
		for _, p := range profiles {
			if p.Name == "Valid Profile" {
				validFound = true
			}
		}
		if !validFound {
			t.Error("Expected valid profile to be found while skipping invalid entries")
		}
	})

	t.Run("SaveInternetProfile and DeleteInternetProfile edge cases", func(t *testing.T) {
		// Empty JSON
		if app.SaveInternetProfile("name", "") {
			t.Error("Expected SaveInternetProfile to fail with empty JSON")
		}

		// Delete non-existent profile (should return true without crashing)
		if !app.DeleteInternetProfile("non_existent_profile_xyz") {
			t.Error("Expected DeleteInternetProfile for non-existent profile to return true")
		}
	})

	t.Run("handleInitialFileOpen with valid file", func(t *testing.T) {
		testFile := filepath.Join(tmpHome, "initial_test.infra")
		_ = os.WriteFile(testFile, []byte(`{"name":"initial"}`), 0644)

		app.SetInitialFile(testFile)
		ctx := context.WithValue(context.Background(), isTestKey, true)
		app.handleInitialFileOpen(ctx)

		time.Sleep(30 * time.Millisecond)

		// Reset initialFilePath
		app.SetInitialFile("")
		app.handleInitialFileOpen(ctx) // Should return immediately
	})

	t.Run("UserHomeDir failure error paths", func(t *testing.T) {
		oldHome := os.Getenv("HOME")
		oldUserProfile := os.Getenv("USERPROFILE")
		oldHomeDrive := os.Getenv("HOMEDRIVE")
		oldHomePath := os.Getenv("HOMEPATH")

		os.Setenv("HOME", "")
		os.Setenv("USERPROFILE", "")
		os.Setenv("HOMEDRIVE", "")
		os.Setenv("HOMEPATH", "")

		defer func() {
			os.Setenv("HOME", oldHome)
			os.Setenv("USERPROFILE", oldUserProfile)
			os.Setenv("HOMEDRIVE", oldHomeDrive)
			os.Setenv("HOMEPATH", oldHomePath)
		}()

		if app.FileExists("some-file") {
			t.Error("Expected FileExists to return false when home dir fails")
		}
		if app.OpenFileFolder("some-folder") {
			t.Error("Expected OpenFileFolder to return false when home dir fails")
		}
		if profiles := app.GetAutosaveProfiles(); len(profiles) != 0 {
			t.Errorf("Expected 0 autosave profiles when home dir fails, got %d", len(profiles))
		}
		if _, err := app.getInternetProfilesDir(); err == nil {
			t.Error("Expected getInternetProfilesDir to return error when home dir fails")
		}
		if profiles := app.GetInternetProfiles(); len(profiles) != 0 {
			t.Errorf("Expected 0 internet profiles when home dir fails, got %d", len(profiles))
		}
		if app.SaveInternetProfile("name", "{}") {
			t.Error("Expected SaveInternetProfile to return false when home dir fails")
		}
		if app.DeleteInternetProfile("name") {
			t.Error("Expected DeleteInternetProfile to return false when home dir fails")
		}
	})

	t.Run("getTestFilePath when appCtx is nil", func(t *testing.T) {
		appCtx = nil
		path, isTest := getTestFilePath()
		if isTest || path != "" {
			t.Errorf("Expected empty string and false, got %s and %v", path, isTest)
		}
	})
}
