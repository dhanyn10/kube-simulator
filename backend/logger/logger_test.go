package logger

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/wailsapp/wails/v3/pkg/application"
)

func TestLogger(t *testing.T) {
	isTest = true
	// Test without context
	Init(nil)
	Info("info message no ctx")

	// Test with context
	Init(context.Background())

	// Test different log levels
	Info("info message")
	Warn("warn message")
	Error("error message")
	Fatal("fatal message")

	// Test WailsWriter
	writer := &WailsWriter{Level: "info"}
	n, err := writer.Write([]byte("writer message"))
	if err != nil {
		t.Errorf("WailsWriter.Write returned error: %v", err)
	}
	if n != len("writer message") {
		t.Errorf("WailsWriter.Write returned %d, want %d", n, len("writer message"))
	}
}

func TestAppendCategorizedLog(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "kube-logger-test-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tmpDir)

	SetLogFilePath(filepath.Join(tmpDir, "app_logs.jsonl"))

	AppendCategorizedLog("canvas", "info", "Canvas placed card")
	AppendCategorizedLog("kubeconsole", "info", "kubectl get pods")
	AppendCategorizedLog("report", "info", "Simulation metric report")
	AppendCategorizedLog("app", "error", "Backend error occurred")

	data, err := os.ReadFile(GetLogFilePath())
	if err != nil {
		t.Fatalf("Failed to read log file: %v", err)
	}
	content := string(data)
	if !strings.Contains(content, "Canvas placed card") {
		t.Errorf("Expected content to contain canvas log message, got: %s", content)
	}
	if !strings.Contains(content, `"category":"canvas"`) {
		t.Errorf("Expected content to contain canvas category, got: %s", content)
	}
	if !strings.Contains(content, `"category":"kubeconsole"`) {
		t.Errorf("Expected content to contain kubeconsole category, got: %s", content)
	}
}

func TestLoggerCategoriesAndPaths(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "kube-logger-categories-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tmpDir)

	// Test clearing custom log file path
	SetLogFilePath("")
	path := GetLogFilePath()
	if path == "" {
		t.Error("GetLogFilePath returned empty string")
	}

	SetLogFilePath(filepath.Join(tmpDir, "custom_app.jsonl"))

	AppendCategorizedLog("history", "info", "History step")
	AppendCategorizedLog("terminal", "warn", "Terminal warn")
	AppendCategorizedLog("console", "error", "Console error")
	AppendCategorizedLog("simulation", "info", "Simulation tick")
	AppendCategorizedLog("unknown_cat", "info", "Default category")

	content, err := os.ReadFile(GetLogFilePath())
	if err != nil {
		t.Fatalf("Failed to read log file: %v", err)
	}
	contentStr := string(content)

	if !strings.Contains(contentStr, `"category":"history"`) {
		t.Error("Missing history category in log file")
	}
	if !strings.Contains(contentStr, `"category":"terminal"`) {
		t.Error("Missing terminal category in log file")
	}
	if !strings.Contains(contentStr, `"category":"simulation"`) {
		t.Error("Missing simulation category in log file")
	}
}

func TestAppendToLogFile_InvalidPath(t *testing.T) {
	// Point to an invalid file path (e.g., a directory)
	tmpDir, err := os.MkdirTemp("", "kube-logger-invalid-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tmpDir)

	SetLogFilePath(tmpDir)       // directory instead of file
	appendToLogFile("test line") // Should not panic or fail ungracefully
}

func TestAppendCategorizedLog_DefaultPath(t *testing.T) {
	oldPath := GetLogFilePath()
	defer SetLogFilePath(oldPath)

	SetLogFilePath("")
	AppendCategorizedLog("report", "info", "Report message to default path")
}

func TestAppendToLogFile_EmptyPath(t *testing.T) {
	appendToLogFile("test append direct")
}

func TestEmit_LiveMode(t *testing.T) {
	isTest = false
	defer func() { isTest = true }()

	tmpDir := t.TempDir()
	logFile := filepath.Join(tmpDir, "emit_test.log")
	SetLogFilePath(logFile)
	defer SetLogFilePath("")

	emit("INFO", "Live mode emit test message")

	content, err := os.ReadFile(logFile)
	if err != nil {
		t.Fatalf("Failed to read log file: %v", err)
	}
	if !strings.Contains(string(content), "Live mode emit test message") {
		t.Errorf("Expected log file to contain emit message")
	}
}

func setLoggerTempDir(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	t.Setenv("TMPDIR", dir)
	t.Setenv("TMP", dir)
	t.Setenv("TEMP", dir)
	return dir
}

func TestGetLogFilePath_ConfigDirFallback(t *testing.T) {
	setLoggerTempDir(t)

	oldPath := GetLogFilePath()
	defer SetLogFilePath(oldPath)

	origConfigDir := getUserConfigDir
	defer func() { getUserConfigDir = origConfigDir }()

	tests := []struct {
		name     string
		provider func() (string, error)
	}{
		{name: "error", provider: func() (string, error) { return "", errors.New("config dir unavailable") }},
		{name: "empty", provider: func() (string, error) { return "", nil }},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			SetLogFilePath("")
			getUserConfigDir = tt.provider

			path := GetLogFilePath()
			wantDir := filepath.Join(os.TempDir(), appDirName)
			if filepath.Dir(path) != wantDir {
				t.Errorf("Expected log path in %q, got %q", wantDir, path)
			}
		})
	}
}

func TestAppendToLogFile_EmptyProviderPath(t *testing.T) {
	origProvider := getLogFilePath
	defer func() { getLogFilePath = origProvider }()
	getLogFilePath = func() string { return "" }

	appendToLogFile("ignored line")
}

func TestAppendCategorizedLog_ConfigDirFallback(t *testing.T) {
	tmpDir := setLoggerTempDir(t)

	oldPath := GetLogFilePath()
	defer SetLogFilePath(oldPath)
	SetLogFilePath(filepath.Join(tmpDir, "app.jsonl"))

	origConfigDir := getUserConfigDir
	defer func() { getUserConfigDir = origConfigDir }()
	getUserConfigDir = func() (string, error) { return "", errors.New("config dir unavailable") }

	AppendCategorizedLog("console", "info", "config dir fallback message")

	content, err := os.ReadFile(filepath.Join(tmpDir, "app.jsonl"))
	if err != nil {
		t.Fatalf("Failed to read app log file: %v", err)
	}
	if !strings.Contains(string(content), "config dir fallback message") {
		t.Errorf("Expected app log to contain fallback message, got: %s", content)
	}
}

func TestAppendCategorizedLog_AppLogPathFallback(t *testing.T) {
	tmpDir := setLoggerTempDir(t)

	oldPath := GetLogFilePath()
	defer SetLogFilePath(oldPath)
	SetLogFilePath("")

	origConfigDir := getUserConfigDir
	defer func() { getUserConfigDir = origConfigDir }()
	getUserConfigDir = func() (string, error) { return "", nil }

	AppendCategorizedLog("report", "info", "app log path fallback message")

	path := filepath.Join(tmpDir, appDirName, "app_logs.jsonl")
	content, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("Failed to read fallback app log file: %v", err)
	}
	if !strings.Contains(string(content), "app log path fallback message") {
		t.Errorf("Expected fallback app log to contain message, got: %s", content)
	}
}

func TestEmit_LiveApplicationEvent(t *testing.T) {
	origApp, origTest := getApplication, isTest
	defer func() {
		getApplication, isTest = origApp, origTest
	}()

	wailsApp := application.New(application.Options{})
	if wailsApp.Event == nil {
		t.Fatal("Expected an event manager on the test application")
	}
	getApplication = func() *application.App { return wailsApp }
	isTest = false

	tmpDir := t.TempDir()
	logFile := filepath.Join(tmpDir, "emit_event.jsonl")
	SetLogFilePath(logFile)
	defer SetLogFilePath("")

	emit("warn", "live application event message")

	content, err := os.ReadFile(logFile)
	if err != nil {
		t.Fatalf("Failed to read log file: %v", err)
	}
	if !strings.Contains(string(content), "live application event message") {
		t.Errorf("Expected log file to contain emit message, got: %s", content)
	}
}
