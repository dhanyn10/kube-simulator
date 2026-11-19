package service

import (
	"build-wails/backend/domain"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

// SimulationWindowName is the unique identifier for the detached simulation monitoring window.
const SimulationWindowName = "simulation-monitoring"

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

// WailsWindowController implements domain.WindowController using the Wails v3 runtime API.
type WailsWindowController struct{}

// Minimize minimizes the application window.
func (c *WailsWindowController) Minimize() {
	if win := GetActiveWindow(); win != nil {
		win.Minimise()
	}
}

// Maximize toggles window maximize state.
func (c *WailsWindowController) Maximize() {
	if win := GetActiveWindow(); win != nil {
		win.ToggleMaximise()
	}
}

// Close quits or closes the application window.
func (c *WailsWindowController) Close() {
	if win := GetActiveWindow(); win != nil {
		win.Close()
		return
	}
	if app := application.Get(); app != nil {
		app.Quit()
	}
}

// OpenSimulationWindow opens or focuses the standalone simulation monitoring window.
func (c *WailsWindowController) OpenSimulationWindow() bool {
	app := application.Get()
	if app == nil || app.Window == nil {
		return false
	}

	if win, exists := app.Window.GetByName(SimulationWindowName); exists && win != nil {
		win.Show()
		win.Focus()
		if app.Event != nil {
			app.Event.Emit("detached-open")
		}
		return true
	}

	win := app.Window.NewWithOptions(application.WebviewWindowOptions{
		Name:             SimulationWindowName,
		Title:            "Kube Simulator - System Monitor",
		Width:            900,
		Height:           650,
		MinWidth:         500,
		MinHeight:        400,
		Frameless:        true,
		URL:              "/?mode=monitoring",
		BackgroundColour: application.NewRGBA(15, 23, 42, 255),
	})
	if win == nil {
		return false
	}

	win.OnWindowEvent(events.Common.WindowClosing, func(_ *application.WindowEvent) {
		app.Window.Remove(win.ID())
		if app.Event != nil {
			app.Event.Emit("detached-closed")
		}
	})

	win.Show()
	win.Focus()

	if app.Event != nil {
		app.Event.Emit("detached-open")
	}
	return true
}

// CloseSimulationWindow closes the standalone simulation monitoring window if open.
func (c *WailsWindowController) CloseSimulationWindow() bool {
	app := application.Get()
	if app == nil || app.Window == nil {
		return false
	}

	if win, exists := app.Window.GetByName(SimulationWindowName); exists && win != nil {
		win.Close()
		app.Window.Remove(win.ID())
		if app.Event != nil {
			app.Event.Emit("detached-closed")
		}
		return true
	}
	return false
}

// WindowService handles window metrics, layout sizing, and window controls via an injected controller.
type WindowService struct {
	controller domain.WindowController
}

// NewWindowService constructs a new WindowService with an optional WindowController.
func NewWindowService(controller ...domain.WindowController) *WindowService {
	if len(controller) > 0 && controller[0] != nil {
		return &WindowService{controller: controller[0]}
	}
	return &WindowService{controller: &WailsWindowController{}}
}

// GetController returns the underlying WindowController.
func (s *WindowService) GetController() domain.WindowController {
	return s.controller
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

// Minimize delegates window minimize to the injected controller.
func (s *WindowService) Minimize() {
	s.controller.Minimize()
}

// Maximize delegates window maximize to the injected controller.
func (s *WindowService) Maximize() {
	s.controller.Maximize()
}

// Close delegates window close to the injected controller.
func (s *WindowService) Close() {
	s.controller.Close()
}

// OpenSimulationWindow delegates simulation window opening to the injected controller.
func (s *WindowService) OpenSimulationWindow() bool {
	return s.controller.OpenSimulationWindow()
}

// CloseSimulationWindow delegates simulation window closing to the injected controller.
func (s *WindowService) CloseSimulationWindow() bool {
	return s.controller.CloseSimulationWindow()
}
