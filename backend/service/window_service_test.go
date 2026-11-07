package service

import (
	"context"
	"testing"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
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
		_, ok := ws.GetTargetScreen([]wailsRuntime.Screen{})
		if ok {
			t.Error("Expected false for empty screen list")
		}
	})

	t.Run("primary screen present", func(t *testing.T) {
		screens := []wailsRuntime.Screen{
			{IsPrimary: false, Height: 768},
			{IsPrimary: true, Height: 1080},
		}
		s, ok := ws.GetTargetScreen(screens)
		if !ok || s.Height != 1080 {
			t.Errorf("Expected primary screen height 1080, got %+v", s)
		}
	})

	t.Run("fallback to first screen when no primary", func(t *testing.T) {
		screens := []wailsRuntime.Screen{
			{IsPrimary: false, Height: 900},
			{IsPrimary: false, Height: 1080},
		}
		s, ok := ws.GetTargetScreen(screens)
		if !ok || s.Height != 900 {
			t.Errorf("Expected first screen height 900, got %+v", s)
		}
	})
}

func TestWindowService_GetTargetScreenHeight(t *testing.T) {
	ws := NewWindowService()
	screens := []wailsRuntime.Screen{
		{IsPrimary: true, Height: 1080},
	}
	h, ok := ws.GetTargetScreenHeight(screens)
	if !ok || h != 1080 {
		t.Errorf("Expected height 1080, got %d", h)
	}
}

func TestWindowService_Actions_NilContext(t *testing.T) {
	ws := NewWindowService()
	// Should safely no-op when live is false or ctx is nil
	ws.Minimize(nil, false)
	ws.Maximize(nil, false)
	ws.Close(nil, false)

	ctx := context.Background()
	ws.Minimize(ctx, false)
	ws.Maximize(ctx, false)
	ws.Close(ctx, false)
}
