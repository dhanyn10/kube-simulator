import { describe, it, expect, vi } from 'vitest';
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

  it('handles start action early return when simulation cannot start', () => {
    const storeStart = vi.fn();
    useFlowStore.setState({ startSimulation: storeStart, isPaused: false });

    const { result } = renderHook(() =>
      useSimulationControls({
        isSimulating: false,
        canStart: false,
        hasInternet: false,
      })
    );

    expect(result.current.canStart).toBe(false);
    result.current.handleStart();
    expect(storeStart).not.toHaveBeenCalled();
  });

  it('handles start action fallback to storeStartSimulation or prop, and during paused/simulating states', () => {
    const storeStart = vi.fn();
    const propStart = vi.fn();
    useFlowStore.setState({ startSimulation: storeStart });

    // 1. Can start with propStart provided
    const { result: r1 } = renderHook(() =>
      useSimulationControls({
        isSimulating: false,
        canStart: true,
        startSimulation: propStart,
      })
    );
    r1.current.handleStart();
    expect(propStart).toHaveBeenCalledTimes(1);

    // 2. Can start without propStart (fallback to storeStart)
    const { result: r2 } = renderHook(() =>
      useSimulationControls({
        isSimulating: false,
        canStart: true,
      })
    );
    r2.current.handleStart();
    expect(storeStart).toHaveBeenCalledTimes(1);

    // 3. canStart is false, but isPaused is true
    const { result: r3 } = renderHook(() =>
      useSimulationControls({
        isSimulating: false,
        isPaused: true,
        canStart: false,
        startSimulation: propStart,
      })
    );
    r3.current.handleStart();
    expect(propStart).toHaveBeenCalledTimes(2);

    // 4. canStart is false, but isSimulating is true
    const { result: r4 } = renderHook(() =>
      useSimulationControls({
        isSimulating: true,
        isPaused: false,
        canStart: false,
        startSimulation: propStart,
      })
    );
    r4.current.handleStart();
    expect(propStart).toHaveBeenCalledTimes(3);
  });

  it('handles pause action fallback and canStart fallback when props are undefined', () => {
    const storePause = vi.fn();
    const propPause = vi.fn();
    useFlowStore.setState({ pauseSimulation: storePause });

    // 1. pauseSimulation provided and canStart fallback to false
    const { result: r1 } = renderHook(() =>
      useSimulationControls({
        isSimulating: true,
        pauseSimulation: propPause,
      })
    );
    r1.current.handlePause();
    expect(propPause).toHaveBeenCalledTimes(1);
    expect(r1.current.canStart).toBe(false);

    // 2. pauseSimulation undefined (fallback to storePause)
    const { result: r2 } = renderHook(() =>
      useSimulationControls({
        isSimulating: true,
      })
    );
    r2.current.handlePause();
    expect(storePause).toHaveBeenCalledTimes(1);
  });
});
