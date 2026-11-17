package service

import (
	"testing"
)

func TestSimulationService_Lifecycle(t *testing.T) {
	svc := NewSimulationService()

	t.Run("InitialState", func(t *testing.T) {
		state := svc.GetSimulationState()
		if state.IsSimulating || state.IsPaused || state.Speed != 1 {
			t.Errorf("Unexpected initial state: %+v", state)
		}
	})

	t.Run("StartSimulation", func(t *testing.T) {
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
	})

	t.Run("PauseAndResume", func(t *testing.T) {
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
	})

	t.Run("SetSimulationSpeed", func(t *testing.T) {
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
	})

	t.Run("StopSimulation", func(t *testing.T) {
		if !svc.StopSimulation() {
			t.Error("StopSimulation failed")
		}
		state := svc.GetSimulationState()
		if state.IsSimulating || state.IsPaused {
			t.Errorf("Expected simulating and paused to be false, got %+v", state)
		}
	})

	t.Run("SnapshotCaching", func(t *testing.T) {
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
	})

	t.Run("TrafficSpike", func(t *testing.T) {
		if !svc.TriggerTrafficSpike(2.5) {
			t.Error("TriggerTrafficSpike failed")
		}
		if !svc.TriggerTrafficSpike(-1.0) {
			t.Error("TriggerTrafficSpike with fallback failed")
		}
	})
}
