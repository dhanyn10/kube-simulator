import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBaseNodeHandler, getProgressSegmentStyles } from '@/activities/nodes';
import { getPodNames } from '@/activities/terminal/terminalAutocomplete';
import { useFlowStore } from '@/store';

describe('Stacked Pod Label and Highlight Tests', () => {
  beforeEach(() => {
    useFlowStore.setState({
      nodes: [],
      hoveredAutocompletePodName: null,
      colorMode: 'dark',
    });
  });

  it('formats displayLabel as basename-podHash-***** when parentReplicas > 3', () => {
    const data = {
      label: 'myapp-k98z-m1aa1',
      type: 'Pod',
      baseName: 'myapp',
      podHash: 'k98z',
      replicaSuffix: 'm1aa1',
      replicas: 5,
      parentReplicas: 5,
      parentId: 'deploy-1',
    };

    const { result } = renderHook(() =>
      useBaseNodeHandler({
        id: 'pod-1',
        data: data as any,
        color: 'blue',
      })
    );

    expect(result.current.displayLabel).toBe('myapp-k98z-*****');
  });

  it('formats displayLabel as data.label when parentReplicas <= 3', () => {
    const data = {
      label: 'myapp-k98z-m1aa1',
      type: 'Pod',
      baseName: 'myapp',
      podHash: 'k98z',
      replicaSuffix: 'm1aa1',
      replicas: 1,
      parentReplicas: 2,
      parentId: 'deploy-1',
    };

    const { result } = renderHook(() =>
      useBaseNodeHandler({
        id: 'pod-1',
        data: data as any,
        color: 'blue',
      })
    );

    expect(result.current.displayLabel).toBe('myapp-k98z-m1aa1');
  });

  it('returns all individual pod names in getPodNames for stacked pods', () => {
    const nodes: any[] = [
      {
        id: 'pod-stacked',
        type: 'Pod',
        data: {
          label: 'myapp-k98z-m1aa1',
          baseName: 'myapp',
          podHash: 'k98z',
          replicas: 5,
          parentReplicas: 5,
          replicaSuffixes: ['m1aa1', 'm1aa2', 'm1aa3', 'm1aa4', 'm1aa5'],
        },
      },
    ];

    const podNames = getPodNames(nodes);
    expect(podNames).toHaveLength(5);
    expect(podNames).toEqual([
      'myapp-k98z-m1aa1',
      'myapp-k98z-m1aa2',
      'myapp-k98z-m1aa3',
      'myapp-k98z-m1aa4',
      'myapp-k98z-m1aa5',
    ]);
  });

  it('calculates hoveredPodIndex correctly when a specific replica suffix is hovered', () => {
    useFlowStore.setState({
      hoveredAutocompletePodName: 'myapp-k98z-m1aa3',
    });

    const data = {
      label: 'myapp-k98z-m1aa1',
      type: 'Pod',
      baseName: 'myapp',
      podHash: 'k98z',
      replicaSuffix: 'm1aa1',
      replicaSuffixes: ['m1aa1', 'm1aa2', 'm1aa3', 'm1aa4', 'm1aa5'],
      replicas: 5,
      parentReplicas: 5,
      parentId: 'deploy-1',
    };

    const { result } = renderHook(() =>
      useBaseNodeHandler({
        id: 'pod-1',
        data: data as any,
        color: 'blue',
      })
    );

    expect(result.current.isAutocompleteHovered).toBe(true);
    expect(result.current.hoveredPodIndex).toBe(2);
  });

  it('returns blue segment styles when isAutocompleteHovered is true', () => {
    const styles = getProgressSegmentStyles('dark', true);
    expect(styles.barClass).toContain('bg-blue-500');
    expect(styles.circleStrokeClass).toContain('text-blue-500');
    expect(styles.textClass).toContain('text-blue-500');
  });

  it('returns green segment styles when isAutocompleteHovered is false', () => {
    const styles = getProgressSegmentStyles('dark', false);
    expect(styles.barClass).toContain('bg-emerald-500');
    expect(styles.circleStrokeClass).toContain('text-emerald-500');
  });
});
