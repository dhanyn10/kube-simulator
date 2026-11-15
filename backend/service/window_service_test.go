package service

import (
	"testing"

	"github.com/wailsapp/wails/v3/pkg/application"
)

func TestWindowService_CalculateAppHeight(t *testing.T) {
	ws := NewWindowService()

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
		actual := ws.CalculateAppHeight(tc.screenHeight)
		if actual != tc.expected {
			t.Errorf("CalculateAppHeight(%d) = %d, expected %d", tc.screenHeight, actual, tc.expected)
		}
	}
}

func TestWindowService_GetTargetScreen(t *testing.T) {
	ws := NewWindowService()

	t.Run("empty screen list", func(t *testing.T) {
		_, ok := ws.GetTargetScreen([]application.Screen{})
		if ok {
			t.Error("Expected false for empty screen list")
		}
	})

	t.Run("primary screen present", func(t *testing.T) {
		screens := []application.Screen{
			{IsPrimary: false, Size: application.Size{Height: 768}},
			{IsPrimary: true, Size: application.Size{Height: 1080}},
		}
		s, ok := ws.GetTargetScreen(screens)
		if !ok || s.Size.Height != 1080 {
			t.Errorf("Expected primary screen height 1080, got %+v", s)
		}
	})

	t.Run("fallback to first screen when no primary", func(t *testing.T) {
		screens := []application.Screen{
			{IsPrimary: false, Size: application.Size{Height: 900}},
			{IsPrimary: false, Size: application.Size{Height: 1080}},
		}
		s, ok := ws.GetTargetScreen(screens)
		if !ok || s.Size.Height != 900 {
			t.Errorf("Expected first screen height 900, got %+v", s)
		}
	})
}

func TestWindowService_GetTargetScreenHeight(t *testing.T) {
	ws := NewWindowService()
	screens := []application.Screen{
		{IsPrimary: true, Size: application.Size{Height: 1080}},
	}
	h, ok := ws.GetTargetScreenHeight(screens)
	if !ok || h != 1080 {
		t.Errorf("Expected height 1080, got %d", h)
	}

	// Fallback to Bounds.Height if Size.Height is 0
	screensBounds := []application.Screen{
		{IsPrimary: true, Bounds: application.Rect{Height: 1440}},
	}
	hBounds, okBounds := ws.GetTargetScreenHeight(screensBounds)
	if !okBounds || hBounds != 1440 {
		t.Errorf("Expected height 1440 from bounds, got %d", hBounds)
	}

	// Empty screens
	_, okEmpty := ws.GetTargetScreenHeight([]application.Screen{})
	if okEmpty {
		t.Error("Expected false for empty screen list in GetTargetScreenHeight")
	}
}

func TestWindowService_Actions_NilContext(t *testing.T) {
	ws := NewWindowService()
	// Should safely no-op when application.Get() is nil
	ws.Minimize()
	ws.Maximize()
	ws.Close()
}
