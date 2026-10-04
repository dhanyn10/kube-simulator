import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useResourceLimitNode } from '@/activities/nodes/useResourceLimitNode';
import { useFlowStore } from '@/store';

describe('useResourceLimitNode', () => {
  beforeEach(() => {
    useFlowStore.setState({
      colorMode: 'dark',
      nodes: [
        { id: 'dep-1', type: 'Deployment', data: { label: 'backend-dep' }, position: { x: 0, y: 0 } },
        { id: 'pod-1', type: 'Pod', data: { label: 'redis-pod' }, position: { x: 0, y: 0 } },
        { id: 'svc-1', type: 'Service', data: { label: 'backend-svc' }, position: { x: 0, y: 0 } },
      ],
    });
  });

  it('evaluates hasWorkload and isValidConnection correctly when workload nodes exist', () => {
    const props = {
      id: 'rl-1',
      data: {
        cpuRequest: '250m',
        cpuLimit: '500m',
      },
    } as any;

    const { result } = renderHook(() => useResourceLimitNode(props));

    expect(result.current.colorMode).toBe('dark');
    expect(result.current.hasWorkload).toBe(true);
    expect(result.current.data).toEqual(props.data);

    // Valid connections to Deployment or Pod
    expect(result.current.isValidConnection({ target: 'dep-1' })).toBe(true);
    expect(result.current.isValidConnection({ target: 'pod-1' })).toBe(true);

    // Invalid connection to Service
    expect(result.current.isValidConnection({ target: 'svc-1' })).toBe(false);
    expect(result.current.isValidConnection({ target: 'non-existent' })).toBe(false);
  });

  it('evaluates hasWorkload as false when no Deployment or Pod exists in canvas', () => {
    useFlowStore.setState({
      nodes: [
        { id: 'svc-1', type: 'Service', data: { label: 'backend-svc' }, position: { x: 0, y: 0 } },
      ],
    });

    const props = {
      id: 'rl-2',
      data: { label: 'res-limit' },
    } as any;

    const { result } = renderHook(() => useResourceLimitNode(props));

    expect(result.current.hasWorkload).toBe(false);
  });
});
