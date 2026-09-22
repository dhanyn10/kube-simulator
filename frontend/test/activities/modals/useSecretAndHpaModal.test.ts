import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSecretModal } from '@/activities/modals/useSecretModal';
import { useHpaModal } from '@/activities/modals/useHpaModal';

describe('useSecretModal and useHpaModal', () => {
  it('manages Secret modal state and invokes onSave with sanitized values', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();

    const { result } = renderHook(() =>
      useSecretModal(true, 'node-1', null, onSave, onClose)
    );

    expect(result.current.secretName).toContain('secret-');
    expect(result.current.secretType).toBe('Opaque');

    act(() => {
      result.current.setSecretName('my-custom-secret');
    });

    act(() => {
      result.current.handleSave();
    });

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'my-custom-secret',
        type: 'Opaque'
      })
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('manages HPA modal state and invokes onSave with valid numeric bounds', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();

    const { result } = renderHook(() =>
      useHpaModal(true, 'node-1', null, onSave, onClose)
    );

    expect(result.current.minReplicas).toBe(1);
    expect(result.current.maxReplicas).toBe(10);

    act(() => {
      result.current.setHpaName('custom-hpa');
      result.current.setMinReplicas(2);
      result.current.setMaxReplicas(8);
      result.current.setTargetCPU(75);
    });

    act(() => {
      result.current.handleSave();
    });

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'custom-hpa',
        minReplicas: 2,
        maxReplicas: 8,
        targetCPU: 75
      })
    );
    expect(onClose).toHaveBeenCalled();
  });
});
