package service

import (
	"testing"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
)

func testSimulationInitialState(t *testing.T, svc *SimulationService) {
	state := svc.GetSimulationState()
	if state.IsSimulating || state.IsPaused || state.Speed != 1 {
		t.Errorf("Unexpected initial state: %+v", state)
	}
}

func testSimulationStart(t *testing.T, svc *SimulationService) {
	if !svc.StartSimulation(5) {
		t.Error("StartSimulation failed")
	}
	state := svc.GetSimulationState()
	if !state.IsSimulating || state.IsPaused || state.Speed != 5 {
		t.Errorf("Expected simulating at speed 5, got %+v", state)
	}

	// Start with <= 0 defaults to 1
	svc.StartSimulation(0)
	if svc.GetSimulationState().Speed != 1 {
		t.Errorf("Expected speed 1, got %d", svc.GetSimulationState().Speed)
	}
}

func testSimulationPauseAndResume(t *testing.T, svc *SimulationService) {
	if !svc.PauseSimulation() {
		t.Error("PauseSimulation failed")
	}
	if !svc.GetSimulationState().IsPaused {
		t.Error("Expected paused to be true")
	}

	if !svc.ResumeSimulation() {
		t.Error("ResumeSimulation failed")
	}
	if svc.GetSimulationState().IsPaused {
		t.Error("Expected paused to be false")
	}
}

func testSimulationSpeed(t *testing.T, svc *SimulationService) {
	if !svc.SetSimulationSpeed(10) {
		t.Error("SetSimulationSpeed failed")
	}
	if svc.GetSimulationState().Speed != 10 {
		t.Errorf("Expected speed 10, got %d", svc.GetSimulationState().Speed)
	}

	// Set invalid speed defaults to 1
	svc.SetSimulationSpeed(-2)
	if svc.GetSimulationState().Speed != 1 {
		t.Errorf("Expected speed 1, got %d", svc.GetSimulationState().Speed)
	}
}

func testSimulationStop(t *testing.T, svc *SimulationService) {
	if !svc.StopSimulation() {
		t.Error("StopSimulation failed")
	}
	state := svc.GetSimulationState()
	if state.IsSimulating || state.IsPaused {
		t.Errorf("Expected simulating and paused to be false, got %+v", state)
	}
}

func testSimulationSnapshotCaching(t *testing.T, svc *SimulationService) {
	if !svc.BroadcastSnapshot(`{"test":true}`) {
		t.Error("BroadcastSnapshot failed")
	}
	if svc.GetSimulationSnapshot() != `{"test":true}` {
		t.Errorf("Unexpected snapshot: %s", svc.GetSimulationSnapshot())
	}

	// Empty snapshot fallback
	svc.BroadcastSnapshot("")
	if svc.GetSimulationSnapshot() != "{}" {
		t.Errorf("Expected empty json '{}', got %s", svc.GetSimulationSnapshot())
	}
}

func TestSimulationService_Lifecycle(t *testing.T) {
	svc := NewSimulationService()

	t.Run("InitialState", func(t *testing.T) { testSimulationInitialState(t, svc) })
	t.Run("StartSimulation", func(t *testing.T) { testSimulationStart(t, svc) })
	t.Run("PauseAndResume", func(t *testing.T) { testSimulationPauseAndResume(t, svc) })
	t.Run("SetSimulationSpeed", func(t *testing.T) { testSimulationSpeed(t, svc) })
	t.Run("StopSimulation", func(t *testing.T) { testSimulationStop(t, svc) })
	t.Run("SnapshotCaching", func(t *testing.T) { testSimulationSnapshotCaching(t, svc) })
}

func TestSimulationService_EmitEventWithActiveApplication(t *testing.T) {
	wailsApp := application.New(application.Options{})
	if wailsApp.Event == nil {
		t.Fatal("Expected an event manager on the test application")
	}

	received := make(chan string, 1)
	wailsApp.Event.On(EventSimulationStateChange, func(event *application.CustomEvent) {
		if payload, ok := event.Data.(string); ok {
			received <- payload
		}
	})

	origApp := getApplication
	defer func() { getApplication = origApp }()
	getApplication = func() *application.App { return wailsApp }

	svc := NewSimulationService()
	if !svc.StartSimulation(2) {
		t.Fatal("StartSimulation failed")
	}

	select {
	case payload := <-received:
		if payload == "" {
			t.Error("Expected a non-empty simulation state payload")
		}
	case <-time.After(time.Second):
		t.Error("Expected simulation state event to be emitted")
	}
}

func TestSimulationService_GetSimulationSnapshot_Uninitialized(t *testing.T) {
	svc := &SimulationService{}
	if got := svc.GetSimulationSnapshot(); got != "{}" {
		t.Errorf("Expected empty snapshot fallback, got %q", got)
	}
}
