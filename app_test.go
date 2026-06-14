package main

import (
	"runtime"
	"testing"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

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
