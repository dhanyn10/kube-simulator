package domain

// WindowController defines the platform contract for controlling native GUI application windows.
type WindowController interface {
	Minimize()
	Maximize()
	Close()
	OpenSimulationWindow() bool
	CloseSimulationWindow() bool
}
