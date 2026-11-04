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

  it('validates resource limits and flags invalid request > limit QoS states', () => {
    // Valid state (req <= limit)
    const validProps = {
      id: 'rl-valid',
      data: {
        cpuRequest: '500m',
        cpuLimit: '1000m',
        memoryRequest: '256Mi',
        memoryLimit: '512Mi',
      },
    } as any;
    const { result: validResult } = renderHook(() => useResourceLimitNode(validProps));
    expect(validResult.current.isCpuInvalid).toBe(false);
    expect(validResult.current.isMemoryInvalid).toBe(false);
    expect(validResult.current.hasResourceError).toBe(false);

    // Invalid CPU state (cpuRequest > cpuLimit)
    const invalidCpuProps = {
      id: 'rl-invalid-cpu',
      data: {
        cpuRequest: '2000m',
        cpuLimit: '500m',
        memoryRequest: '256Mi',
        memoryLimit: '512Mi',
      },
    } as any;
    const { result: invalidCpuResult } = renderHook(() => useResourceLimitNode(invalidCpuProps));
    expect(invalidCpuResult.current.isCpuInvalid).toBe(true);
    expect(invalidCpuResult.current.isMemoryInvalid).toBe(false);
    expect(invalidCpuResult.current.hasResourceError).toBe(true);

    // Invalid Memory state (memoryRequest > memoryLimit)
    const invalidMemProps = {
      id: 'rl-invalid-mem',
      data: {
        cpuRequest: '500m',
        cpuLimit: '1000m',
        memoryRequest: '1Gi',
        memoryLimit: '256Mi',
      },
    } as any;
    const { result: invalidMemResult } = renderHook(() => useResourceLimitNode(invalidMemProps));
    expect(invalidMemResult.current.isCpuInvalid).toBe(false);
    expect(invalidMemResult.current.isMemoryInvalid).toBe(true);
    expect(invalidMemResult.current.hasResourceError).toBe(true);
  });
});
