package service

import (
	"encoding/json"
	"sync"
)

// Event names for simulation lifecycle broadcast.
const (
	EventSimulationStateChange    = "simulation-state-change"
	EventSimulationSpeedChange    = "simulation-speed-change"
	EventSimulationSnapshotUpdate = "simulation-snapshot-updated"
)

// SimulationState holds the current runtime state of the cluster simulation.
type SimulationState struct {
	IsSimulating bool `json:"isSimulating"`
	IsPaused     bool `json:"isPaused"`
	Speed        int  `json:"speed"`
}

// SimulationService manages centralized simulation lifecycle, speed synchronization,
// and state caching between main window and detached System Monitor windows.
type SimulationService struct {
	mu               sync.RWMutex
	isSimulating     bool
	isPaused         bool
	speed            int
	lastSnapshotJson string
}

// NewSimulationService initializes a new instance of SimulationService.
func NewSimulationService() *SimulationService {
	return &SimulationService{
		isSimulating:     false,
		isPaused:         false,
		speed:            1,
		lastSnapshotJson: "{}",
	}
}

func (s *SimulationService) emitEvent(eventName string, data interface{}) {
	app := getApplication()
	if app != nil && app.Event != nil {
		app.Event.Emit(eventName, data)
	}
}

// StartSimulation activates cluster simulation and notifies all windows.
func (s *SimulationService) StartSimulation(speed int) bool {
	s.mu.Lock()
	if speed <= 0 {
		speed = 1
	}
	s.isSimulating = true
	s.isPaused = false
	s.speed = speed
	state := SimulationState{
		IsSimulating: true,
		IsPaused:     false,
		Speed:        speed,
	}
	s.mu.Unlock()

	stateBytes, _ := json.Marshal(state)
	s.emitEvent(EventSimulationStateChange, string(stateBytes))
	return true
}

// PauseSimulation pauses active simulation loop.
func (s *SimulationService) PauseSimulation() bool {
	s.mu.Lock()
	s.isPaused = true
	state := SimulationState{
		IsSimulating: s.isSimulating,
		IsPaused:     true,
		Speed:        s.speed,
	}
	s.mu.Unlock()

	stateBytes, _ := json.Marshal(state)
	s.emitEvent(EventSimulationStateChange, string(stateBytes))
	return true
}

// ResumeSimulation resumes paused simulation loop.
func (s *SimulationService) ResumeSimulation() bool {
	s.mu.Lock()
	s.isPaused = false
	state := SimulationState{
		IsSimulating: s.isSimulating,
		IsPaused:     false,
		Speed:        s.speed,
	}
	s.mu.Unlock()

	stateBytes, _ := json.Marshal(state)
	s.emitEvent(EventSimulationStateChange, string(stateBytes))
	return true
}

// StopSimulation terminates active simulation loop.
func (s *SimulationService) StopSimulation() bool {
	s.mu.Lock()
	s.isSimulating = false
	s.isPaused = false
	state := SimulationState{
		IsSimulating: false,
		IsPaused:     false,
		Speed:        s.speed,
	}
	s.mu.Unlock()

	stateBytes, _ := json.Marshal(state)
	s.emitEvent(EventSimulationStateChange, string(stateBytes))
	return true
}

// SetSimulationSpeed updates simulation speed and broadcasts to all windows.
func (s *SimulationService) SetSimulationSpeed(speed int) bool {
	s.mu.Lock()
	if speed <= 0 {
		speed = 1
	}
	s.speed = speed
	state := SimulationState{
		IsSimulating: s.isSimulating,
		IsPaused:     s.isPaused,
		Speed:        speed,
	}
	s.mu.Unlock()

	stateBytes, _ := json.Marshal(state)
	s.emitEvent(EventSimulationSpeedChange, speed)
	s.emitEvent(EventSimulationStateChange, string(stateBytes))
	return true
}

// GetSimulationState returns the current simulation state.
func (s *SimulationService) GetSimulationState() SimulationState {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return SimulationState{
		IsSimulating: s.isSimulating,
		IsPaused:     s.isPaused,
		Speed:        s.speed,
	}
}

// BroadcastSnapshot caches the latest simulation metrics snapshot and broadcasts it.
func (s *SimulationService) BroadcastSnapshot(snapshotJson string) bool {
	s.mu.Lock()
	if snapshotJson == "" {
		snapshotJson = "{}"
	}
	s.lastSnapshotJson = snapshotJson
	s.mu.Unlock()

	s.emitEvent(EventSimulationSnapshotUpdate, snapshotJson)
	return true
}

// GetSimulationSnapshot returns the last cached snapshot.
func (s *SimulationService) GetSimulationSnapshot() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if s.lastSnapshotJson == "" {
		return "{}"
	}
	return s.lastSnapshotJson
}

