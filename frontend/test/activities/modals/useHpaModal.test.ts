import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHpaModal } from '@/activities/modals/useHpaModal';
import { K8sHpaItem } from '@/types';

describe('useHpaModal', () => {
  it('initializes with default state when initialHpa is null or undefined', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();

    const { result } = renderHook(() =>
      useHpaModal(true, 'node-1', null, onSave, onClose)
    );

    expect(result.current.hpaName).toMatch(/^hpa-/);
    expect(result.current.minReplicas).toBe(1);
    expect(result.current.maxReplicas).toBe(10);
    expect(result.current.targetCPU).toBe(80);
    expect(result.current.targetMemory).toBeUndefined();
  });

  it('populates fields from initialHpa when provided', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();

    const initialHpa: K8sHpaItem = {
      id: 'hpa-existing-1',
      name: 'prod-hpa',
      minReplicas: 3,
      maxReplicas: 25,
      targetCPU: 75,
      targetMemory: 60,
    };

    const { result } = renderHook(() =>
      useHpaModal(true, 'node-1', initialHpa, onSave, onClose)
    );

    expect(result.current.hpaName).toBe('prod-hpa');
    expect(result.current.minReplicas).toBe(3);
    expect(result.current.maxReplicas).toBe(25);
    expect(result.current.targetCPU).toBe(75);
    expect(result.current.targetMemory).toBe(60);
  });

  it('saves clamped values and triggers onSave and onClose with memory limit set', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();

    const { result } = renderHook(() =>
      useHpaModal(true, 'node-1', null, onSave, onClose)
    );

    act(() => {
      result.current.setHpaName('my custom HPA');
      result.current.setMinReplicas(2);
      result.current.setMaxReplicas(12);
      result.current.setTargetCPU(85);
      result.current.setTargetMemory(70);
    });

    act(() => {
      result.current.handleSave();
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0][0];
    expect(saved.name).toBe('my-custom-hpa');
    expect(saved.minReplicas).toBe(2);
    expect(saved.maxReplicas).toBe(12);
    expect(saved.targetCPU).toBe(85);
    expect(saved.targetMemory).toBe(70);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clamps invalid/extreme values and omits undefined/zero memory limit', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();

    const { result } = renderHook(() =>
      useHpaModal(true, 'node-1', null, onSave, onClose)
    );

    act(() => {
      result.current.setHpaName(''); // empty name -> fallback 'unnamed-hpa'
      result.current.setMinReplicas(-5); // clamped to 1
      result.current.setMaxReplicas(0); // max < min -> clamped to minVal (1)
      result.current.setTargetCPU(150); // clamped to 100
      result.current.setTargetMemory(0); // <= 0 -> undefined
    });

    act(() => {
      result.current.handleSave();
    });

    const saved = onSave.mock.calls[0][0];
    expect(saved.name).toBe('unnamed-hpa');
    expect(saved.minReplicas).toBe(1);
    expect(saved.maxReplicas).toBe(10);
    expect(saved.targetCPU).toBe(100);
    expect(saved.targetMemory).toBeUndefined();
  });
});
