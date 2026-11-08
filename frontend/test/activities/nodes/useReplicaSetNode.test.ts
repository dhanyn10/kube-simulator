import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useReplicaSetNodeHandler } from '@/activities/nodes/useReplicaSetNode';
import { useFlowStore } from '@/store';

describe('useReplicaSetNodeHandler', () => {
  it('computes dark mode classes when selected is true and false', () => {
    useFlowStore.setState({ colorMode: 'dark' });

    const { result: unselectedResult } = renderHook(() =>
      useReplicaSetNodeHandler(false)
    );
    expect(unselectedResult.current.colorMode).toBe('dark');
    expect(unselectedResult.current.containerClass).toContain('replicaset-node-container-dark');
    expect(unselectedResult.current.containerClass).not.toContain('replicaset-node-selected-dark');
    expect(unselectedResult.current.badgeClass).toContain('replicaset-node-badge-dark');

    const { result: selectedResult } = renderHook(() =>
      useReplicaSetNodeHandler(true)
    );
    expect(selectedResult.current.containerClass).toContain('replicaset-node-selected-dark');
  });

  it('computes light mode classes when selected is true and false', () => {
    useFlowStore.setState({ colorMode: 'light' });

    const { result: unselectedResult } = renderHook(() =>
      useReplicaSetNodeHandler(false)
    );
    expect(unselectedResult.current.colorMode).toBe('light');
    expect(unselectedResult.current.containerClass).toContain('replicaset-node-container-light');
    expect(unselectedResult.current.containerClass).not.toContain('replicaset-node-selected-light');
    expect(unselectedResult.current.badgeClass).toContain('replicaset-node-badge-light');

    const { result: selectedResult } = renderHook(() =>
      useReplicaSetNodeHandler(true)
    );
    expect(selectedResult.current.containerClass).toContain('replicaset-node-selected-light');
  });
});
