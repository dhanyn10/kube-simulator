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

  it('handles initialSecret with empty secretData and fallbacks for empty secretName and secretType onSave', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();

    const emptyInitialSecret = {
      id: 'existing-sec-1',
      name: '',
      type: '',
      secretData: []
    };

    const { result } = renderHook(() =>
      useSecretModal(true, 'node-1', emptyInitialSecret as any, onSave, onClose)
    );

    expect(result.current.secretName).toBe('app-secret');
    expect(result.current.secretType).toBe('Opaque');
    expect(result.current.dataItems).toHaveLength(1);
    expect(result.current.dataItems[0].key).toBe('DB_PASSWORD');

    act(() => {
      result.current.setSecretName('   ');
      result.current.setSecretType('');
    });

    act(() => {
      result.current.handleSave();
    });

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'existing-sec-1',
        name: 'unnamed-secret',
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
      result.current.setTargetMemory(60);
    });

    act(() => {
      result.current.handleSave();
    });

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'custom-hpa',
        minReplicas: 2,
        maxReplicas: 8,
        targetCPU: 75,
        targetMemory: 60
      })
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('handles initialHpa values and fallbacks for invalid bounds in handleSave', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();

    const initialHpa = {
      id: 'existing-hpa-1',
      name: '',
      minReplicas: undefined,
      maxReplicas: undefined,
      targetCPU: undefined,
      targetMemory: 40
    };

    const { result } = renderHook(() =>
      useHpaModal(true, 'node-1', initialHpa as any, onSave, onClose)
    );

    expect(result.current.hpaName).toBe('app-hpa');
    expect(result.current.minReplicas).toBe(1);
    expect(result.current.maxReplicas).toBe(10);
    expect(result.current.targetCPU).toBe(80);

    act(() => {
      result.current.setHpaName('  ');
      result.current.setMinReplicas(0); // Clamped to min 1
      result.current.setMaxReplicas(0); // Clamped to minVal
      result.current.setTargetCPU(0); // Clamped to min 1 (via Number(0) || 80 fallback)
      result.current.setTargetMemory(-10); // Undefined
    });

    act(() => {
      result.current.handleSave();
    });

    expect(onSave).toHaveBeenCalledWith({
      id: 'existing-hpa-1',
      name: 'unnamed-hpa',
      minReplicas: 1,
      maxReplicas: 10,
      targetCPU: 80,
    });
    expect(onClose).toHaveBeenCalled();
  });
});
