package logger

import (
	"context"
	"fmt"
	"strings"
	"sync"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

var (
	appCtx context.Context
	mu     sync.Mutex
	// Added for testing purposes
	isTest bool
)

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

	// Also print to stdout for local debugging
	fmt.Printf("[%s] %s\n", level, message)

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
