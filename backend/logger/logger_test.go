package logger

import (
	"context"
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
