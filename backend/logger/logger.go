package logger

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

var (
	appCtx      context.Context
	mu          sync.Mutex
	isTest      bool
	logFilePath string
)

// GetLogFilePath returns the path to the physical app_logs.jsonl file
func GetLogFilePath() string {
	mu.Lock()
	defer mu.Unlock()
	if logFilePath != "" {
		return logFilePath
	}

	configDir, err := os.UserConfigDir()
	if err != nil || configDir == "" {
		configDir = os.TempDir()
	}
	dir := filepath.Join(configDir, "kube-simulator")
	_ = os.MkdirAll(dir, 0755)
	logFilePath = filepath.Join(dir, "app_logs.jsonl")
	return logFilePath
}

// SetLogFilePath allows setting a custom log file path (useful in tests)
func SetLogFilePath(path string) {
	mu.Lock()
	defer mu.Unlock()
	logFilePath = path
}

func appendToLogFile(line string) {
	path := GetLogFilePath()
	if path == "" {
		return
	}
	f, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		return
	}
	defer f.Close()
	_, _ = f.WriteString(line + "\n")
}

// Init initializes the logger with the application context
func Init(ctx context.Context) {
	mu.Lock()
	defer mu.Unlock()
	appCtx = ctx
}

// Info logs an informational message
func Info(format string, args ...interface{}) {
	emit("info", format, args...)
}

// Warn logs a warning message
func Warn(format string, args ...interface{}) {
	emit("warn", format, args...)
}

// Error logs an error message
func Error(format string, args ...interface{}) {
	emit("error", format, args...)
}

// Fatal logs a fatal message
func Fatal(format string, args ...interface{}) {
	emit("fatal", format, args...)
}

func emit(level, format string, args ...interface{}) {
	mu.Lock()
	ctx := appCtx
	testingMode := isTest
	mu.Unlock()

	message := fmt.Sprintf(format, args...)
	// Trim trailing newlines to avoid double spacing in UI and stdout
	message = strings.TrimRight(message, "\n")

	dateTime := time.Now().Format("2006-01-02 15:04:05")
	logLine := fmt.Sprintf("[%s] [%s] %s", dateTime, strings.ToUpper(level), message)

	// Format entry as JSON object
	jsonEntry, err := json.Marshal(map[string]string{
		"timestamp": dateTime,
		"level":     strings.ToUpper(level),
		"message":   message,
	})

	// Print to stdout and append JSON entry to app_logs.json
	fmt.Println(logLine)
	if err == nil {
		appendToLogFile(string(jsonEntry))
	}

	if ctx != nil && !testingMode {
		wailsRuntime.EventsEmit(ctx, "backend-log", map[string]string{
			"level":   level,
			"message": message,
		})
	}
}

// WailsWriter is an io.Writer that redirects to Wails events
type WailsWriter struct {
	Level string
}

func (w *WailsWriter) Write(p []byte) (n int, err error) {
	emit(w.Level, "%s", string(p))
	return len(p), nil
}
