import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  getSimulationButtonTitle,
  getSimulationButtonClass,
  useSimulationControls,
} from '@/activity/layout/useSimulationControls';

describe('useSimulationControls & helpers', () => {
  it('getSimulationButtonTitle returns appropriate title', () => {
    expect(getSimulationButtonTitle(false, false, false)).toBe('Add an Internet card to start simulation');
    expect(getSimulationButtonTitle(true, true, false)).toBe('HPA requires Resource Limits on target workloads');
    expect(getSimulationButtonTitle(true, false, true)).toBe('Stop Simulation');
    expect(getSimulationButtonTitle(true, false, false)).toBe('Start Simulation');
  });

  it('getSimulationButtonClass returns appropriate classes', () => {
    expect(getSimulationButtonClass(false, false, false)).toContain('cursor-not-allowed');
    expect(getSimulationButtonClass(true, true, true)).toContain('bg-red-600 animate-pulse');
    expect(getSimulationButtonClass(true, true, false)).toContain('bg-red-500');
    expect(getSimulationButtonClass(true, false, true)).toContain('bg-amber-500/50');
    expect(getSimulationButtonClass(true, false, false)).toContain('bg-emerald-500');
  });

  it('useSimulationControls hook wraps helpers correctly', () => {
    const { result } = renderHook(() =>
      useSimulationControls({
        isSimulating: false,
        hasInternet: true,
        hasHpaValidationError: false,
      })
    );

    expect(result.current.title).toBe('Start Simulation');
    expect(result.current.buttonClass).toContain('bg-emerald-500');
  });
});
