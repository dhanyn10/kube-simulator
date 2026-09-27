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

  it('only sets isAutocompleteHovered = true on the card containing the hovered pod suffix', () => {
    useFlowStore.setState({
      hoveredAutocompletePodName: 'myapp-k98z-suf2',
    });

    const card0Data = {
      label: 'myapp-k98z-suf0',
      type: 'Pod',
      baseName: 'myapp',
      podHash: 'k98z',
      replicaSuffix: 'suf0',
      replicaSuffixes: ['suf0', 'suf1', 'suf2', 'suf3', 'suf4', 'suf5', 'suf6', 'suf7', 'suf8', 'suf9'],
      replicas: 10,
      parentReplicas: 15,
      parentId: 'deploy-1',
    };

    const card1Data = {
      label: 'myapp-k98z-suf10',
      type: 'Pod',
      baseName: 'myapp',
      podHash: 'k98z',
      replicaSuffix: 'suf10',
      replicaSuffixes: ['suf10', 'suf11', 'suf12', 'suf13', 'suf14'],
      replicas: 5,
      parentReplicas: 15,
      parentId: 'deploy-1',
    };

    const { result: res0 } = renderHook(() =>
      useBaseNodeHandler({
        id: 'pod-card-0',
        data: card0Data as any,
        color: 'blue',
      })
    );

    const { result: res1 } = renderHook(() =>
      useBaseNodeHandler({
        id: 'pod-card-1',
        data: card1Data as any,
        color: 'blue',
      })
    );

    expect(res0.current.isAutocompleteHovered).toBe(true);
    expect(res0.current.hoveredPodIndex).toBe(2);

    expect(res1.current.isAutocompleteHovered).toBe(false);
    expect(res1.current.hoveredPodIndex).toBeNull();
  });

  it('returns blue segment styles when isAutocompleteHovered is true', () => {
    const styles = getProgressSegmentStyles('dark', true);
    expect(styles.barClass).toContain('bg-blue-500');
    expect(styles.circleStrokeClass).toContain('text-blue-500');
    expect(styles.textClass).toContain('text-blue-500');
  });

  it('returns green segment styles when isAutocompleteHovered is false and status is ready', () => {
    const styles = getProgressSegmentStyles('dark', false, { isReady: true });
    expect(styles.barClass).toContain('bg-emerald-500');
    expect(styles.circleStrokeClass).toContain('text-emerald-500');
  });

  it('returns red segment styles when isPending or isCrashing is true', () => {
    const pendingStyles = getProgressSegmentStyles('dark', false, { isPending: true });
    expect(pendingStyles.barClass).toContain('bg-red-500');
    expect(pendingStyles.circleStrokeClass).toContain('text-red-500');

    const crashingStyles = getProgressSegmentStyles('dark', false, { isCrashing: true });
    expect(crashingStyles.barClass).toContain('bg-red-600');
    expect(crashingStyles.circleStrokeClass).toContain('text-red-600');
  });
});
