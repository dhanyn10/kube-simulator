package service

import (
	"testing"

	"build-wails/backend/domain"

	"github.com/wailsapp/wails/v3/pkg/application"
)

type mockWindowCtrl struct {
	minimized    bool
	maximized    bool
	closed       bool
	simOpenState bool
	sidebars     map[string]bool
}

var _ domain.WindowController = (*mockWindowCtrl)(nil)

func (m *mockWindowCtrl) Minimize() {
	m.minimized = true
}

func (m *mockWindowCtrl) Maximize() {
	m.maximized = true
}

func (m *mockWindowCtrl) Close() {
	m.closed = true
}

func (m *mockWindowCtrl) OpenSimulationWindow() bool {
	m.simOpenState = true
	return true
}

func (m *mockWindowCtrl) CloseSimulationWindow() bool {
	m.simOpenState = false
	return true
}

func (m *mockWindowCtrl) OpenSidebarWindow(side string) bool {
	if m.sidebars == nil {
		m.sidebars = make(map[string]bool)
	}
	m.sidebars[side] = true
	return true
}

func (m *mockWindowCtrl) CloseSidebarWindow(side string) bool {
	if m.sidebars == nil {
		m.sidebars = make(map[string]bool)
	}
	m.sidebars[side] = false
	return true
}

func TestWindowService_WithMockController(t *testing.T) {
	mock := &mockWindowCtrl{}
	ws := NewWindowService(mock)

	if ws.GetController() != mock {
		t.Error("Expected GetController to return the injected mock controller")
	}

	ws.Minimize()
	if !mock.minimized {
		t.Error("Expected Minimize to be forwarded to mock controller")
	}

	ws.Maximize()
	if !mock.maximized {
		t.Error("Expected Maximize to be forwarded to mock controller")
	}

	assertSimulationWindowForwards(t, ws, mock)
	assertSidebarWindowForwards(t, ws, mock)

	ws.Close()
	if !mock.closed {
		t.Error("Expected Close to be forwarded to mock controller")
	}
}

func assertSimulationWindowForwards(t *testing.T, ws *WindowService, mock *mockWindowCtrl) {
	t.Helper()

	if !ws.OpenSimulationWindow() || !mock.simOpenState {
		t.Error("Expected OpenSimulationWindow to be forwarded to mock controller")
	}

	if !ws.CloseSimulationWindow() || mock.simOpenState {
		t.Error("Expected CloseSimulationWindow to be forwarded to mock controller")
	}
}

func assertSidebarWindowForwards(t *testing.T, ws *WindowService, mock *mockWindowCtrl) {
	t.Helper()

	checks := []struct {
		name   string
		open   bool
		side   string
		expect bool
	}{
		{"OpenSidebarWindow(left)", true, "left", true},
		{"CloseSidebarWindow(left)", false, "left", false},
		{"OpenSidebarWindow(right)", true, "right", true},
		{"CloseSidebarWindow(right)", false, "right", false},
	}

	for _, tc := range checks {
		var got bool
		if tc.open {
			got = ws.OpenSidebarWindow(tc.side)
		} else {
			got = ws.CloseSidebarWindow(tc.side)
		}
		if !got || mock.sidebars[tc.side] != tc.expect {
			t.Errorf("%s not forwarded to mock controller as expected", tc.name)
		}
	}
}

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
	origApp := getApplication
	defer func() { getApplication = origApp }()
	getApplication = func() *application.App { return nil }

	ws := NewWindowService()
	// Should safely no-op when application.Get() is nil
	ws.Minimize()
	ws.Maximize()
	ws.Close()

	if ws.OpenSimulationWindow() {
		t.Error("Expected OpenSimulationWindow to return false when application.Get() is nil")
	}
	if ws.CloseSimulationWindow() {
		t.Error("Expected CloseSimulationWindow to return false when application.Get() is nil")
	}
}

func TestWindowService_WithActiveWindowBranches(t *testing.T) {
	testApp := application.New(application.Options{})
	ws := NewWindowService()

	// Calling GetActiveWindow when application exists with no windows
	win := GetActiveWindow()
	if win != nil {
		t.Errorf("Expected nil active window when application has no windows")
	}

	ws.Minimize()
	ws.Maximize()
	ws.Close()

	if testApp != nil && testApp.Window != nil {
		w := testApp.Window.NewWithOptions(application.WebviewWindowOptions{
			Title: "Test Window",
		})
		if w != nil {
			_ = GetActiveWindow()
			ws.Minimize()
			ws.Maximize()
			ws.Close()
		}

		// Test opening simulation window
		opened := ws.OpenSimulationWindow()
		if !opened {
			t.Error("Expected OpenSimulationWindow to return true")
		}

		// Test opening existing simulation window (focus branch)
		refocused := ws.OpenSimulationWindow()
		if !refocused {
			t.Error("Expected OpenSimulationWindow to return true when window already exists")
		}

		// Test closing simulation window
		closed := ws.CloseSimulationWindow()
		if !closed {
			t.Error("Expected CloseSimulationWindow to return true")
		}

		// Test closing again when already closed
		closedAgain := ws.CloseSimulationWindow()
		if closedAgain {
			t.Error("Expected CloseSimulationWindow to return false when window does not exist")
		}
	}
}

func TestGetActiveWindow_ReturnsCurrentWindow(t *testing.T) {
	app := application.New(application.Options{})
	win := app.Window.NewWithOptions(application.WebviewWindowOptions{Title: "Current Window"})
	if win == nil {
		t.Fatal("Expected a webview window")
	}

	origApp, origCurrent := getApplication, currentWindow
	defer func() {
		getApplication, currentWindow = origApp, origCurrent
	}()
	getApplication = func() *application.App { return app }
	currentWindow = func(_ *application.App) application.Window { return win }

	if got := GetActiveWindow(); got != win {
		t.Errorf("Expected GetActiveWindow to return the current window, got %v", got)
	}
}

func TestWailsWindowController_NilApplicationBranches(t *testing.T) {
	origApp := getApplication
	defer func() { getApplication = origApp }()
	getApplication = func() *application.App { return nil }

	controller := &WailsWindowController{}
	if controller.OpenSidebarWindow("left") {
		t.Error("Expected OpenSidebarWindow to fail without an application")
	}
	if controller.CloseSidebarWindow("left") {
		t.Error("Expected CloseSidebarWindow to fail without an application")
	}
}

func TestWailsWindowController_NilSimulationWindow(t *testing.T) {
	app := application.New(application.Options{})
	origApp, origNew := getApplication, newWindow
	defer func() {
		getApplication, newWindow = origApp, origNew
	}()
	getApplication = func() *application.App { return app }
	newWindow = func(_ *application.App, _ application.WebviewWindowOptions) application.Window { return nil }

	if (&WailsWindowController{}).OpenSimulationWindow() {
		t.Error("Expected OpenSimulationWindow to fail when window creation returns nil")
	}
}

func TestWindowCloseHandlers_RemoveAndEmit(t *testing.T) {
	app := application.New(application.Options{})
	win := app.Window.NewWithOptions(application.WebviewWindowOptions{Title: "Closing"})
	if win == nil {
		t.Fatal("Expected a webview window")
	}

	simulationWindowCloseHandler(app, win)(nil)
	sidebarWindowCloseHandler(app, win, "left")(nil)
}

func TestWailsWindowController_SidebarWindowLifecycle(t *testing.T) {
	app := application.New(application.Options{})
	controller := &WailsWindowController{}
	origApp := getApplication
	defer func() { getApplication = origApp }()
	getApplication = func() *application.App { return app }

	windowNames := map[string]string{
		"left":  SidebarLeftWindowName,
		"right": SidebarRightWindowName,
	}

	for _, side := range []string{"left", "right"} {
		if !controller.OpenSidebarWindow(side) {
			t.Fatalf("Expected OpenSidebarWindow(%q) to create a window", side)
		}
		if !controller.OpenSidebarWindow(side) {
			t.Fatalf("Expected OpenSidebarWindow(%q) to focus the existing window", side)
		}
		if _, exists := app.Window.GetByName(windowNames[side]); !exists {
			t.Fatalf("Expected sidebar window %q to be registered", windowNames[side])
		}

		dummy := app.Window.NewWithOptions(application.WebviewWindowOptions{Title: "Sidebar Close Handler"})
		sidebarWindowCloseHandler(app, dummy, side)(nil)

		if !controller.CloseSidebarWindow(side) {
			t.Fatalf("Expected CloseSidebarWindow(%q) to close the window", side)
		}
		if controller.CloseSidebarWindow(side) {
			t.Fatalf("Expected CloseSidebarWindow(%q) to fail when the window is gone", side)
		}
	}

	origNew := newWindow
	defer func() { newWindow = origNew }()
	newWindow = func(_ *application.App, _ application.WebviewWindowOptions) application.Window { return nil }
	if controller.OpenSidebarWindow("right") {
		t.Error("Expected OpenSidebarWindow to fail when window creation returns nil")
	}
}
