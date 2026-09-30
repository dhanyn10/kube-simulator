import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  getSimulationButtonTitle,
  getSimulationButtonClass,
  useSimulationControls,
} from '@/activities/layout/useSimulationControls';
import { useFlowStore } from '@/store';

describe('useSimulationControls & helpers', () => {
  it('getSimulationButtonTitle returns appropriate title', () => {
    expect(getSimulationButtonTitle(false, false, false)).toBe('Add an Internet card to start simulation');
    expect(getSimulationButtonTitle(true, true, false)).toBe('HPA requires Resource Limits on target workloads');
    expect(getSimulationButtonTitle(true, false, true)).toBe('Pause Simulation');
    expect(getSimulationButtonTitle(true, false, false, true)).toBe('Resume Simulation');
    expect(getSimulationButtonTitle(true, false, false, false)).toBe('Start Simulation');
  });

  it('getSimulationButtonClass returns appropriate classes', () => {
    expect(getSimulationButtonClass(false, false, false)).toContain('cursor-not-allowed');
    expect(getSimulationButtonClass(true, true, true)).toContain('bg-amber-600 animate-pulse');
    expect(getSimulationButtonClass(true, true, false)).toContain('bg-amber-500');
    expect(getSimulationButtonClass(true, false, false, true)).toContain('bg-emerald-500');
    expect(getSimulationButtonClass(true, false, true, false)).toContain('bg-amber-500/50');
    expect(getSimulationButtonClass(true, false, false, false)).toContain('bg-emerald-500');
  });

  it('useSimulationControls hook wraps helpers correctly and evaluates showSpeedControls during pause or simulation with active connection profile', () => {
    const { result, rerender } = renderHook(
      (props) => useSimulationControls(props),
      {
        initialProps: {
          isSimulating: false,
          hasInternet: true,
          hasHpaValidationError: false,
        },
      }
    );

    expect(result.current.title).toBe('Start Simulation');
    expect(result.current.buttonClass).toContain('bg-emerald-500');

    // Test stopButtonClass when hasHpaValidationError is true
    expect(result.current.stopButtonClass).toBe('bg-red-500 text-white hover:bg-red-600');

    // Evaluate showSpeedControls when paused and internet node has connectionProfile
    act(() => {
      useFlowStore.setState({
        nodes: [{ type: 'Internet', data: { connectionProfile: { name: 'E-Commerce' } } }],
        isPaused: true,
      });
    });

    rerender({
      isSimulating: false,
      isPaused: true,
      hasInternet: true,
      hasHpaValidationError: false,
    });

    expect(result.current.showSpeedControls).toBe(true);

    // Evaluate getSimulationButtonClass when hasHpaValidationError is true while paused
    rerender({
      isSimulating: false,
      isPaused: true,
      hasInternet: true,
      hasHpaValidationError: true,
    });
    expect(result.current.buttonClass).toContain('bg-emerald-600 animate-pulse');
  });
});
