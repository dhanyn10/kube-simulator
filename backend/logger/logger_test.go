package logger

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
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

	SetLogFilePath(tmpDir) // directory instead of file
	appendToLogFile("test line") // Should not panic or fail ungracefully
}
