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
