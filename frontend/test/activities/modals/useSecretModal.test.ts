import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSecretModal, DEFAULT_SECRET_ITEMS } from '@/activities/modals/useSecretModal';
import { K8sSecretItem } from '@/types';

describe('useSecretModal', () => {
  it('initializes with default secret state when initialSecret is null or undefined', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();

    const { result } = renderHook(() =>
      useSecretModal(true, 'node-1', null, onSave, onClose)
    );

    expect(result.current.secretId).toMatch(/^secret-/);
    expect(result.current.secretName).toMatch(/^secret-/);
    expect(result.current.secretType).toBe('Opaque');
    expect(result.current.dataItems).toHaveLength(2);
    expect(result.current.dataItems[0].key).toBe(DEFAULT_SECRET_ITEMS[0].key);
  });

  it('populates fields from existing initialSecret with custom data', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();

    const existingSecret: K8sSecretItem = {
      id: 'sec-custom-id',
      name: 'db-credentials',
      type: 'kubernetes.io/tls',
      secretData: [
        { key: 'tls.crt', value: 'cert-content' },
        { key: 'tls.key', value: 'key-content' },
      ],
    };

    const { result } = renderHook(() =>
      useSecretModal(true, 'node-1', existingSecret, onSave, onClose)
    );

    expect(result.current.secretId).toBe('sec-custom-id');
    expect(result.current.secretName).toBe('db-credentials');
    expect(result.current.secretType).toBe('kubernetes.io/tls');
    expect(result.current.dataItems).toHaveLength(2);
    expect(result.current.dataItems[0].key).toBe('tls.crt');
    expect(result.current.dataItems[0].value).toBe('cert-content');
  });

  it('falls back to default DB_PASSWORD when existing initialSecret has empty secretData', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();

    const emptyDataSecret: K8sSecretItem = {
      id: 'sec-empty-data',
      name: '',
      type: '',
      secretData: [],
    };

    const { result } = renderHook(() =>
      useSecretModal(true, 'node-1', emptyDataSecret, onSave, onClose)
    );

    expect(result.current.secretName).toBe('app-secret');
    expect(result.current.secretType).toBe('Opaque');
    expect(result.current.dataItems).toHaveLength(1);
    expect(result.current.dataItems[0].key).toBe('DB_PASSWORD');
  });

  it('handles field modifications and saving with slug sanitization', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();

    const { result } = renderHook(() =>
      useSecretModal(true, 'node-1', null, onSave, onClose)
    );

    act(() => {
      result.current.setSecretName('My Special Secret!');
      result.current.setSecretType('kubernetes.io/basic-auth');
      result.current.handleAddField();
    });

    const newFieldId = result.current.dataItems[result.current.dataItems.length - 1].id;
    act(() => {
      result.current.handleUpdateField(newFieldId, 'key', 'CUSTOM_TOKEN');
      result.current.handleUpdateField(newFieldId, 'value', 'xyz-123');
    });

    act(() => {
      result.current.handleSave();
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0][0];
    expect(saved.name).toBe('my-special-secret');
    expect(saved.type).toBe('kubernetes.io/basic-auth');
    expect(saved.secretData.some((d: any) => d.key === 'CUSTOM_TOKEN' && d.value === 'xyz-123')).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('falls back to effectiveId when secretName is empty whitespace', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();

    const { result } = renderHook(() =>
      useSecretModal(true, 'node-1', null, onSave, onClose)
    );

    act(() => {
      result.current.setSecretName('   ');
    });

    act(() => {
      result.current.handleSave();
    });

    const saved = onSave.mock.calls[0][0];
    expect(saved.name).toBe(result.current.secretId);
  });
});
