package service

import (
	"context"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// WindowService handles window metrics, layout sizing, and window controls.
type WindowService struct{}

// NewWindowService constructs a new WindowService.
func NewWindowService() *WindowService {
	return &WindowService{}
}

// CalculateAppHeight returns 90% of the given screen height.
func (s *WindowService) CalculateAppHeight(screenHeight int) int {
	return int(float64(screenHeight) * 0.9)
}

// GetTargetScreen selects the target screen: either the primary screen or the first fallback screen.
func (s *WindowService) GetTargetScreen(screens []wailsRuntime.Screen) (wailsRuntime.Screen, bool) {
	if len(screens) == 0 {
		return wailsRuntime.Screen{}, false
	}
	for _, screen := range screens {
		if screen.IsPrimary {
			return screen, true
		}
	}
	return screens[0], true
}

// GetTargetScreenHeight selects the target screen's height: either the primary screen or the first fallback screen.
func (s *WindowService) GetTargetScreenHeight(screens []wailsRuntime.Screen) (int, bool) {
	screen, ok := s.GetTargetScreen(screens)
	return screen.Height, ok
}

// Minimize minimizes the application window.
func (s *WindowService) Minimize(ctx context.Context, isLive bool) {
	if isLive && ctx != nil {
		wailsRuntime.WindowMinimise(ctx)
	}
}

// Maximize toggles window maximize state.
func (s *WindowService) Maximize(ctx context.Context, isLive bool) {
	if isLive && ctx != nil {
		if wailsRuntime.WindowIsMaximised(ctx) {
			wailsRuntime.WindowUnmaximise(ctx)
		} else {
			wailsRuntime.WindowMaximise(ctx)
		}
	}
}

// Close quits the application window.
func (s *WindowService) Close(ctx context.Context, isLive bool) {
	if isLive && ctx != nil {
		wailsRuntime.Quit(ctx)
	}
}
