package service

import (
	"github.com/wailsapp/wails/v3/pkg/application"
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
func (s *WindowService) GetTargetScreen(screens []application.Screen) (application.Screen, bool) {
	if len(screens) == 0 {
		return application.Screen{}, false
	}
	for _, screen := range screens {
		if screen.IsPrimary {
			return screen, true
		}
	}
	return screens[0], true
}

// GetTargetScreenHeight selects the target screen's height: either the primary screen or the first fallback screen.
func (s *WindowService) GetTargetScreenHeight(screens []application.Screen) (int, bool) {
	screen, ok := s.GetTargetScreen(screens)
	if !ok {
		return 0, false
	}
	h := screen.Size.Height
	if h == 0 {
		h = screen.Bounds.Height
	}
	return h, true
}

// GetActiveWindow returns the current active window or the first available window.
func GetActiveWindow() application.Window {
	app := application.Get()
	if app == nil || app.Window == nil {
		return nil
	}
	if win := app.Window.Current(); win != nil {
		return win
	}
	windows := app.Window.GetAll()
	if len(windows) > 0 {
		return windows[0]
	}
	return nil
}

// Minimize minimizes the application window.
func (s *WindowService) Minimize() {
	if win := GetActiveWindow(); win != nil {
		win.Minimise()
	}
}

// Maximize toggles window maximize state.
func (s *WindowService) Maximize() {
	if win := GetActiveWindow(); win != nil {
		win.ToggleMaximise()
	}
}

// Close quits or closes the application window.
func (s *WindowService) Close() {
	if win := GetActiveWindow(); win != nil {
		win.Close()
		return
	}
	if app := application.Get(); app != nil {
		app.Quit()
	}
}
